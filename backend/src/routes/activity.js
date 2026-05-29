const express = require('express');
const prisma = require('../lib/prisma');
const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');
const { getPaginationParams, paginatedResponse, getBangkokTimeBounds } = require('../utils/pagination');

const router = express.Router();


router.use(authMiddleware, adminMiddleware);

router.get('/', async (req, res, next) => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query);
    const { action, search, date } = req.query;

    const where = {};
    if (action && action !== 'ALL') {
      where.action = action;
    }
    
    if (search) {
      where.user = {
        OR: [
          { username: { contains: search } },
          { icName: { contains: search } },
          { number: { contains: search } }
        ]
      };
    }

    if (date) {
      const bounds = getBangkokTimeBounds(date);
      if (bounds) {
        where.createdAt = { gte: bounds.start, lte: bounds.end };
      }
    }

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: { select: { id: true, username: true, number: true, icName: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.activityLog.count({ where }),
    ]);

    res.json(paginatedResponse(logs, total, page, limit));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
