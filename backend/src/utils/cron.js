const cron = require('node-cron');
const { ensureAllUsersAttendanceForDate } = require('./autoAttendance');

function startAutoAttendanceCron() {
  // ไม่ต้องใช้ cron แล้ว ให้ auto generate record ตอนเปิดหน้า /daily เลย

}

module.exports = { startAutoAttendanceCron };
