/**
 * One-time script to migrate settings from data/settings.json to the database.
 * Run: node scripts/migrate-settings-to-db.js
 */
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const SETTINGS_FILE = path.join(__dirname, '..', 'data', 'settings.json');
const SETTINGS_KEY = 'app_settings';

async function main() {
  const prisma = new PrismaClient();

  try {
    // Check if settings already exist in DB
    const existing = await prisma.systemSetting.findUnique({
      where: { key: SETTINGS_KEY },
    });

    if (existing) {
      console.log('Settings already exist in database:');
      console.log(JSON.parse(existing.value));
      console.log('\nSkipping migration. Delete the DB row first if you want to re-import.');
      return;
    }

    // Read from JSON file
    if (!fs.existsSync(SETTINGS_FILE)) {
      console.log('No settings.json found. The app will use defaults on first load.');
      return;
    }

    const fileContent = fs.readFileSync(SETTINGS_FILE, 'utf-8');
    const settings = JSON.parse(fileContent);

    console.log('Migrating settings from file to database:');
    console.log(settings);

    // Write to DB
    await prisma.systemSetting.create({
      data: {
        key: SETTINGS_KEY,
        value: JSON.stringify(settings),
      },
    });

    console.log('\n✅ Settings migrated successfully to database!');
    console.log('You can now safely delete data/settings.json if desired.');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
