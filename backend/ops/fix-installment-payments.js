// MOVED TO backend/ops - guarded execution
// To run: set LEGACY_OPS_ALLOW=1 and optionally DRY_RUN=1 to review behavior
if (process.env.LEGACY_OPS_ALLOW !== '1') {
  console.error('Legacy script is guarded. Set LEGACY_OPS_ALLOW=1 to run.');
  process.exit(1);
}

/**
 * Script to fix existing installment payments that are missing reason and paymentPlace
 * Run with: node fix-installment-payments.js
 */

const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function fixInstallmentPayments() {
    console.log('🔧 Starting fix for installment payments...\n');

    try {
        // Find all INSTALLMENT type payments that are missing reason or paymentPlace
        const paymentsToFix = await db.payment.findMany({
            where: {
                type: 'INSTALLMENT',
                OR: [
                    { reason: null },
                    { reason: '' },
                    { paymentPlace: null }
                ]
            }
        });

        console.log(`Found ${paymentsToFix.length} installment payments to fix.\n`);

        let fixed = 0;
        let notFound = 0;

        for (const payment of paymentsToFix) {
            console.log(`Processing payment: ${payment.id} (Receipt: ${payment.receiptNumber})`);

            // Try to find the corresponding installment by receiptNumber
            let installment = null;

            if (payment.receiptNumber) {
                installment = await db.installment.findFirst({
                    where: { receiptNumber: payment.receiptNumber },
                    include: { sale: true }
                });
            }

            if (installment) {
                // Update the payment with data from the installment
                const updateData = {};

                if (!payment.reason || payment.reason === '') {
                    updateData.reason = installment.description || 'سداد قسط';
                }

                if (!payment.paymentPlace && installment.paymentPlace) {
                    updateData.paymentPlace = installment.paymentPlace;
                }

                if (Object.keys(updateData).length > 0) {
                    await db.payment.update({
                        where: { id: payment.id },
                        data: updateData
                    });

                    console.log(`  ✅ Updated: reason="${updateData.reason || payment.reason}", paymentPlace="${updateData.paymentPlace || payment.paymentPlace}"`);
                    fixed++;
                } else {
                    console.log(`  ⚠️ No data to update`);
                }
            } else {
                // Try to extract info from notes field
                const notes = payment.notes || '';
                let reason = payment.reason;

                if (!reason && notes.includes('سداد')) {
                    // Extract from notes like "سداد القسط رقم 2 من 12"
                    reason = notes;
                } else if (!reason) {
                    reason = 'سداد قسط';
                }

                await db.payment.update({
                    where: { id: payment.id },
                    data: { reason }
                });

                console.log(`  ⚠️ Installment not found, set reason from notes: "${reason}"`);
                notFound++;
            }
        }

        console.log('\n========================================');
        console.log(`✅ Fixed: ${fixed} payments`);
        console.log(`⚠️ Partially fixed (installment not found): ${notFound} payments`);
        console.log('========================================\n');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await db.$disconnect();
    }
}

fixInstallmentPayments();
