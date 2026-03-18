const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function get() {
  const user = await prisma.adminUser.findFirst({ where: { username: 'admin' } });
  console.log('==========================================');
  console.log('ADMIN RECOVERY KEY: ' + user.recoveryKey);
  console.log('==========================================');
  await prisma.$disconnect();
}
get();
