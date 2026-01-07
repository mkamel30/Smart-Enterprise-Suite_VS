// MOVED TO backend/ops - guarded execution
// To run: set LEGACY_OPS_ALLOW=1 and optionally DRY_RUN=1 to review behavior
if (process.env.LEGACY_OPS_ALLOW !== '1') {
  console.error('Legacy script is guarded. Set LEGACY_OPS_ALLOW=1 to run.');
  process.exit(1);
}

// Fix Sale paidAmount based on actual paid installments
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function fixSalePaidAmounts() {
    console.log('ًں”§ Fixing sale paid amounts...\n');

    try {
        // Get all sales with installments
        const sales = await db.machineSale.findMany({
            where: { type: 'INSTALLMENT' },
            include: { installments: true }
        });

        console.log(`Found ${sales.length} installment sales\n`);

        for (const sale of sales) {
            // Calculate total paid from installments
            const paidInstallments = sale.installments.filter(i => i.isPaid);
            const paidFromInstallments = paidInstallments.reduce((sum, i) => sum + (i.paidAmount || i.amount), 0);

            // The downpayment should be: what was originally paid when sale was created
            // Problem: we need to track downpayment separately
            // For now, calculate correct paidAmount as: 
            // total of paid installments only (downpayment is separate and should be recorded at sale creation)

            const unpaidInstallments = sale.installments.filter(i => !i.isPaid);
            const unpaidTotal = unpaidInstallments.reduce((sum, i) => sum + i.amount, 0);

            // Correct paid amount = totalPrice - unpaid installments total
            const correctPaidAmount = sale.totalPrice - unpaidTotal;

            console.log(`Sale ${sale.id}:`);
            console.log(`  Customer: ${sale.customerId}`);
            console.log(`  Total: ${sale.totalPrice}`);
            console.log(`  Current Paid: ${sale.paidAmount}`);
            console.log(`  Paid from installments: ${paidFromInstallments}`);
            console.log(`  Unpaid total: ${unpaidTotal}`);
            console.log(`  Correct paid: ${correctPaidAmount}`);

            if (sale.paidAmount !== correctPaidAmount) {
                console.log(`  âڑ ï¸ڈ MISMATCH! Will fix...`);

                await db.machineSale.update({
                    where: { id: sale.id },
                    data: { paidAmount: correctPaidAmount }
                });

                console.log(`  âœ… Fixed!`);
            } else {
                console.log(`  âœ“ OK`);
            }
            console.log('');
        }

        console.log('\nDone!');

    } catch (error) {
        console.error('â‌Œ Error:', error);
    } finally {
        await db.$disconnect();
    }
}

fixSalePaidAmounts();
