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
    const { userId } = req.query;

    if (req.user.role === 'admin' || req.user.role === 'head') {
      if (userId) where.userId = userId;
    } else {
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

// PUT /fines/:userId/pay - แอดมินกดเคลียร์ยอด (ชำระแล้ว)
router.put('/:userId/pay', managerMiddleware, async (req, res, next) => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Mark all unpaid fines as paid
    const updated = await prisma.fine.updateMany({
      where: { userId, isPaid: false },
      data: { isPaid: true }
    });

    logActivity({
      userId: req.user.id,
      action: 'PAY_FINES',
      details: { targetUserId: userId, clearedCount: updated.count },
      ipAddress: getIp(req),
    });

    res.json({ message: 'ชำระค่าปรับเรียบร้อยแล้ว', count: updated.count });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
