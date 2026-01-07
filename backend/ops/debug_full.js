// MOVED TO backend/ops - guarded execution
// To run: set LEGACY_OPS_ALLOW=1 and optionally DRY_RUN=1 to review behavior
if (process.env.LEGACY_OPS_ALLOW !== '1') {
  console.error('Legacy script is guarded. Set LEGACY_OPS_ALLOW=1 to run.');
  process.exit(1);
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Order TO-20251225-003 ---');
    const order = await prisma.transferOrder.findFirst({
        where: { orderNumber: 'TO-20251225-003' }
    });
    console.log(JSON.stringify(order, null, 2));

    console.log('\n--- All Transfer Orders ---');
    const allOrders = await prisma.transferOrder.findMany({
        select: { id: true, orderNumber: true, toBranchId: true, fromBranchId: true }
    });
    console.log(JSON.stringify(allOrders, null, 2));

    console.log('\n--- All Users ---');
    const users = await prisma.user.findMany({
        select: { id: true, displayName: true, role: true, branchId: true }
    });
    console.log(JSON.stringify(users, null, 2));
}

main().finally(() => prisma.$disconnect());
