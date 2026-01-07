// MOVED TO backend/ops - guarded execution
// To run: set LEGACY_OPS_ALLOW=1 and optionally DRY_RUN=1 to review behavior
if (process.env.LEGACY_OPS_ALLOW !== '1') {
  console.error('Legacy script is guarded. Set LEGACY_OPS_ALLOW=1 to run.');
  process.exit(1);
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const orderNum = 'TO-20251225-003';
    console.log('Querying for order:', orderNum);
    const order = await prisma.transferOrder.findFirst({
        where: { orderNumber: orderNum },
        include: { fromBranch: true, toBranch: true }
    });

    if (!order) {
        console.log('Order not found!');
        return;
    }

    console.log('Order Details:');
    console.log('- ID:', order.id);
    console.log('- fromBranchId:', order.fromBranchId, '(', order.fromBranch?.name, ')');
    console.log('- toBranchId:', order.toBranchId, '(', order.toBranch?.name, ')');
    console.log('- status:', order.status);

    // Find all users and check their branchId
    const users = await prisma.user.findMany();
    console.log('\nUsers List:');
    users.forEach(u => {
        console.log(`- ${u.displayName} (Role: ${u.role}, BranchId: ${u.branchId})`);
    });
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
