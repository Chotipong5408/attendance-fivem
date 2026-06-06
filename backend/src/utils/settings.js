const prisma = require('../lib/prisma');

const SETTINGS_KEY = 'app_settings';

const DEFAULT_SETTINGS = {
  attendanceSlots: ['19:30', '20:00', '22:00', '22:30'],
  leaveSlots: ['19:30', '20:00', '20:30', '21:30', '22:00', '22:30'],
  absentFine: 50000,
  excessLeaveFine: 50000,
  maxLeavesPerWeek: 4
};

// In-memory cache to avoid hitting DB on every request
let cachedSettings = null;

async function getSettings() {
  // Return cached settings if available
  if (cachedSettings) return cachedSettings;

  try {
    const row = await prisma.systemSetting.findUnique({
      where: { key: SETTINGS_KEY },
    });

    if (row) {
      cachedSettings = JSON.parse(row.value);
      return cachedSettings;
    }

    // No row found — initialize with defaults
    await saveSettings(DEFAULT_SETTINGS);
    return DEFAULT_SETTINGS;
  } catch (error) {
    console.error('Failed to read settings from DB:', error);
    // Fallback to defaults but don't cache so we retry on next call
    return DEFAULT_SETTINGS;
  }
}

async function saveSettings(settings) {
  try {
    await prisma.systemSetting.upsert({
      where: { key: SETTINGS_KEY },
      update: { value: JSON.stringify(settings) },
      create: { key: SETTINGS_KEY, value: JSON.stringify(settings) },
    });

    // Update cache
    cachedSettings = settings;
  } catch (error) {
    console.error('Failed to save settings to DB:', error);
    throw error;
  }
}

module.exports = { getSettings, saveSettings };
