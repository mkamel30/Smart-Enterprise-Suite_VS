const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.branch.findMany({ select: { code: true, name: true } }).then(r => {
  console.log(JSON.stringify(r, null, 2));
  process.exit(0);
}).catch(e => {
  console.error(e);
  process.exit(1);
});
