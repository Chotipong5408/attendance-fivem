const express = require('express');
const prisma = require('../lib/prisma');
const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');
const { startOfDay, endOfDay } = require('../utils/pagination');

const router = express.Router();


router.use(authMiddleware, adminMiddleware);

function escapeCsv(value) {
  if (value == null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

router.get('/attendance', async (req, res, next) => {
  try {
    const { status, username, dateFrom, dateTo } = req.query;
    const where = {};

    if (status) where.status = status;
    if (dateFrom || dateTo) {
      where.attendanceDate = {};
      if (dateFrom) where.attendanceDate.gte = startOfDay(new Date(dateFrom));
      if (dateTo) where.attendanceDate.lte = startOfDay(new Date(dateTo));
    }
    if (username) {
      where.user = { username: { contains: username, mode: 'insensitive' } };
    }

    const records = await prisma.attendance.findMany({
      where,
      include: { user: { select: { username: true, number: true, icName: true } } },
      orderBy: { attendanceDate: 'desc' },
    });

    const statusLabels = { present: 'มา', absent: 'ขาด', leave: 'ลา' };
    const header = 'วันที่,เวลา,Username,รหัสประจำตัว,สถานะ,หมายเหตุ';
    const rows = records.map((r) =>
      [
        new Date(r.attendanceDate || r.createdAt).toLocaleDateString('th-TH'),
        new Date(r.createdAt).toLocaleTimeString('th-TH'),
        r.user.username,
        r.user.number,
        statusLabels[r.status] || r.status,
        r.note || '',
      ]
        .map(escapeCsv)
        .join(',')
    );

    const csv = '\uFEFF' + [header, ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=attendance-export.csv');
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

router.get('/leave', async (req, res, next) => {
  try {
    const { status, dateFrom, dateTo } = req.query;
    const where = {};

    if (status) where.status = status;
    if (dateFrom || dateTo) {
      where.leaveDate = {};
      if (dateFrom) where.leaveDate.gte = startOfDay(new Date(dateFrom));
      if (dateTo) where.leaveDate.lte = endOfDay(new Date(dateTo));
    }

    const records = await prisma.leaveRequest.findMany({
      where,
      include: { user: { select: { username: true, number: true, icName: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const typeLabels = { full_day: 'ลาทั้งวัน', partial: 'ลาบางช่วง' };
    const statusLabels = { pending: 'รออนุมัติ', approved: 'อนุมัติ', rejected: 'ปฏิเสธ' };
    const header = 'วันที่ลา,Username,รหัสประจำตัว,ช่วงเวลา,เหตุผล,สถานะ,วันที่ส่งคำขอ';
    const rows = records.map((r) =>
      [
        new Date(r.leaveDate).toLocaleDateString('th-TH'),
        r.user.username,
        r.user.number,
        typeLabels[r.leaveType] || r.leaveType,
        r.reason,
        statusLabels[r.status] || r.status,
        new Date(r.createdAt).toLocaleString('th-TH'),
      ]
        .map(escapeCsv)
        .join(',')
    );

    const csv = '\uFEFF' + [header, ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=leave-export.csv');
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
