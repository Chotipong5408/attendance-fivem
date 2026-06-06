const express = require('express');
const prisma = require('../lib/prisma');
const { logActivity } = require('../utils/activityLog');
const { getIp } = require('../utils/getIp');
const { getSettings } = require('../utils/settings');
const { getPaginationParams, paginatedResponse, startOfDay, endOfDay } = require('../utils/pagination');
const { startOfWeek, endOfWeek } = require('date-fns');
const {
  ensureAllUsersAttendanceForDate,
  ensureUserAttendanceForDate,
  ensureDateRangeBatch,
} = require('../utils/autoAttendance');
const authMiddleware = require('../middleware/auth');
const managerMiddleware = require('../middleware/manager');
const { validate, markAbsentSchema, attendanceQuerySchema } = require('../middleware/validate');
const { syncFinesForDate } = require('../utils/fines');

const router = express.Router();


router.use(authMiddleware);

router.get('/today', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const today = startOfDay();

    const attendance = await ensureUserAttendanceForDate(userId, today);
    const leave = await prisma.leaveRequest.findUnique({
      where: { userId_leaveDate: { userId, leaveDate: today } },
    });

    res.json({ attendance, leave });
  } catch (err) {
    next(err);
  }
});

router.get('/stats/me-period', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const period = ['day', 'month', 'year'].includes(req.query.period) ? req.query.period : 'month';
    const now = new Date();
    const to = startOfDay(now);
    let from;
    let bucketCount;
    let dateTruncUnit;

    if (period === 'day') {
      bucketCount = Math.max(1, Math.min(Number(req.query.days) || 7, 60));
      from = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (bucketCount - 1)));
      dateTruncUnit = 'day';
    } else if (period === 'year') {
      bucketCount = Math.max(1, Math.min(Number(req.query.years) || 5, 10));
      from = startOfDay(new Date(now.getFullYear() - (bucketCount - 1), 0, 1));
      dateTruncUnit = 'year';
    } else {
      bucketCount = Math.max(1, Math.min(Number(req.query.months) || 6, 24));
      from = startOfDay(new Date(now.getFullYear(), now.getMonth() - (bucketCount - 1), 1));
      dateTruncUnit = 'month';
    }

    await ensureUserAttendanceForDate(userId, to);

    const rows = await prisma.$queryRawUnsafe(
      `
      SELECT
        DATE_TRUNC('${dateTruncUnit}', "attendanceDate") AS period_date,
        status,
        COUNT(*)::int AS count
      FROM attendance
      WHERE "userId" = $1
        AND "attendanceDate" >= $2
        AND "attendanceDate" <= $3
      GROUP BY DATE_TRUNC('${dateTruncUnit}', "attendanceDate"), status
      ORDER BY period_date DESC
      `,
      userId,
      from,
      to
    );

    const periodMap = new Map();
    for (let i = 0; i < bucketCount; i += 1) {
      let periodDate;
      if (period === 'day') {
        periodDate = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i));
      } else if (period === 'year') {
        periodDate = startOfDay(new Date(now.getFullYear() - i, 0, 1));
      } else {
        periodDate = startOfDay(new Date(now.getFullYear(), now.getMonth() - i, 1));
      }
      periodMap.set(periodDate.toISOString(), {
        periodDate,
        present: 0,
        absent: 0,
        leave: 0,
        total: 0,
      });
    }

    for (const row of rows) {
      const periodKey = new Date(row.period_date).toISOString();
      if (!periodMap.has(periodKey)) {
        periodMap.set(periodKey, { periodDate: row.period_date, present: 0, absent: 0, leave: 0, total: 0 });
      }
      const entry = periodMap.get(periodKey);
      entry[row.status] = row.count;
      entry.total = entry.present + entry.absent + entry.leave;
    }

    res.json({
      period,
      dateFrom: from,
      dateTo: to,
      buckets: [...periodMap.values()],
    });
  } catch (err) {
    next(err);
  }
});

router.get('/daily', managerMiddleware, async (req, res, next) => {
  try {
    const date = req.query.date ? startOfDay(new Date(req.query.date)) : startOfDay();
    const today = startOfDay();
    
    // Always ensure attendance records exist for the requested date (on-the-fly generation)
    await ensureAllUsersAttendanceForDate(date);

    const users = await prisma.user.findMany({
      where: { 
        role: { in: ['user', 'head'] },
        createdAt: { lte: endOfDay(date) }
      },
      select: { id: true, username: true, number: true, icName: true },
      orderBy: { createdAt: 'asc' },
    });

    const attendances = await prisma.attendance.findMany({
      where: { attendanceDate: date },
      include: { user: { select: { id: true, username: true, number: true, icName: true } } },
    });

    const leaveMap = Object.fromEntries(
      (
        await prisma.leaveRequest.findMany({
          where: { leaveDate: date },
        })
      ).map((l) => [l.userId, l])
    );

    const attMap = Object.fromEntries(attendances.map((a) => [a.userId, a]));

    const rows = users.map((user) => ({
      user,
      attendance: attMap[user.id] || null,
      leave: leaveMap[user.id] || null,
    }));

    res.json({ date, rows });
  } catch (err) {
    next(err);
  }
});

router.post('/absent', managerMiddleware, validate(markAbsentSchema), async (req, res, next) => {
  try {
    const { userId, date, note, timeSlot } = req.body;
    const attendanceDate = startOfDay(new Date(date));

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !['user', 'head'].includes(user.role)) {
      return res.status(404).json({ error: 'Not Found', message: 'User not found' });
    }

    // Get existing record to merge timeSlots
    const existing = await prisma.attendance.findUnique({
      where: { userId_attendanceDate: { userId, attendanceDate } },
    });

    let currentSlots = {};
    if (existing?.timeSlots) {
      currentSlots = typeof existing.timeSlots === 'string'
        ? JSON.parse(existing.timeSlots)
        : existing.timeSlots;
    }

    let updateData;
    let createData;

    if (timeSlot) {
      // Mark only specific timeslot as absent
      const newSlots = { ...currentSlots, [timeSlot]: 'absent' };
      updateData = { timeSlots: newSlots, note: note || `Admin บันทึกขาด ${timeSlot}` };
      createData = { userId, attendanceDate, status: 'present', timeSlots: newSlots, note: note || `Admin บันทึกขาด ${timeSlot}` };
    } else {
      // Mark whole day absent (both slots + overall status)
      const newSlots = { ...currentSlots, '20:00': 'absent', '22:30': 'absent' };
      updateData = { status: 'absent', timeSlots: newSlots, note: note || 'Admin บันทึกขาดทั้งวัน' };
      createData = { userId, attendanceDate, status: 'absent', timeSlots: newSlots, note: note || 'Admin บันทึกขาดทั้งวัน' };
    }

    const attendance = await prisma.attendance.upsert({
      where: { userId_attendanceDate: { userId, attendanceDate } },
      update: updateData,
      create: createData,
      include: { user: { select: { id: true, username: true, number: true, icName: true } } },
    });

    logActivity({
      userId: req.user.id,
      action: 'MARK_ABSENT',
      details: { targetUserId: userId, date: attendanceDate, timeSlot: timeSlot || 'full_day' },
      ipAddress: getIp(req),
    });

    await syncFinesForDate(userId, attendanceDate);

    res.json(attendance);
  } catch (err) {
    next(err);
  }
});

router.put('/update-daily', managerMiddleware, async (req, res, next) => {
  try {
    const { userId, date, status, timeSlot, timeSlotStatus, note } = req.body;
    const attendanceDate = startOfDay(new Date(date));

    const existing = await prisma.attendance.findUnique({
      where: { userId_attendanceDate: { userId, attendanceDate } }
    });

    let timeSlots = existing?.timeSlots || {};
    if (typeof timeSlots === 'string') {
      try { timeSlots = JSON.parse(timeSlots); } catch (e) { timeSlots = {}; }
    }

    if (timeSlot) {
      if (timeSlotStatus) {
        timeSlots[timeSlot] = timeSlotStatus;
      } else {
        delete timeSlots[timeSlot];
      }
    }

    const updateData = { timeSlots };
    if (status) updateData.status = status;
    if (note !== undefined) updateData.note = note;

    const attendance = await prisma.attendance.upsert({
      where: { userId_attendanceDate: { userId, attendanceDate } },
      update: updateData,
      create: {
        userId,
        attendanceDate,
        status: status || 'absent',
        timeSlots,
        note: note || ''
      },
      include: { user: { select: { id: true, username: true, number: true, icName: true } } },
    });

    await syncFinesForDate(userId, attendanceDate);

    res.json(attendance);
  } catch (err) {
    next(err);
  }
});

/**
 * Optimized: get per-user stats using a single GROUP BY query
 * instead of N×3 individual COUNT queries.
 */
router.get('/stats/users', managerMiddleware, async (req, res, next) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const from = dateFrom ? startOfDay(new Date(dateFrom)) : startOfDay(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    const to = dateTo ? endOfDay(new Date(dateTo)) : endOfDay();
    const today = startOfDay();

    // Batch ensure attendance for past dates in the range
    const backfillTo = startOfDay(to) < today ? startOfDay(to) : startOfDay(new Date(today.getTime() - 86400000));
    if (from <= backfillTo) {
      await ensureDateRangeBatch(from, backfillTo);
    }

    // Get all users created before or on the end of this period
    const users = await prisma.user.findMany({
      where: { 
        role: { in: ['user', 'head'] },
        createdAt: { lte: to }
      },
      select: { id: true, username: true, number: true, icName: true },
    });

    // Single GROUP BY query instead of N×3 individual counts
    const rawStats = await prisma.$queryRaw`
      SELECT "userId", status, COUNT(*)::int AS count
      FROM attendance
      WHERE "attendanceDate" >= ${from}
        AND "attendanceDate" <= ${startOfDay(to)}
      GROUP BY "userId", status
    `;

    // Build a map: userId -> { present, absent, leave }
    const statsMap = new Map();
    for (const row of rawStats) {
      if (!statsMap.has(row.userId)) {
        statsMap.set(row.userId, { present: 0, absent: 0, leave: 0 });
      }
      statsMap.get(row.userId)[row.status] = row.count;
    }

    // Merge with user data
    const stats = users.map((user) => {
      const counts = statsMap.get(user.id) || { present: 0, absent: 0, leave: 0 };
      return {
        user,
        present: counts.present,
        absent: counts.absent,
        leave: counts.leave,
        total: counts.present + counts.absent + counts.leave,
      };
    });

    stats.sort((a, b) => b.present - a.present);

    const frequentLeave = [...stats].sort((a, b) => b.leave - a.leave).slice(0, 5);
    const frequentAbsent = [...stats].sort((a, b) => b.absent - a.absent).slice(0, 5);

    res.json({ dateFrom: from, dateTo: to, stats, frequentLeave, frequentAbsent });
  } catch (err) {
    next(err);
  }
});

// --- MANAGER ROUTES ---
// Manager routes for viewing and editing attendance (Dashboard, Lists, etc.)

router.get('/stats/dashboard', managerMiddleware, async (req, res, next) => {
  try {
    const { dateFrom, dateTo } = req.query;
    // Default to current week (Mon-Sun)
    const from = dateFrom ? startOfDay(new Date(dateFrom)) : startOfWeek(new Date(), { weekStartsOn: 1 });
    const to = dateTo ? endOfDay(new Date(dateTo)) : endOfWeek(new Date(), { weekStartsOn: 1 });
    const toDay = startOfDay(to);
    const today = startOfDay();

    // Batch ensure attendance only for past dates
    const backfillTo = toDay < today ? toDay : startOfDay(new Date(today.getTime() - 86400000));
    if (from <= backfillTo) {
      await ensureDateRangeBatch(from, backfillTo);
    }

    const where = { attendanceDate: { gte: from, lte: toDay } };

    const [
      attendances,
      leaves,
      users,
      recentActivities
    ] = await Promise.all([
      prisma.attendance.findMany({ where }),
      prisma.leaveRequest.findMany({ where: { leaveDate: { gte: from, lte: toDay } } }),
      prisma.user.findMany({
        where: { role: { in: ['user', 'head'] }, createdAt: { lte: toDay } },
        select: { id: true, username: true, number: true, icName: true, createdAt: true },
        orderBy: { createdAt: 'asc' }
      }),
      // Fetch recent activities
      prisma.activityLog.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, username: true, number: true, icName: true } } }
      })
    ]);

    const { attendanceSlots: ATTENDANCE_SLOTS } = await getSettings();
    
    // Map leave requests
    const leaveMap = new Map();
    for (const l of leaves) {
      leaveMap.set(`${l.userId}|${l.leaveDate.toISOString()}`, l);
    }

    // Map stats per user
    const statsMap = new Map();
    for (const u of users) {
      statsMap.set(u.id, { present: 0, absent: 0, leave: 0 });
    }

    // Calculate total summary precisely
    const summary = { present: 0, absent: 0, leave: 0, total: 0, totalMembers: users.length };

    const dailyMap = new Map();
    for (let d = new Date(from); d <= toDay; d = new Date(d.getTime() + 86400000)) {
      dailyMap.set(startOfDay(d).toISOString(), { date: startOfDay(d).toISOString(), present: 0, absent: 0, leave: 0, total: 0 });
    }

    for (const att of attendances) {
      if (!statsMap.has(att.userId)) continue;
      
      let slots = att.timeSlots || {};
      if (typeof slots === 'string') {
        try { slots = JSON.parse(slots); } catch(e) { slots = {}; }
      }
      
      const leave = leaveMap.get(`${att.userId}|${att.attendanceDate.toISOString()}`);
      const userStat = statsMap.get(att.userId);
      const dateKey = startOfDay(att.attendanceDate).toISOString();
      const dailyStat = dailyMap.get(dateKey);
      
      for (const slotKey of ATTENDANCE_SLOTS) {
        let effStatus = 'present';
        const fromDb = slots[slotKey];
        // If admin has explicitly set a value in DB, that takes priority over leave
        if (fromDb) {
          effStatus = fromDb;
        } else if (leave) {
          if (leave.leaveType === 'full_day') effStatus = 'leave';
          if (leave.leaveType === 'partial' && leave.leaveTimeSlot && leave.leaveTimeSlot.includes(slotKey)) effStatus = 'leave';
        }

        userStat[effStatus] = (userStat[effStatus] || 0) + 1;
        summary[effStatus] = (summary[effStatus] || 0) + 1;
        summary.total++;
        if (dailyStat) {
          dailyStat[effStatus] = (dailyStat[effStatus] || 0) + 1;
          dailyStat.total++;
        }
      }
    }

    // Compute todaySummary from dailyMap (based on timeSlots + leave, not root status)
    const todayDailyStat = dailyMap.get(today.toISOString());
    const todaySummary = todayDailyStat
      ? { present: todayDailyStat.present, absent: todayDailyStat.absent, leave: todayDailyStat.leave, total: todayDailyStat.total }
      : { present: 0, absent: 0, leave: 0, total: 0 };

    const userStatsArr = users.map((user) => {
      const counts = statsMap.get(user.id);
      return {
        user,
        present: counts.present,
        absent: counts.absent,
        leave: counts.leave,
        total: counts.present + counts.absent + counts.leave,
      };
    });

    userStatsArr.sort((a, b) => b.present - a.present);
    const topPresent = [...userStatsArr].slice(0, 5);
    const topAbsent = [...userStatsArr].sort((a, b) => b.absent - a.absent).slice(0, 5);
    const dailyTrend = Array.from(dailyMap.values()).sort((a, b) => new Date(a.date) - new Date(b.date));

    res.json({
      summary,
      todaySummary,
      recentActivities,
      dailyTrend,
      userStats: {
        dateFrom: from,
        dateTo: to,
        stats: userStatsArr,
        topPresent,
        topAbsent,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/stats', managerMiddleware, async (req, res, next) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const from = dateFrom ? startOfDay(new Date(dateFrom)) : startOfDay();
    const to = dateTo ? startOfDay(new Date(dateTo)) : startOfDay();

    // Only ensure attendance for past dates (past dates are immutable)
    const today = startOfDay();
    const backfillTo = startOfDay(to) < today ? startOfDay(to) : startOfDay(new Date(today.getTime() - 86400000));
    if (from <= backfillTo) {
      await ensureDateRangeBatch(from, backfillTo);
    }

    const where = { attendanceDate: { gte: from, lte: to } };

    const [present, absent, leaveCount, monthlyStats] = await Promise.all([
      prisma.attendance.count({ where: { ...where, status: 'present' } }),
      prisma.attendance.count({ where: { ...where, status: 'absent' } }),
      prisma.attendance.count({ where: { ...where, status: 'leave' } }),
      prisma.$queryRaw`
        SELECT
          DATE_TRUNC('month', "attendanceDate") AS month,
          status,
          COUNT(*)::int AS count
        FROM attendance
        WHERE "attendanceDate" >= ${from} AND "attendanceDate" <= ${to}
        GROUP BY DATE_TRUNC('month', "attendanceDate"), status
        ORDER BY month DESC
      `,
    ]);

    res.json({
      summary: { present, absent, leave: leaveCount, total: present + absent + leaveCount },
      monthlyStats,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/', validate(attendanceQuerySchema), async (req, res, next) => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query);
    const { status, username, userId, dateFrom, dateTo, search, date, viewAll } = req.query;
    const isAdmin = req.user.role === 'admin';
    const isHead = req.user.role === 'head';
    // admin always sees all; head sees all only from admin attendance page (viewAll=true)
    const canViewAll = isAdmin || (isHead && viewAll === 'true');

    const where = {};

    if (!canViewAll) {
      where.userId = req.user.id;
    } else if (userId) {
      where.userId = userId;
    }

    if (status) where.status = status;

    if (date) {
      where.attendanceDate = startOfDay(new Date(date));
    } else if (dateFrom || dateTo) {
      where.attendanceDate = {};
      if (dateFrom) where.attendanceDate.gte = startOfDay(new Date(dateFrom));
      if (dateTo) where.attendanceDate.lte = startOfDay(new Date(dateTo));
    }

    if (username || search) {
      const term = username || search;
      where.user = {
        OR: [
          { username: { contains: term, mode: 'insensitive' } },
          { icName: { contains: term, mode: 'insensitive' } },
          { number: { contains: term, mode: 'insensitive' } },
        ],
      };
    }

    const [records, total, allAttendances] = await Promise.all([
      prisma.attendance.findMany({
        where,
        skip,
        take: limit,
        include: { user: { select: { id: true, username: true, number: true, icName: true } } },
        orderBy: [
          { attendanceDate: 'desc' },
          { user: { createdAt: 'asc' } }
        ],
      }),
      prisma.attendance.count({ where }),
      prisma.attendance.findMany({
        where,
        select: { userId: true, attendanceDate: true, timeSlots: true }
      })
    ]);

    let present = 0, absent = 0, leaveCount = 0;

    if (allAttendances.length > 0) {
      const userIds = [...new Set(allAttendances.map(r => r.userId))];
      const dates = [...new Set(allAttendances.map(r => r.attendanceDate.toISOString()))].map(d => new Date(d));
      
      const leaves = await prisma.leaveRequest.findMany({
        where: {
          userId: { in: userIds },
          leaveDate: { in: dates }
        }
      });
      
      const leaveMap = new Map(leaves.map(l => [`${l.userId}|${startOfDay(l.leaveDate).toISOString()}`, l]));
      const { attendanceSlots: ATTENDANCE_SLOTS } = await getSettings();
      
      for (const att of allAttendances) {
        let slots = att.timeSlots || {};
        if (typeof slots === 'string') {
          try { slots = JSON.parse(slots); } catch(e) { slots = {}; }
        }
        const leave = leaveMap.get(`${att.userId}|${startOfDay(att.attendanceDate).toISOString()}`);
        for (const slotKey of ATTENDANCE_SLOTS) {
          let effStatus = 'present';
          const fromDb = slots[slotKey];
          // If admin has explicitly set a value in DB, that takes priority over leave
          if (fromDb) {
            effStatus = fromDb;
          } else if (leave) {
            if (leave.leaveType === 'full_day') effStatus = 'leave';
            if (leave.leaveType === 'partial' && leave.leaveTimeSlot && leave.leaveTimeSlot.includes(slotKey)) effStatus = 'leave';
          }

          if (effStatus === 'present') present++;
          else if (effStatus === 'absent') absent++;
          else if (effStatus === 'leave') leaveCount++;
        }
      }

      for (const record of records) {
        const leave = leaveMap.get(`${record.userId}|${startOfDay(record.attendanceDate).toISOString()}`);
        if (leave) {
          record.leave = leave;
        }
      }
    }

    const response = paginatedResponse(records, total, page, limit);
    response.summary = { present, absent, leave: leaveCount, total };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
