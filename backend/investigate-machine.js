const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function investigateMachine(serial) {
    try {
        console.log(`--- Investigating Machine: ${serial} ---`);

        // 1. Check PosMachine (Customer Current Machines)
        const posMachine = await prisma.posMachine.findFirst({
            where: { serialNumber: serial },
            include: { customer: true, branch: true }
        });

        if (posMachine) {
            console.log('Found in PosMachine:');
            console.log(`- Customer: ${posMachine.customer?.client_name} (${posMachine.customer?.bkcode})`);
            console.log(`- Branch: ${posMachine.branch?.name}`);
            console.log(`- Status: ${posMachine.status}`);
            console.log(`- ID: ${posMachine.id}`);
        } else {
            console.log('Not found in PosMachine');
        }

        // 2. Check WarehouseMachine
        const whMachine = await prisma.warehouseMachine.findFirst({
            where: { serialNumber: serial },
            include: { branch: true }
        });

        if (whMachine) {
            console.log('\nFound in WarehouseMachine:');
            console.log(`- Branch: ${whMachine.branch?.name}`);
            console.log(`- Status: ${whMachine.status}`);
            console.log(`- Customer Name (Alt): ${whMachine.customerName}`);
            console.log(`- Customer ID (Alt): ${whMachine.customerId}`);
        } else {
            console.log('Not found in WarehouseMachine');
        }

        // 3. Check MachineMovementLog
        const movements = await prisma.machineMovementLog.findMany({
            where: { serialNumber: serial },
            orderBy: { createdAt: 'desc' }
        });

        console.log(`\n--- Machine Movement Logs (${movements.length}) ---`);
        movements.forEach(m => {
            console.log(`[${m.createdAt.toISOString()}] ${m.action} | Branch: ${m.branchId} | PerformedBy: ${m.performedBy}`);
            console.log(`  Details: ${m.details}`);
        });

        // 4. Check SystemLog
        const systemLogs = await prisma.systemLog.findMany({
            where: { details: { contains: serial } },
            orderBy: { createdAt: 'desc' }
        });

        console.log(`\n--- System Logs (${systemLogs.length}) ---`);
        systemLogs.forEach(l => {
            console.log(`[${l.createdAt.toISOString()}] ${l.action} | ${l.details}`);
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

investigateMachine('3C7820010');
