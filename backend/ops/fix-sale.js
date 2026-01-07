// MOVED TO backend/ops - guarded execution
// To run: set LEGACY_OPS_ALLOW=1 and optionally DRY_RUN=1 to review behavior
if (process.env.LEGACY_OPS_ALLOW !== '1') {
  console.error('Legacy script is guarded. Set LEGACY_OPS_ALLOW=1 to run.');
  process.exit(1);
}

// Fix specific sale - add downpayment
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

// EDIT THESE VALUES:
const SERIAL_NUMBER = '2331947908'; // Serial number of the machine
const DOWNPAYMENT = 3000; // The actual downpayment that was paid

async function fixSale() {
    console.log(`🔧 Fixing sale for machine ${SERIAL_NUMBER}...`);
    console.log(`Setting paidAmount to ${DOWNPAYMENT}...\n`);

    try {
        // Find the sale
        const sale = await db.machineSale.findFirst({
            where: { serialNumber: SERIAL_NUMBER },
            include: { installments: true, customer: true }
        });

        if (!sale) {
            console.log('❌ Sale not found!');
            return;
        }

        console.log('Found sale:');
        console.log(`  ID: ${sale.id}`);
        console.log(`  Customer: ${sale.customer?.client_name} (${sale.customerId})`);
        console.log(`  Total: ${sale.totalPrice}`);
        console.log(`  Current Paid: ${sale.paidAmount}`);
        console.log(`  Installments: ${sale.installments.length}`);

        // Update the sale with correct paidAmount
        await db.machineSale.update({
            where: { id: sale.id },
            data: { paidAmount: DOWNPAYMENT }
        });

        console.log(`\n✅ Updated paidAmount to ${DOWNPAYMENT}`);

        // Now recalculate installments if needed
        const remaining = sale.totalPrice - DOWNPAYMENT;
        const installmentCount = sale.installments.length;
        const newInstallmentAmount = remaining / installmentCount;

        console.log(`\nRecalculating installments:`);
        console.log(`  Remaining: ${remaining}`);
        console.log(`  Count: ${installmentCount}`);
        console.log(`  New amount per installment: ${newInstallmentAmount.toFixed(2)}`);

        // Update all unpaid installments with new amount
        const result = await db.installment.updateMany({
            where: {
                saleId: sale.id,
                isPaid: false
            },
            data: {
                amount: newInstallmentAmount
            }
        });

        console.log(`✅ Updated ${result.count} installments`);
        console.log('\nDone!');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await db.$disconnect();
    }
}

fixSale();
