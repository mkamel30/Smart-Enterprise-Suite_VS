// MOVED TO backend/ops - guarded execution
// To run: set LEGACY_OPS_ALLOW=1 and optionally DRY_RUN=1 to review behavior
if (process.env.LEGACY_OPS_ALLOW !== '1') {
  console.error('Legacy script is guarded. Set LEGACY_OPS_ALLOW=1 to run.');
  process.exit(1);
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const order = await prisma.transferOrder.findFirst({
        where: { orderNumber: 'TO-20251225-003' },
        include: { fromBranch: true, toBranch: true }
    });
    console.log('Order Info:', JSON.stringify(order, null, 2));

    const users = await prisma.user.findMany({
        where: { branchId: order?.toBranchId }
    });
    console.log('Users in Destination Branch:', JSON.stringify(users, null, 2));
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
