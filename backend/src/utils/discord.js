const config = require('../config');

async function sendLeaveDiscordNotification(leave, user) {
  const webhookUrl = config.discordWebhookUrl;
  if (!webhookUrl) return;

  const timeLabel =
    leave.leaveType === 'full_day' ? 'ลาทั้งวัน' : `ลาเวลา ${leave.leaveTimeSlot || '-'}`;

  const startDateStr = new Date(leave.leaveDate).toLocaleDateString('th-TH');
  let dateValue = startDateStr;
  if (leave.endDate && new Date(leave.endDate).getTime() > new Date(leave.leaveDate).getTime()) {
    const endDateStr = new Date(leave.endDate).toLocaleDateString('th-TH');
    dateValue = `${startDateStr} - ${endDateStr}`;
  }

  const embed = {
    title: '📋 แจ้งลา',
    color: 0x6366f1,
    thumbnail: user.avatar ? { url: user.avatar } : undefined,
    fields: [
      { name: 'IC Name', value: user.icName || user.username, inline: true },
      { name: 'หมายเลข', value: user.number || '-', inline: true },
      {
        name: 'วันที่ลา',
        value: dateValue,
        inline: true,
      },
      { name: 'ประเภท', value: timeLabel, inline: true },
      { name: 'หมายเหตุ', value: leave.reason || '-' },
    ],
    timestamp: new Date().toISOString(),
  };

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    });
  } catch (err) {
    console.error('Discord webhook error:', err.message);
  }
}

async function sendCancelLeaveDiscordNotification(leave, user) {
  const webhookUrl = config.discordWebhookUrl;
  if (!webhookUrl) return;

  const timeLabel =
    leave.leaveType === 'full_day' ? 'ลาทั้งวัน' : `ลาเวลา ${leave.leaveTimeSlot || '-'}`;

  const startDateStr = new Date(leave.leaveDate).toLocaleDateString('th-TH');
  let dateValue = startDateStr;
  if (leave.endDate && new Date(leave.endDate).getTime() > new Date(leave.leaveDate).getTime()) {
    const endDateStr = new Date(leave.endDate).toLocaleDateString('th-TH');
    dateValue = `${startDateStr} - ${endDateStr}`;
  }

  const embed = {
    title: '❌ ยกเลิกการลา',
    description: `ผู้ใช้ ${user.icName || user.username} ได้ทำการ **ยกเลิก** การลาที่เคยแจ้งไว้`,
    color: 0xef4444, // Red
    thumbnail: user.avatar ? { url: user.avatar } : undefined,
    fields: [
      { name: 'IC Name', value: user.icName || user.username, inline: true },
      { name: 'หมายเลข', value: user.number || '-', inline: true },
      {
        name: 'วันที่ลา',
        value: dateValue,
        inline: true,
      },
      { name: 'ประเภทที่เคยกดลา', value: timeLabel, inline: true },
    ],
    timestamp: new Date().toISOString(),
  };

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    });
  } catch (err) {
    console.error('Discord webhook error:', err.message);
  }
}

module.exports = { sendLeaveDiscordNotification, sendCancelLeaveDiscordNotification };
