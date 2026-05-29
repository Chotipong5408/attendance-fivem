const LEAVE_TIME_SLOTS = ['19:30', '20:00', '20:30', '21:00', '21:30', '22:00', '22:30'];

function formatLeaveNote(leaveType, leaveTimeSlot, reason) {
  let note = leaveType === 'full_day' ? 'ลาทั้งวัน' : `ลา ${leaveTimeSlot ? leaveTimeSlot.split(',').join(', ') : ''}`.trim();
  if (reason) note += ` — ${reason}`;
  return note;
}

module.exports = { LEAVE_TIME_SLOTS, formatLeaveNote };
