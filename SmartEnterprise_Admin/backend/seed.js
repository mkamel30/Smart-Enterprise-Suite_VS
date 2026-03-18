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

  const recoveryKey = Math.random().toString(36).substring(2, 10).toUpperCase();

  const admin = await prisma.adminUser.upsert({
    where: { username: 'admin' },
    update: {
      // If recoveryKey is null, set it, otherwise keep existing
    },
    create: {
      username: 'admin',
      passwordHash: hashedPassword,
      name: 'Super Admin',
      role: 'SUPER_ADMIN',
      recoveryKey: recoveryKey
    }
  });

  // Force update if recoveryKey is null
  let finalAdmin = await prisma.adminUser.findUnique({ where: { username: 'admin' } });
  if (!finalAdmin.recoveryKey) {
    finalAdmin = await prisma.adminUser.update({
        where: { username: 'admin' },
        data: { recoveryKey: recoveryKey }
    });
  }
  
  logger.info({ 
    username: admin.username, 
    recoveryKey: finalAdmin.recoveryKey 
  }, 'Admin created/verified');

  console.log('==========================================');
  console.log('SUPER ADMIN RECOVERY KEY: ' + finalAdmin.recoveryKey);
  console.log('KEEP THIS KEY SAFE FOR PASSWORD RESET');
  console.log('==========================================');

  // 2. Default Parameters
  const defaultParams = [
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

  // 3. POS Machine Parameters
  const posParams = [
    { prefix: '191', model: 'S90', manufacturer: 'PAX' },
    { prefix: '203', model: 'A920', manufacturer: 'PAX' },
    { prefix: 'N86', model: 'N86', manufacturer: 'NEXGO' }
  ];

  for (const posP of posParams) {
    await prisma.machineParameter.upsert({
      where: { prefix: posP.prefix },
      update: {},
      create: posP
    });
  }
  logger.info('POS Parameters seeded.');

  // 4. Master Spare Parts
  const masterParts = [
    { partNumber: 'BATT-S90', name: 'S90 Battery', defaultCost: 450, category: 'POS', isConsumable: true },
    { partNumber: 'PRN-ROLL', name: 'Thermal Paper Roll', defaultCost: 15, category: 'GENERAL', isConsumable: true },
    { partNumber: 'LCD-A920', name: 'A920 Screen Assembly', defaultCost: 1200, category: 'POS', isConsumable: false }
  ];

  for (const part of masterParts) {
    await prisma.masterSparePart.upsert({
      where: { partNumber: part.partNumber },
      update: {},
      create: part
    });
  }
  logger.info('Master Spare Parts seeded.');
}

main()
  .catch((e) => {
    logger.error({ err: e }, 'Seeding failed');
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
