const prisma = require('../lib/prisma');
const { startOfDay } = require('./pagination');
const { formatLeaveNote } = require('./leaveSlots');
const { getSettings } = require('./settings');

// Build default timeSlots JSON, respecting leave if present
async function buildTimeSlotsForLeave(leave) {
  const { attendanceSlots: ATTENDANCE_SLOTS } = await getSettings();
  const slots = {};
  for (const slot of ATTENDANCE_SLOTS) {
    if (!leave) {
      slots[slot] = 'present';
    } else if (leave.leaveType === 'full_day') {
      slots[slot] = 'leave';
    } else if (leave.leaveType === 'partial' && leave.leaveTimeSlot && leave.leaveTimeSlot.includes(slot)) {
      slots[slot] = 'leave';
    } else {
      slots[slot] = 'present';
    }
  }
  return slots;
}



async function getAttendanceForUserDate(userId, date) {
  const day = startOfDay(date);
  return prisma.attendance.findUnique({
    where: { userId_attendanceDate: { userId, attendanceDate: day } },
  });
}

function toLocalYYYYMMDD(date) {
  const d = new Date(date);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = formatter.formatToParts(d);
  const year = parts.find(p => p.type === 'year').value;
  const month = parts.find(p => p.type === 'month').value;
  const day = parts.find(p => p.type === 'day').value;
  return `${year}-${month}-${day}`;
}

async function ensureUserAttendanceForDate(userId, date = new Date()) {
  const day = startOfDay(date);

  // Skip if the user's account was created after this date (comparing local dates)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { createdAt: true },
  });
  if (user && toLocalYYYYMMDD(user.createdAt) > toLocalYYYYMMDD(day)) return null;

  const existing = await getAttendanceForUserDate(userId, day);
  if (existing) return existing;

  const leave = await prisma.leaveRequest.findUnique({
    where: { userId_leaveDate: { userId, leaveDate: day } },
  });

  const timeSlots = await buildTimeSlotsForLeave(leave);

  if (leave) {
    return prisma.attendance.create({
      data: {
        userId,
        attendanceDate: day,
        status: 'leave',
        timeSlots,
        note: formatLeaveNote(leave.leaveType, leave.leaveTimeSlot, leave.reason),
      },
    });
  }

  return prisma.attendance.create({
    data: { userId, attendanceDate: day, status: 'present', timeSlots },
  });
}

/**
 * Batch version: ensures all users have attendance for a given date.
 * Uses 3 read queries + 1 batch insert instead of N×3 sequential queries.
 */
async function ensureAllUsersAttendanceForDate(date = new Date()) {
  const day = startOfDay(date);

  // 1. Get all users with createdAt (1 query)
  const allUsers = await prisma.user.findMany({
    where: { role: { in: ['user', 'head'] } },
    select: { id: true, createdAt: true },
  });

  const dayStr = toLocalYYYYMMDD(day);
  const users = allUsers.filter((u) => {
    const uStr = toLocalYYYYMMDD(u.createdAt);
    if (uStr > dayStr) {
      return false;
    }
    return true;
  });

  if (users.length === 0) return { date: day, created: 0 };

  const userIds = users.map((u) => u.id);

  // 2. Get existing attendance for this date (1 query)
  const existingAttendance = await prisma.attendance.findMany({
    where: { attendanceDate: day, userId: { in: userIds } },
    select: { userId: true },
  });
  const existingSet = new Set(existingAttendance.map((a) => a.userId));

  // Filter to users who need attendance records
  const missingUserIds = userIds.filter((id) => !existingSet.has(id));
  if (missingUserIds.length === 0) return { date: day, created: 0 };

  // 3. Get leave requests for missing users on this date (1 query)
  const leaves = await prisma.leaveRequest.findMany({
    where: { leaveDate: day, userId: { in: missingUserIds } },
  });
  const leaveMap = new Map(leaves.map((l) => [l.userId, l]));

  // 4. Build batch insert data (with timeSlots for each user)
  const records = await Promise.all(missingUserIds.map(async (userId) => {
    const leave = leaveMap.get(userId);
    const timeSlots = await buildTimeSlotsForLeave(leave);
    if (leave) {
      return {
        userId,
        attendanceDate: day,
        status: 'leave',
        timeSlots,
        note: formatLeaveNote(leave.leaveType, leave.leaveTimeSlot, leave.reason),
      };
    }
    return { userId, attendanceDate: day, status: 'present', timeSlots };
  }));

  // 5. Batch insert (1 query)
  await prisma.attendance.createMany({
    data: records,
    skipDuplicates: true,
  });

  return { date: day, created: records.length };
}

/**
 * Batch version: ensures attendance for an entire date range at once.
 * Uses bulk queries instead of looping day-by-day.
 */
async function ensureDateRangeBatch(from, to) {
  const start = startOfDay(from);
  const end = startOfDay(to);

  // 1. Get all user IDs + createdAt (1 query)
  const users = await prisma.user.findMany({
    where: { role: { in: ['user', 'head'] } },
    select: { id: true, createdAt: true },
  });

  if (users.length === 0) return [];

  const userIds = users.map((u) => u.id);
  // Map userId -> toLocalYYYYMMDD(createdAt) for filtering
  const userCreatedMap = new Map(users.map((u) => [u.id, toLocalYYYYMMDD(u.createdAt)]));

  // 2. Get all existing attendance in the range (1 query)
  const existingAttendance = await prisma.attendance.findMany({
    where: {
      attendanceDate: { gte: start, lte: end },
      userId: { in: userIds },
    },
    select: { userId: true, attendanceDate: true },
  });

  // Build a Set of "userId|date" for fast lookup
  const existingKeys = new Set(
    existingAttendance.map((a) => `${a.userId}|${a.attendanceDate.toISOString()}`)
  );

  // 3. Build list of all (user, date) pairs that are missing
  //    Skip dates before the user's account was created
  const missingPairs = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const day = startOfDay(new Date(d));
    const dayStr = day.toISOString();
    const localDayStr = toLocalYYYYMMDD(day);
    for (const userId of userIds) {
      const createdDayStr = userCreatedMap.get(userId);
      if (createdDayStr && localDayStr < createdDayStr) {
        continue;
      }
      if (!existingKeys.has(`${userId}|${dayStr}`)) {
        missingPairs.push({ userId, date: day });
      }
    }
  }

  if (missingPairs.length === 0) return [];

  // 4. Get all leave requests in the range for missing pairs (1 query)
  const missingDates = [...new Set(missingPairs.map((p) => p.date.toISOString()))].map(
    (d) => new Date(d)
  );
  const missingUserIds = [...new Set(missingPairs.map((p) => p.userId))];

  const leaves = await prisma.leaveRequest.findMany({
    where: {
      leaveDate: { in: missingDates },
      userId: { in: missingUserIds },
    },
  });

  const leaveMap = new Map(
    leaves.map((l) => [`${l.userId}|${startOfDay(l.leaveDate).toISOString()}`, l])
  );

  // 5. Build batch insert data
  const records = await Promise.all(missingPairs.map(async ({ userId, date }) => {
    const leave = leaveMap.get(`${userId}|${date.toISOString()}`);
    const timeSlots = await buildTimeSlotsForLeave(leave);
    if (leave) {
      return {
        userId,
        attendanceDate: date,
        status: 'leave',
        timeSlots,
        note: formatLeaveNote(leave.leaveType, leave.leaveTimeSlot, leave.reason),
      };
    }
    return { userId, attendanceDate: date, status: 'present', timeSlots };
  }));

  // 6. Batch insert (1 query)
  await prisma.attendance.createMany({
    data: records,
    skipDuplicates: true,
  });

  return records;
}




module.exports = {
  buildTimeSlotsForLeave,
  ensureUserAttendanceForDate,
  ensureAllUsersAttendanceForDate,
  ensureDateRangeBatch,
};
