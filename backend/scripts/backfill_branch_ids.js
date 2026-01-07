const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function backfill() {
    console.log('Starting comprehensive branchId backfill...');

    // 1. Backfill RepairVouchers from their Requests
    const vouchers = await prisma.repairVoucher.findMany({
        where: { branchId: null },
        include: { request: true }
    });
    console.log(`Found ${vouchers.length} orphaned vouchers.`);
    for (const v of vouchers) {
        if (v.request && v.request.branchId) {
            await prisma.repairVoucher.update({
                where: { id: v.id },
                data: { branchId: v.request.branchId }
            });
        }
    }

    // 2. Backfill MaintenanceApprovals from their Requests
    const approvals = await prisma.maintenanceApproval.findMany({
        where: { branchId: null },
        include: { request: true }
    });
    console.log(`Found ${approvals.length} orphaned approvals.`);
    for (const a of approvals) {
        if (a.request && a.request.branchId) {
            await prisma.maintenanceApproval.update({
                where: { id: a.id },
                data: { branchId: a.request.branchId }
            });
        }
    }

    // 3. Backfill SystemLogs (Heuristic approach)
    const logs = await prisma.systemLog.findMany({
        where: { branchId: null }
    });
    console.log(`Found ${logs.length} orphaned system logs.`);
    for (const log of logs) {
        let branchId = null;

        try {
            if (log.entityType === 'CUSTOMER') {
                const customer = await prisma.customer.findUnique({ where: { bkcode: log.entityId } });
                branchId = customer?.branchId;
            } else if (log.entityType === 'REQUEST') {
                const request = await prisma.maintenanceRequest.findUnique({ where: { id: log.entityId } });
                branchId = request?.branchId;
            } else if (log.entityType === 'SALE') {
                const sale = await prisma.machineSale.findUnique({ where: { id: log.entityId } });
                branchId = sale?.branchId;
            } else if (log.entityType === 'PAYMENT') {
                const payment = await prisma.payment.findUnique({ where: { id: log.entityId } });
                branchId = payment?.branchId;
            } else if (log.userId) {
                const user = await prisma.user.findUnique({ where: { id: log.userId } });
                branchId = user?.branchId;
            }
        } catch (e) {
            // Skip if lookup fails
        }

        if (branchId) {
            await prisma.systemLog.update({
                where: { id: log.id },
                data: { branchId }
            });
        }
    }

    // 4. Backfill MachineMovementLogs
    const movements = await prisma.machineMovementLog.findMany({
        where: { branchId: null }
    });
    console.log(`Found ${movements.length} orphaned machine movements.`);
    for (const mov of movements) {
        let branchId = null;
        try {
            const machine = await prisma.warehouseMachine.findFirst({ where: { serialNumber: mov.serialNumber } });
            branchId = machine?.branchId;
        } catch (e) { }

        if (branchId) {
            await prisma.machineMovementLog.update({
                where: { id: mov.id },
                data: { branchId }
            });
        }
    }

    console.log('Backfill complete.');
}

backfill().finally(() => prisma.$disconnect());
