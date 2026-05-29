require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const username = process.env.SEED_ADMIN_USERNAME || 'Admin';
  const rawPassword = process.env.SEED_ADMIN_PASSWORD || 'admin123';

  const hashedPassword = await bcrypt.hash(rawPassword, 12);

  const admin = await prisma.user.upsert({
    where: { username },
    update: { icName: username, password: hashedPassword, role: 'admin' },
    create: {
      username,
      icName: username,
      number: 'ADMIN-001',
      password: hashedPassword,
      role: 'admin',
    },
  });

  console.log('Seed completed. Admin account:');
  console.log('  Username:', admin.username);
  console.log('  Password:', rawPassword);
  console.log('  User ID:', admin.id);
  console.log('  (Login with the password above)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
