const express = require('express');
const prisma = require('../lib/prisma');
const { hashPassword } = require('../utils/bcrypt');
const { logActivity } = require('../utils/activityLog');
const { getPaginationParams, paginatedResponse } = require('../utils/pagination');
const { userPublicSelect, toPublicUser } = require('../utils/userPublic');
const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');
const { getIp } = require('../utils/getIp');
const {
  validate,
  createUserSchema,
  updateUserSchema,
  deleteUserSchema,
} = require('../middleware/validate');

const managerMiddleware = require('../middleware/manager');

const router = express.Router();

router.use(authMiddleware);

router.get('/', managerMiddleware, async (req, res, next) => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query);
    const search = req.query.search?.trim();

    const where = search
      ? {
          OR: [
            { icName: { contains: search, mode: 'insensitive' } },
            { username: { contains: search, mode: 'insensitive' } },
            { number: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: userPublicSelect,
        orderBy: [
          { role: 'desc' },
          { createdAt: 'asc' }
        ],
      }),
      prisma.user.count({ where }),
    ]);

    res.json(
      paginatedResponse(
        users.map(toPublicUser),
        total,
        page,
        limit
      )
    );
  } catch (err) {
    next(err);
  }
});

router.post('/', adminMiddleware, validate(createUserSchema), async (req, res, next) => {
  try {
    const { icName, password, number, role } = req.body;

    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ username: icName }, { number }],
      },
    });

    if (existing) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'IC Name หรือ หมายเลขพนักงาน ถูกใช้แล้ว',
      });
    }

    const hashedPassword = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        icName,
        username: icName,
        number,
        password: hashedPassword,
        role,
      },
      select: userPublicSelect,
    });

    logActivity({
      userId: req.user.id,
      action: 'USER_CREATE',
      details: { targetUserId: user.id },
      ipAddress: getIp(req),
    });

    res.status(201).json(toPublicUser(user));
  } catch (err) {
    next(err);
  }
});

router.put('/:id', adminMiddleware, validate(updateUserSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { icName, password, number, role } = req.body;

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Not Found', message: 'User not found' });
    }

    if (icName || number) {
      const conflict = await prisma.user.findFirst({
        where: {
          AND: [
            { id: { not: id } },
            {
              OR: [
                ...(icName ? [{ username: icName }, { icName }] : []),
                ...(number ? [{ number }] : []),
              ],
            },
          ],
        },
      });
      if (conflict) {
        return res.status(409).json({
          error: 'Conflict',
          message: 'IC Name หรือ หมายเลขพนักงาน ถูกใช้แล้ว',
        });
      }
    }

    const data = {};
    if (icName) {
      data.icName = icName;
      data.username = icName;
    }
    if (number) {
      data.number = number;
    }
    if (password) {
      data.password = await hashPassword(password);
      data.passwordChangedAt = new Date();
    }
    if (role) data.role = role;

    const user = await prisma.user.update({
      where: { id },
      data,
      select: userPublicSelect,
    });

    logActivity({
      userId: req.user.id,
      action: 'USER_UPDATE',
      details: { targetUserId: id, changes: Object.keys(data) },
      ipAddress: getIp(req),
    });

    res.json(toPublicUser(user));
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', adminMiddleware, validate(deleteUserSchema), async (req, res, next) => {
  try {
    const { id } = req.params;

    if (id === req.user.id) {
      return res.status(400).json({ error: 'Bad Request', message: 'Cannot delete your own account' });
    }

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Not Found', message: 'User not found' });
    }

    await prisma.user.delete({ where: { id } });

    await logActivity({
      userId: req.user.id,
      action: 'USER_DELETE',
      details: { targetUserId: id, icName: existing.icName || existing.username },
      ipAddress: req.ip,
    });

    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
