const db = require('../db');

async function fixAllOrphans() {
    console.log('Starting full orphan repair...');
    try {
        // 1. Fix MachineSales without branchId
        // Try to find any branchId from their installments first
        const orphanedSales = await db.machineSale.findMany({
            where: { branchId: null },
            include: { installments: true }
        });

        console.log(`Found ${orphanedSales.length} orphaned sales.`);

        for (const sale of orphanedSales) {
            let foundBranchId = null;
            // Check if any installment has a branchId
            const firstWithBranch = sale.installments.find(i => i.branchId);
            if (firstWithBranch) {
                foundBranchId = firstWithBranch.branchId;
            } else {
                // Fallback: Check if the customer has a branchId
                const customer = await db.customer.findUnique({
                    where: { bkcode: sale.customerId }
                });
                if (customer && customer.branchId) {
                    foundBranchId = customer.branchId;
                }
            }

            if (foundBranchId) {
                console.log(`Setting Sale ${sale.id} branch to ${foundBranchId}`);
                await db.machineSale.update({
                    where: { id: sale.id },
                    data: { branchId: foundBranchId }
                });
            }
        }

        // 2. Fix Installments without branchId (using the now-fixed sales)
        const orphanedInsts = await db.installment.findMany({
            where: { branchId: null },
            include: { sale: true }
        });

        console.log(`Found ${orphanedInsts.length} orphaned installments.`);

        for (const inst of orphanedInsts) {
            if (inst.sale && inst.sale.branchId) {
                console.log(`Setting Installment ${inst.id} branch to ${inst.sale.branchId}`);
                await db.installment.update({
                    where: { id: inst.id },
                    data: { branchId: inst.sale.branchId }
                });
            }
        }

        // 3. Fix Payments without branchId
        const orphanedPayments = await db.payment.findMany({
            where: { branchId: null }
        });

        console.log(`Found ${orphanedPayments.length} orphaned payments.`);

        for (const payment of orphanedPayments) {
            if (payment.customerId) {
                const customer = await db.customer.findUnique({
                    where: { bkcode: payment.customerId }
                });
                if (customer && customer.branchId) {
                    console.log(`Setting Payment ${payment.id} branch to ${customer.branchId}`);
                    await db.payment.update({
                        where: { id: payment.id },
                        data: { branchId: customer.branchId }
                    });
                }
            }
        }

        console.log('Full repair complete.');
    } catch (e) {
        console.error(e);
    } finally {
        await db.$disconnect();
    }
}

fixAllOrphans();
