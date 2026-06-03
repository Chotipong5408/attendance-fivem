const express = require('express');
const prisma = require('../lib/prisma');
const authMiddleware = require('../middleware/auth');
const managerMiddleware = require('../middleware/manager');
const adminMiddleware = require('../middleware/admin');
const { getIp } = require('../utils/getIp');
const { logActivity } = require('../utils/activityLog');

const router = express.Router();
router.use(authMiddleware);

// GET /fines - สรุปยอดค่าปรับ
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const where = { isPaid: false };
    const { userId, scope } = req.query;

    if (req.user.role === 'admin') {
      // Admin: can see all fines, or filter by userId
      if (userId) where.userId = userId;
    } else if (req.user.role === 'head') {
      // Head: sees all fines when scope=all (AdminFines), otherwise only own fines (UserFines)
      if (scope === 'all') {
        if (userId) where.userId = userId;
      } else {
        where.userId = userId || req.user.id;
      }
    } else {
      // Regular user: only own fines
      where.userId = req.user.id;
    }

    const fines = await prisma.fine.findMany({
      where,
      include: {
        user: { select: { id: true, icName: true, username: true, number: true } }
      },
      orderBy: { date: 'desc' }
    });

    // Group by user
    const userMap = new Map();
    for (const fine of fines) {
      if (!userMap.has(fine.userId)) {
        userMap.set(fine.userId, {
          user: fine.user,
          totalAmount: 0,
          details: []
        });
      }
      const u = userMap.get(fine.userId);
      u.totalAmount += fine.amount;
      u.details.push(fine);
    }

    const summary = Array.from(userMap.values());
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

// POST /fines - เพิ่มค่าปรับ manual
router.post('/', managerMiddleware, async (req, res, next) => {
  try {
    const { userId, amount, reason } = req.body;

    if (!userId || !amount || !reason?.trim()) {
      return res.status(400).json({ message: 'กรุณากรอก userId, จำนวนเงิน และเหตุผล' });
    }

    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ message: 'จำนวนเงินไม่ถูกต้อง' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !['user', 'head'].includes(user.role)) {
      return res.status(404).json({ message: 'ไม่พบผู้ใช้' });
    }

    const fine = await prisma.fine.create({
      data: {
        userId,
        amount: parsedAmount,
        reason: reason.trim(),
        type: 'manual',
        date: new Date(),
      },
      include: {
        user: { select: { id: true, icName: true, username: true, number: true } }
      }
    });

    logActivity({
      userId: req.user.id,
      action: 'ADD_MANUAL_FINE',
      details: { targetUserId: userId, amount: parsedAmount, reason: reason.trim() },
      ipAddress: getIp(req),
    });

    res.status(201).json(fine);
  } catch (err) {
    next(err);
  }
});

// PUT /fines/:userId/pay - แอดมินกดเคลียร์ยอด (ชำระแล้ว)
router.put('/:userId/pay', managerMiddleware, async (req, res, next) => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Delete all unpaid fines instead of marking them as paid
    const deleted = await prisma.fine.deleteMany({
      where: { userId, isPaid: false }
    });

    logActivity({
      userId: req.user.id,
      action: 'PAY_FINES',
      details: { targetUserId: userId, clearedCount: deleted.count },
      ipAddress: getIp(req),
    });

    res.json({ message: 'ชำระค่าปรับเรียบร้อยแล้ว', count: deleted.count });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
