const express = require('express');
const { getSettings, saveSettings } = require('../utils/settings');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

// Allow any authenticated user to GET settings, but only admin to PUT
router.get('/slots', async (req, res, next) => {
  try {
    const settings = await getSettings();
    res.json(settings);
  } catch (err) {
    next(err);
  }
});

router.put('/slots', authMiddleware, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden', message: 'Only admin can modify settings' });
    }

    const { attendanceSlots, leaveSlots, absentFine, excessLeaveFine, maxLeavesPerWeek } = req.body;
    
    if (!Array.isArray(attendanceSlots) || !Array.isArray(leaveSlots)) {
      return res.status(400).json({ error: 'Bad Request', message: 'Slots must be arrays of strings' });
    }

    const currentSettings = await getSettings();

    const newSettings = {
      ...currentSettings,
      attendanceSlots: attendanceSlots.map(String),
      leaveSlots: leaveSlots.map(String),
      absentFine: typeof absentFine === 'number' ? absentFine : currentSettings.absentFine || 50000,
      excessLeaveFine: typeof excessLeaveFine === 'number' ? excessLeaveFine : currentSettings.excessLeaveFine || 50000,
      maxLeavesPerWeek: typeof maxLeavesPerWeek === 'number' ? maxLeavesPerWeek : currentSettings.maxLeavesPerWeek || 4,
    };

    await saveSettings(newSettings);
    res.json(newSettings);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
