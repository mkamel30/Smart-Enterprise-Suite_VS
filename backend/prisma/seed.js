const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Create Default Branch
  const mainBranch = await prisma.branch.upsert({
    where: { code: 'BR001' },
    update: {},
    create: {
      name: 'الفرع الرئيسي',
      code: 'BR001',
      address: 'القاهرة',
      phone: '0123456789',
      isActive: true,
    },
  });
  console.log(`Created branch: ${mainBranch.name}`);

  // 2. Create Super Admin
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: hashedPassword,
      displayName: 'المدير العام',
      role: 'SUPER_ADMIN',
      isActive: true,
      branchId: mainBranch.id,
    },
  });
  console.log(`Created user: ${admin.username}`);

  // 3. Create default parameters if they don't exist
  const count = await prisma.machineParameter.count();
  if (count === 0) {
    await prisma.machineParameter.createMany({
      data: [
        { type: 'BRAND', value: 'PAX' },
        { type: 'BRAND', value: 'Verifone' },
        { type: 'BRAND', value: 'Nexgo' },
        { type: 'MODEL', value: 'S90' },
        { type: 'MODEL', value: 'S910' },
        { type: 'MODEL', value: 'A920' },
      ],
    });
    console.log('Created default machine parameters');
  }

  console.log('Seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
