const express = require('express');
const prisma = require('../lib/prisma');
const { logActivity } = require('../utils/activityLog');
const { getIp } = require('../utils/getIp');
const { sendLeaveDiscordNotification, sendCancelLeaveDiscordNotification } = require('../utils/discord');
const { getPaginationParams, paginatedResponse, startOfDay } = require('../utils/pagination');
const { formatLeaveNote } = require('../utils/leaveSlots');
const { syncFinesForDate } = require('../utils/fines');
const authMiddleware = require('../middleware/auth');
const upload = require('../middleware/upload');
const { validate, leaveSchema, leaveQuerySchema } = require('../middleware/validate');
const { buildTimeSlotsForLeave } = require('../utils/autoAttendance');
const { getSettings } = require('../utils/settings');

const router = express.Router();


router.use(authMiddleware);

router.post('/', upload.single('image'), validate(leaveSchema), async (req, res, next) => {
  try {
    const { leaveDate, endDate, leaveType, leaveTimeSlot, reason } = req.body;
    const userId = req.user.id;
    
    const start = startOfDay(new Date(leaveDate));
    let end = start;
    if (endDate) {
      end = startOfDay(new Date(endDate));
      if (end < start) {
        return res.status(400).json({ error: 'Bad Request', message: 'วันที่สิ้นสุดต้องไม่น้อยกว่าวันที่เริ่มลา' });
      }
    }

    if (start < startOfDay()) {
      return res.status(400).json({ error: 'Bad Request', message: 'ไม่สามารถลาย้อนหลังได้' });
    }

    // Generate array of dates
    const datesToLeave = [];
    let current = new Date(start);
    while (current <= end) {
      datesToLeave.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    // Check for conflicts – build per-date existing leave map
    const existingLeaves = await prisma.leaveRequest.findMany({
      where: { userId, leaveDate: { in: datesToLeave } }
    });
    const existingLeaveMap = new Map(existingLeaves.map(l => [l.leaveDate.toISOString(), l]));

    // Block duplicate or incompatible leaves
    for (const d of datesToLeave) {
      const existing = existingLeaveMap.get(d.toISOString());
      if (!existing) continue;

      if (existing.leaveType === 'full_day') {
        return res.status(409).json({ error: 'Conflict', message: `มีการลาทั้งวันอยู่แล้วในวันที่ ${d.toLocaleDateString('th-TH')}` });
      }
      if (leaveType === 'full_day') {
        return res.status(409).json({ error: 'Conflict', message: `มีการลาบางช่วงเวลาอยู่แล้ว ไม่สามารถเปลี่ยนเป็นลาทั้งวันได้` });
      }

      // Check for duplicate partial slots
      if (leaveType === 'partial' && leaveTimeSlot && existing.leaveTimeSlot) {
        const existingSlots = existing.leaveTimeSlot.split(',');
        const newSlots = leaveTimeSlot.split(',');
        const duplicates = newSlots.filter(s => existingSlots.includes(s));
        if (duplicates.length > 0) {
          return res.status(409).json({
            error: 'Conflict',
            message: `มีการลาช่วงเวลา ${duplicates.join(', ')} ในวันที่ ${d.toLocaleDateString('th-TH')} ไปแล้ว`
          });
        }
      }
    }

    // Check for existing absent attendance that blocks leave
    const existingAttendances = await prisma.attendance.findMany({
      where: { userId, attendanceDate: { in: datesToLeave } }
    });
    const attendanceMap = new Map(existingAttendances.map(a => [a.attendanceDate.toISOString(), a]));

    for (const d of datesToLeave) {
      const att = attendanceMap.get(d.toISOString());
      if (!att) continue;

      if (att.status === 'absent') {
        return res.status(409).json({ error: 'Conflict', message: `แอดมินได้เช็คขาดในวันที่ ${d.toLocaleDateString('th-TH')} ไปแล้ว ไม่สามารถลาได้` });
      }

      if (att.timeSlots) {
        let slots = att.timeSlots;
        if (typeof slots === 'string') {
          try { slots = JSON.parse(slots); } catch (e) { slots = {}; }
        }
        
        const absentSlots = Object.entries(slots).filter(([_, status]) => status === 'absent').map(([s]) => s);
        
        if (absentSlots.length > 0) {
          if (leaveType === 'full_day') {
            return res.status(409).json({ error: 'Conflict', message: `มีการเช็คขาดในช่วงเวลา ${absentSlots.join(', ')} ไปแล้วในวันที่ ${d.toLocaleDateString('th-TH')} ไม่สามารถลาทั้งวันได้` });
          } else if (leaveType === 'partial' && leaveTimeSlot) {
            const requestedSlots = leaveTimeSlot.split(',');
            const overlap = requestedSlots.filter(s => absentSlots.includes(s));
            if (overlap.length > 0) {
              return res.status(409).json({ error: 'Conflict', message: `คุณถูกเช็คขาดในเวลา ${overlap.join(', ')} ไปแล้ว ไม่สามารถลาได้` });
            }
          }
        }
      }
    }

    let image = null;
    if (req.file) {
      image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    }

    const firstCreatedLeave = await prisma.$transaction(async (tx) => {
      let firstLeave = null;
      for (const d of datesToLeave) {
        const existing = existingLeaveMap.get(d.toISOString());
        let created;

        if (existing && leaveType === 'partial' && existing.leaveType === 'partial') {
          // Merge slots: combine old + new unique slots
          const oldSlots = existing.leaveTimeSlot ? existing.leaveTimeSlot.split(',') : [];
          const newSlots = leaveTimeSlot ? leaveTimeSlot.split(',') : [];
          const mergedSlots = [...new Set([...oldSlots, ...newSlots])].sort().join(',');

          // Merge reasons if both are JSON per-slot objects
          let mergedReason = reason || existing.reason || null;
          if (reason && existing.reason) {
            try {
              const oldR = JSON.parse(existing.reason);
              const newR = JSON.parse(reason);
              if (typeof oldR === 'object' && typeof newR === 'object') {
                mergedReason = JSON.stringify({ ...oldR, ...newR });
              }
            } catch (e) {
              // fallback: keep new reason
              mergedReason = reason || existing.reason;
            }
          }

          created = await tx.leaveRequest.update({
            where: { id: existing.id },
            data: {
              leaveTimeSlot: mergedSlots,
              reason: mergedReason,
            },
            include: { user: { select: { id: true, username: true, number: true, icName: true, avatar: true } } },
          });

          let attendanceNewSlots = {};
          const existingAtt = attendanceMap.get(d.toISOString());
          if (existingAtt && existingAtt.timeSlots) {
            attendanceNewSlots = typeof existingAtt.timeSlots === 'string' ? JSON.parse(existingAtt.timeSlots) : { ...existingAtt.timeSlots };
            const leaveSlots = created.leaveType === 'full_day' ? (await getSettings()).attendanceSlots : created.leaveTimeSlot.split(',');
            for (const s of leaveSlots) attendanceNewSlots[s] = 'leave';
          } else {
            attendanceNewSlots = await buildTimeSlotsForLeave(created);
          }

          await tx.attendance.upsert({
            where: { userId_attendanceDate: { userId, attendanceDate: d } },
            update: { status: 'leave', timeSlots: attendanceNewSlots, note: formatLeaveNote(leaveType, mergedSlots, mergedReason) },
            create: { userId, attendanceDate: d, status: 'leave', timeSlots: attendanceNewSlots, note: formatLeaveNote(leaveType, mergedSlots, mergedReason) },
          });
        } else {
          // Create new leave record
          created = await tx.leaveRequest.create({
            data: {
              userId,
              leaveDate: d,
              leaveType,
              leaveTimeSlot: leaveType === 'partial' ? leaveTimeSlot : null,
              reason: reason || null,
              image,
              status: 'approved',
            },
            include: { user: { select: { id: true, username: true, number: true, icName: true, avatar: true } } },
          });

          let attendanceNewSlots = {};
          const existingAtt = attendanceMap.get(d.toISOString());
          if (existingAtt && existingAtt.timeSlots) {
            attendanceNewSlots = typeof existingAtt.timeSlots === 'string' ? JSON.parse(existingAtt.timeSlots) : { ...existingAtt.timeSlots };
            const leaveSlots = created.leaveType === 'full_day' ? (await getSettings()).attendanceSlots : created.leaveTimeSlot.split(',');
            for (const s of leaveSlots) attendanceNewSlots[s] = 'leave';
          } else {
            attendanceNewSlots = await buildTimeSlotsForLeave(created);
          }

          await tx.attendance.upsert({
            where: { userId_attendanceDate: { userId, attendanceDate: d } },
            update: { status: 'leave', timeSlots: attendanceNewSlots, note: formatLeaveNote(leaveType, leaveTimeSlot, reason) },
            create: { userId, attendanceDate: d, status: 'leave', timeSlots: attendanceNewSlots, note: formatLeaveNote(leaveType, leaveTimeSlot, reason) },
          });
        }

        if (!firstLeave) firstLeave = created;
      }
      return firstLeave;
    });

    logActivity({
      userId,
      action: 'LEAVE_REQUEST',
      details: { leaveId: firstCreatedLeave.id, leaveDate, endDate, leaveType, leaveTimeSlot, totalDays: datesToLeave.length },
      ipAddress: getIp(req),
    });

    firstCreatedLeave.endDate = endDate || leaveDate; // Attach for discord to use
    sendLeaveDiscordNotification(firstCreatedLeave, req.user);

    // Sync fines for all dates in range
    for (const d of datesToLeave) {
      await syncFinesForDate(userId, d);
    }

    res.status(201).json(firstCreatedLeave);
  } catch (err) {
    next(err);
  }
});

router.get('/', validate(leaveQuerySchema), async (req, res, next) => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query);
    const { userId, dateFrom, dateTo } = req.query;
    const isAdmin = req.user.role === 'admin';

    const where = {};
    if (!isAdmin) where.userId = req.user.id;
    else if (userId) where.userId = userId;

    if (dateFrom || dateTo) {
      where.leaveDate = {};
      if (dateFrom) where.leaveDate.gte = startOfDay(new Date(dateFrom));
      if (dateTo) where.leaveDate.lte = startOfDay(new Date(dateTo));
    }

    const [records, total] = await Promise.all([
      prisma.leaveRequest.findMany({
        where,
        skip,
        take: limit,
        include: { user: { select: { id: true, username: true, number: true, icName: true } } },
        orderBy: { leaveDate: 'desc' },
      }),
      prisma.leaveRequest.count({ where }),
    ]);

    res.json(
      paginatedResponse(
        records.map(({ image, ...rest }) => ({ ...rest, hasImage: !!image })),
        total,
        page,
        limit
      )
    );
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const leave = await prisma.leaveRequest.findUnique({
      where: { id: req.params.id },
      include: { user: { select: { id: true, username: true, number: true, icName: true } } },
    });

    if (!leave) {
      return res.status(404).json({ error: 'Not Found', message: 'Leave request not found' });
    }

    if (req.user.role !== 'admin' && leave.userId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden', message: 'Access denied' });
    }

    res.json(leave);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const leave = await prisma.leaveRequest.findUnique({
      where: { id: req.params.id },
      include: { user: true },
    });

    if (!leave) {
      return res.status(404).json({ error: 'Not Found', message: 'ไม่พบข้อมูลการลา' });
    }

    if (req.user.role !== 'admin' && leave.userId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden', message: 'ไม่มีสิทธิ์ยกเลิกการลานี้' });
    }

    if (leave.leaveDate < startOfDay()) {
      return res.status(400).json({ error: 'Bad Request', message: 'ไม่สามารถยกเลิกการลาย้อนหลังได้' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.leaveRequest.delete({ where: { id: req.params.id } });
      
      const attendance = await tx.attendance.findUnique({
        where: { userId_attendanceDate: { userId: leave.userId, attendanceDate: leave.leaveDate } }
      });

      if (attendance) {
        let currentSlots = {};
        if (attendance.timeSlots) {
          currentSlots = typeof attendance.timeSlots === 'string' 
            ? JSON.parse(attendance.timeSlots) 
            : attendance.timeSlots;
        }

        let hasPresent = false;
        // Revert 'leave' to 'present' (ตามที่ผู้ใช้ต้องการ)
        for (const slot in currentSlots) {
          if (currentSlots[slot] === 'leave') {
            currentSlots[slot] = 'present';
          }
          if (currentSlots[slot] === 'present') {
            hasPresent = true;
          }
        }

        await tx.attendance.update({
          where: { id: attendance.id },
          data: {
            timeSlots: currentSlots,
            status: hasPresent ? 'present' : 'absent',
            note: null,
          },
        });
      }
    });

    logActivity({
      userId: req.user.id,
      action: 'CANCEL_LEAVE',
      details: { leaveId: req.params.id, leaveDate: leave.leaveDate },
      ipAddress: getIp(req),
    });

    sendCancelLeaveDiscordNotification(leave, leave.user);

    await syncFinesForDate(leave.userId, leave.leaveDate);

    res.json({ message: 'ยกเลิกการลาสำเร็จ' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
