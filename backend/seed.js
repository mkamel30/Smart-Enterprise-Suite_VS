const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const bcrypt = require('bcryptjs');

async function main() {
  const prisma = new PrismaClient();
  
  try {
    const password = 'Mk@351762';
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.upsert({
      where: { username: 'Admin@' },
      update: {
        password: hashedPassword,
        displayName: 'مدير النظام',
        role: 'ADMIN',
        isActive: true,
        email: 'admin@branch.local'
      },
      create: {
        username: 'Admin@',
        password: hashedPassword,
        displayName: 'مدير النظام',
        role: 'ADMIN',
        isActive: true,
        email: 'admin@branch.local'
      }
    });

    console.log('==========================================');
    console.log('Test user created: Admin@ / ' + password);
    console.log('==========================================');
  } catch (error) {
    console.error('Seed error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
