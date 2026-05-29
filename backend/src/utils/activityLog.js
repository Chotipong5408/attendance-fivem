const prisma = require('../lib/prisma');



async function logActivity({ userId, action, details, ipAddress }) {
  try {
    await prisma.activityLog.create({
      data: {
        userId: userId || null,
        action,
        details: details ? JSON.stringify(details) : null,
        ipAddress: ipAddress || null,
      },
    });
  } catch (err) {
    console.error('Activity log error:', err.message);
  }
}

module.exports = { logActivity };
