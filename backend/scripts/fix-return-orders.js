const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function fixReturnOrders() {
  console.log('🔧 Fixing return orders...\n');
  
  // Find all RETURN_TO_BRANCH orders without branchId
  const returnOrders = await db.transferOrder.findMany({
    where: {
      type: 'RETURN_TO_BRANCH',
      branchId: null
    },
    include: {
      items: true
    }
  });
  
  console.log(`Found ${returnOrders.length} return orders without branchId`);
  
  for (const order of returnOrders) {
    try {
      // Get the machine to find its origin branch
      const machine = await db.warehouseMachine.findFirst({
        where: {
          serialNumber: order.items[0]?.serialNumber
        }
      });
      
      if (machine && machine.originBranchId) {
        // Update the order with the correct branchId
        await db.transferOrder.update({
          where: { id: order.id },
          data: {
            branchId: machine.originBranchId
          }
        });
        
        console.log(`✅ Fixed order ${order.orderNumber} (${order.id}) - set branchId to ${machine.originBranchId}`);
      } else {
        // Fallback: use toBranchId (origin branch)
        await db.transferOrder.update({
          where: { id: order.id },
          data: {
            branchId: order.toBranchId
          }
        });
        
        console.log(`✅ Fixed order ${order.orderNumber} (${order.id}) - set branchId to ${order.toBranchId} (fallback)`);
      }
    } catch (error) {
      console.error(`❌ Failed to fix order ${order.orderNumber}: ${error.message}`);
    }
  }
  
  console.log('\n✨ Done!');
  await db.$disconnect();
}

fixReturnOrders().catch(async (error) => {
  console.error('Fatal error:', error);
  await db.$disconnect();
  process.exit(1);
});
