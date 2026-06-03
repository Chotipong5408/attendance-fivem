const cron = require('node-cron');
const prisma = require('../lib/prisma');
const { ensureAllUsersAttendanceForDate } = require('./autoAttendance');

function startAutoAttendanceCron() {
  // ไม่ต้องใช้ cron แล้ว ให้ auto generate record ตอนเปิดหน้า /daily เลย
}

function startCleanupCron() {
  // รันทุกๆ วันเวลาเที่ยงคืน (00:00)
  cron.schedule('0 0 * * *', async () => {
    try {
      console.log('[Cron] Running 14-days cleanup job...');
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 14);

      // Clean ActivityLog
      const activityResult = await prisma.activityLog.deleteMany({
        where: { createdAt: { lt: cutoffDate } }
      });
      console.log(`[Cron] Deleted ${activityResult.count} old activity logs.`);

      // Clean Attendance
      const attendanceResult = await prisma.attendance.deleteMany({
        where: { attendanceDate: { lt: cutoffDate } }
      });
      console.log(`[Cron] Deleted ${attendanceResult.count} old attendance records.`);

      // Clean LeaveRequest
      const leaveResult = await prisma.leaveRequest.deleteMany({
        where: { leaveDate: { lt: cutoffDate } }
      });
      console.log(`[Cron] Deleted ${leaveResult.count} old leave requests.`);

    } catch (err) {
      console.error('[Cron] Cleanup job failed:', err);
    }
  });
}

module.exports = { startAutoAttendanceCron, startCleanupCron };
