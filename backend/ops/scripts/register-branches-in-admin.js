const path = require('path');
const { PrismaClient } = require('@prisma/client');

const adminDbPath = 'C:\\Users\\mkame\\OneDrive\\Documents\\GitHub\\SmartEnterprise_AD\\backend\\prisma\\dev.db';

const prisma = new PrismaClient({
  datasources: { db: { url: `file:${adminDbPath}` } }
});

async function main() {
  console.log('=== Registering Branches in Admin Portal ===\n');

  const branches = [
    { name: 'الإدارة المركزية (IT)', code: 'IT001', type: 'CENTRAL' },
    { name: 'القاهرة-الجيش', code: 'BR001', type: 'BRANCH' }
  ];

  let br001ApiKey = null;

  for (const b of branches) {
    const existing = await prisma.branch.findFirst({ where: { code: b.code } });
    if (existing) {
      console.log(`  ${b.code} [${b.name}] — already exists (API Key: ${existing.apiKey ? 'SET' : 'MISSING'})`);
      if (b.code === 'BR001') br001ApiKey = existing.apiKey;
    } else {
      const crypto = require('crypto');
      const apiKey = crypto.randomBytes(32).toString('hex');
      const branch = await prisma.branch.create({
        data: { name: b.name, code: b.code, type: b.type, apiKey, status: 'OFFLINE' }
      });
      console.log(`  ${b.code} [${b.name}] — CREATED`);
      console.log(`    API Key: ${apiKey}`);
      if (b.code === 'BR001') br001ApiKey = apiKey;
    }
  }

  console.log('\n=== Admin Portal Branches ===');
  const allBranches = await prisma.branch.findMany({ select: { code: true, name: true, apiKey: true, status: true } });
  allBranches.forEach(b => console.log(`  ${b.code} | ${b.name} | ${b.status} | Key: ${b.apiKey ? 'YES' : 'NO'}`));

  if (br001ApiKey) {
    console.log('\n=== Update backend/.env ===');
    console.log(`BRANCH_CODE=BR001`);
    console.log(`PORTAL_API_KEY=${br001ApiKey}`);
  }
}

main()
  .catch(e => { console.error('Error:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
