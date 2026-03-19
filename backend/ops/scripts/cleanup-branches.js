const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const branches = await prisma.$queryRaw`SELECT code, name FROM Branch`;
  console.log('Branches:', branches.map(b => `${b.code} - ${b.name}`).join(', '));
  
  const users = await prisma.$queryRaw`SELECT id, username, role, branchId FROM User LIMIT 10`;
  console.log('\nUsers:', users.map(u => `${u.username}(${u.role}) branch=${u.branchId}`).join(', '));
  
  await prisma.$disconnect();
  process.exit(0);
}

check().catch(async e => { 
  console.error(e.message);
  await prisma.$disconnect();
  process.exit(1); 
});
