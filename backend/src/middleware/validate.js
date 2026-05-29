const { z } = require('zod');
const { LEAVE_TIME_SLOTS } = require('../utils/leaveSlots');

function validate(schema) {
  return (req, res, next) => {
    try {
      const parsed = schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      req.body = parsed.body ?? req.body;
      req.query = parsed.query ?? req.query;
      req.params = parsed.params ?? req.params;
      next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation Error',
          message: err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '),
        });
      }
      next(err);
    }
  };
}

const loginSchema = z.object({
  body: z.object({
    username: z.string().min(1, 'Username is required'),
    password: z.string().min(1, 'Password is required'),
  }),
});

const createUserSchema = z.object({
  body: z.object({
    icName: z.string().min(2, 'IC Name ต้องมีอย่างน้อย 2 ตัวอักษร').max(50),
    password: z.string().min(4, 'Password ต้องมีอย่างน้อย 4 ตัวอักษร').max(100),
    number: z.string().min(1, 'หมายเลข/รหัสพนักงาน จำเป็น').max(50),
    role: z.enum(['user', 'head', 'admin']).optional().default('user'),
  }),
});

const updateUserSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    icName: z.string().min(2).max(50).optional(),
    password: z.string().min(4).max(100).optional().or(z.literal('')),
    number: z.string().max(50).optional().nullable().or(z.literal('')),
    role: z.enum(['user', 'head', 'admin']).optional(),
  }),
});

const deleteUserSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

const markAbsentSchema = z.object({
  body: z.object({
    userId: z.string().uuid(),
    date: z.string().min(1),
    note: z.string().max(500).optional(),
  }),
});

const attendanceQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    status: z.enum(['present', 'absent', 'leave']).optional(),
    username: z.string().optional(),
    userId: z.string().uuid().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    search: z.string().optional(),
    date: z.string().optional(),
  }),
});

const leaveSchema = z.object({
  body: z.object({
    leaveDate: z.string().min(1, 'Leave date required'),
    endDate: z.string().optional(),
    leaveType: z.enum(['full_day', 'partial']),
    leaveTimeSlot: z.string().optional(),
    reason: z.string().max(1000).optional(),
  }).refine(
    (data) => data.leaveType === 'full_day' || !!data.leaveTimeSlot,
    { message: 'leaveTimeSlot required for partial leave', path: ['leaveTimeSlot'] }
  ),
});

const leaveQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    userId: z.string().uuid().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
  }),
});

module.exports = {
  validate,
  loginSchema,
  createUserSchema,
  updateUserSchema,
  deleteUserSchema,
  markAbsentSchema,
  attendanceQuerySchema,
  leaveSchema,
  leaveQuerySchema,
};
