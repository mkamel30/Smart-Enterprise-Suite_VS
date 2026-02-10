const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function fixAndReturnMachines() {
  const serials = ['3D498840', '2330124266'];
  
  console.log('🔍 Checking machines...\n');
  
  for (const serial of serials) {
    try {
      // Find the machine
      const machine = await db.warehouseMachine.findFirst({
        where: { serialNumber: serial },
        include: {
          branch: true
        }
      });
      
      if (!machine) {
        console.log(`❌ Machine ${serial} NOT FOUND in warehouse`);
        continue;
      }
      
      console.log(`\n📱 Machine: ${serial}`);
      console.log(`   Current Status: ${machine.status}`);
      console.log(`   Current Branch: ${machine.branch?.name || machine.branchId}`);
      console.log(`   Origin Branch ID: ${machine.originBranchId || 'Not set'}`);
      
      // Check if it's at the center
      const centerBranch = await db.branch.findFirst({
        where: { type: 'MAINTENANCE_CENTER' }
      });
      
      if (!centerBranch) {
        console.log(`   ❌ No maintenance center found!`);
        continue;
      }
      
      console.log(`   Center Branch ID: ${centerBranch.id}`);
      
      // If machine is at center or needs to be moved
      if (machine.branchId === centerBranch.id || machine.status === 'RECEIVED_AT_CENTER') {
        console.log(`   ✅ Machine is at center`);
        
        // Check if we can return it (must be REPAIRED, REPAIR_REJECTED, or TOTAL_LOSS)
        const returnableStatuses = ['REPAIRED', 'REPAIR_REJECTED', 'TOTAL_LOSS'];
        
        if (!returnableStatuses.includes(machine.status)) {
          console.log(`   ⚠️  Status is ${machine.status}, needs to be REPAIRED/TOTAL_LOSS to return`);
          
          // Let's mark it as REPAIRED so it can be returned
          console.log(`   🔄 Marking as REPAIRED...`);
          await db.warehouseMachine.update({
            where: { id: machine.id },
            data: { 
              status: 'REPAIRED',
              updatedAt: new Date()
            }
          });
          console.log(`   ✅ Status updated to REPAIRED`);
        }
        
        // Now create a return order
        if (machine.originBranchId) {
          console.log(`   📦 Creating return order...`);
          
          const orderNumber = `RET-${Date.now()}-${serial.slice(-4)}`;
          
          const returnOrder = await db.transferOrder.create({
            data: {
              orderNumber,
              fromBranchId: centerBranch.id,
              toBranchId: machine.originBranchId,
              type: 'RETURN_TO_BRANCH',
              status: 'PENDING',
              notes: `Automatic return for stuck machine ${serial}`,
              items: {
                create: [{
                  serialNumber: serial,
                  type: 'MACHINE',
                  model: machine.model || 'Unknown',
                  manufacturer: machine.manufacturer || 'Unknown'
                }]
              }
            }
          });
          
          console.log(`   ✅ Return order created: ${orderNumber}`);
          console.log(`   📋 Order ID: ${returnOrder.id}`);
          
          // Update machine to ready for return
          await db.warehouseMachine.update({
            where: { id: machine.id },
            data: { 
              status: 'READY_FOR_RETURN',
              updatedAt: new Date()
            }
          });
          
          console.log(`   ✅ Machine marked as READY_FOR_RETURN`);
          
          // Log the action
          await db.systemLog.create({
            data: {
              entityType: 'WAREHOUSE_MACHINE',
              entityId: serial,
              action: 'RETURN_SCHEDULED',
              details: `Machine automatically scheduled for return to branch ${machine.originBranchId}`,
              branchId: centerBranch.id,
              performedBy: 'System Fix Script'
            }
          });
          
        } else {
          console.log(`   ❌ Cannot return: No origin branch set!`);
          
          // Try to find origin from transfer orders
          const transfer = await db.transferOrder.findFirst({
            where: {
              items: {
                some: { serialNumber: serial }
              },
              type: { in: ['SEND_TO_CENTER', 'MAINTENANCE'] }
            },
            orderBy: { createdAt: 'desc' }
          });
          
          if (transfer) {
            console.log(`   🔍 Found origin from transfer order: ${transfer.fromBranchId}`);
            
            // Update machine with origin
            await db.warehouseMachine.update({
              where: { id: machine.id },
              data: { originBranchId: transfer.fromBranchId }
            });
            
            console.log(`   ✅ Updated machine with origin branch`);
            
            // Create return order
            const orderNumber = `RET-${Date.now()}-${serial.slice(-4)}`;
            
            const returnOrder = await db.transferOrder.create({
              data: {
                orderNumber,
                fromBranchId: centerBranch.id,
                toBranchId: transfer.fromBranchId,
                type: 'RETURN_TO_BRANCH',
                status: 'PENDING',
                notes: `Automatic return for stuck machine ${serial}`,
                items: {
                  create: [{
                    serialNumber: serial,
                    type: 'MACHINE',
                    model: machine.model || 'Unknown',
                    manufacturer: machine.manufacturer || 'Unknown'
                  }]
                }
              }
            });
            
            console.log(`   ✅ Return order created: ${orderNumber}`);
            
            // Update machine
            await db.warehouseMachine.update({
              where: { id: machine.id },
              data: { 
                status: 'READY_FOR_RETURN',
                originBranchId: transfer.fromBranchId,
                updatedAt: new Date()
              }
            });
            
            console.log(`   ✅ Machine marked as READY_FOR_RETURN`);
          }
        }
      } else {
        console.log(`   ⚠️  Machine is NOT at center (branch: ${machine.branchId})`);
      }
      
    } catch (error) {
      console.error(`   ❌ Error processing ${serial}:`, error.message);
    }
  }
  
  console.log('\n✨ Done!');
  await db.$disconnect();
}

fixAndReturnMachines();
