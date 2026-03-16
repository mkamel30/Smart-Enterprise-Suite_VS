const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const bcrypt = require('bcryptjs');
const logger = require('./utils/logger');
const prisma = new PrismaClient();

async function main() {
  logger.info('--- Seeding Central Admin Portal ---');

  // 1. Create Super Admin
  const adminPassword = 'admin_password_2026';
  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.adminUser.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash: hashedPassword,
      name: 'Super Admin',
      role: 'SUPER_ADMIN'
    }
  });

  logger.info({ username: admin.username }, 'Admin created');

  // 2. Default Parameters
  const defaultParams = [
    { key: 'EXCHANGE_RATE', value: '50.5', type: 'NUMBER', group: 'FINANCE' },
    { key: 'SYSTEM_NAME', value: 'Smart Enterprise Suite', type: 'STRING', group: 'SYSTEM' },
    { key: 'MAINTENANCE_FEE', value: '500', type: 'NUMBER', group: 'MAINTENANCE' }
  ];

  for (const param of defaultParams) {
    await prisma.globalParameter.upsert({
      where: { key: param.key },
      update: {},
      create: param
    });
  }

  logger.info(`${defaultParams.length} Default parameters seeded.`);
}

main()
  .catch((e) => {
    logger.error({ err: e }, 'Seeding failed');
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
