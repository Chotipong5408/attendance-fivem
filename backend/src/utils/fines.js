const prisma = require('../lib/prisma');
const { getSettings } = require('./settings');

async function syncFinesForDate(userId, date) {
  const targetDate = new Date(date);
  const settings = await getSettings();
  const absentFine = Number(settings.absentFine) || 50000;
  const excessLeaveFine = Number(settings.excessLeaveFine) || 50000;
  const maxLeavesPerWeek = Number(settings.maxLeavesPerWeek) || 4;
  const attendanceSlots = settings.attendanceSlots || [];

  // 1. Check Attendance for Absent Fines
  const attendance = await prisma.attendance.findUnique({
    where: { userId_attendanceDate: { userId, attendanceDate: targetDate } },
  });

  let absentSlotsCount = 0;
  let absentSlotNames = [];
  if (attendance) {
    if (attendance.timeSlots) {
      let slots = attendance.timeSlots;
      if (typeof slots === 'string') {
        try { slots = JSON.parse(slots); } catch (e) { slots = {}; }
      }
      for (const [slot, status] of Object.entries(slots)) {
        if (status === 'absent') {
          absentSlotNames.push(slot);
        }
      }
      absentSlotsCount = absentSlotNames.length;
    } else if (attendance.status === 'absent') {
      absentSlotsCount = Math.max(1, attendanceSlots.length);
      absentSlotNames = attendanceSlots.length > 0 ? [...attendanceSlots] : ['ทั้งวัน'];
    }
  }

  if (absentSlotsCount > 0) {
    const totalAbsentFine = absentSlotsCount * absentFine;
    const timeText = absentSlotNames.length > 0 ? ` (รอบ ${absentSlotNames.join(', ')})` : '';
    const reasonText = `ขาดเช็คชื่อ ${absentSlotsCount} รอบ${timeText}`;
    
    await prisma.fine.upsert({
      where: { userId_date_type: { userId, date: targetDate, type: 'absent' } },
      update: { amount: totalAbsentFine, reason: reasonText },
      create: { userId, date: targetDate, type: 'absent', amount: totalAbsentFine, reason: reasonText },
    });
  } else {
    // Delete unpaid absent fine for this date if it exists
    await prisma.fine.deleteMany({
      where: { userId, date: targetDate, type: 'absent', isPaid: false },
    });
  }

  // 2. Check Leaves for this week (using UTC math since leaveDate is at UTC 00:00:00)
  const dayOfWeek = targetDate.getUTCDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = new Date(targetDate);
  weekStart.setUTCDate(targetDate.getUTCDate() + diffToMonday);
  
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6);

  // Get all leaves in this week
  const leaves = await prisma.leaveRequest.findMany({
    where: {
      userId,
      leaveDate: { gte: weekStart, lte: weekEnd },
      status: 'approved',
    },
    orderBy: { leaveDate: 'asc' },
  });

  let totalLeaveCount = 0;

  // Calculate excess leaves
  for (let i = 0; i < leaves.length; i++) {
    const lDate = leaves[i].leaveDate;
    
    // How many slots does this leave consume?
    let slotsConsumed = 1;
    if (leaves[i].leaveType === 'full_day') {
      slotsConsumed = Math.max(1, attendanceSlots.length);
    } else if (leaves[i].leaveType === 'partial') {
      slotsConsumed = leaves[i].leaveTimeSlot ? leaves[i].leaveTimeSlot.split(',').filter(Boolean).length : 1;
    }

    let excessSlots = 0;

    if (totalLeaveCount >= maxLeavesPerWeek) {
      // Entirely excess
      excessSlots = slotsConsumed;
    } else if (totalLeaveCount + slotsConsumed > maxLeavesPerWeek) {
      // Partially excess
      excessSlots = (totalLeaveCount + slotsConsumed) - maxLeavesPerWeek;
    }

    totalLeaveCount += slotsConsumed;

    if (excessSlots > 0) {
      // create or update fine
      const fineAmount = excessSlots * excessLeaveFine;
      await prisma.fine.upsert({
        where: { userId_date_type: { userId, date: lDate, type: 'excess_leave' } },
        update: { amount: fineAmount, reason: `ลาเกินโควต้า (${excessSlots} รอบ)` },
        create: { userId, date: lDate, type: 'excess_leave', amount: fineAmount, reason: `ลาเกินโควต้า (${excessSlots} รอบ)` },
      });
    } else {
      // should not have fine
      await prisma.fine.deleteMany({
        where: { userId, date: lDate, type: 'excess_leave', isPaid: false },
      });
    }
  }

  // Clean up any remaining excess_leave fines in this week that no longer have a leave
  const leaveDates = leaves.map(l => l.leaveDate.toISOString());
  await prisma.fine.deleteMany({
    where: {
      userId,
      type: 'excess_leave',
      isPaid: false,
      date: { gte: weekStart, lte: weekEnd, notIn: leaveDates.map(d => new Date(d)) },
    },
  });
}

module.exports = { syncFinesForDate };
