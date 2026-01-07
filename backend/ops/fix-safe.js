// MOVED TO backend/ops - guarded execution
// To run: set LEGACY_OPS_ALLOW=1 and optionally DRY_RUN=1 to review behavior
if (process.env.LEGACY_OPS_ALLOW !== '1') {
  console.error('Legacy script is guarded. Set LEGACY_OPS_ALLOW=1 to run.');
  process.exit(1);
}

// Fix SAFE to ط¶ط§ظ…ظ† in Payment records
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function fixPaymentPlaces() {
    console.log('ًں”§ Fixing payment places from SAFE to ط¶ط§ظ…ظ†...\n');

    try {
        // Find all payments with SAFE
        const payments = await db.payment.findMany({
            where: {
                OR: [
                    { paymentPlace: 'SAFE' },
                    { paymentMethod: 'SAFE' }
                ]
            }
        });

        console.log(`Found ${payments.length} payments with SAFE\n`);

        if (payments.length === 0) {
            console.log('âœ… No payments to fix!');
            return;
        }

        // Update all at once
        const result = await db.payment.updateMany({
            where: {
                OR: [
                    { paymentPlace: 'SAFE' },
                    { paymentMethod: 'SAFE' }
                ]
            },
            data: {
                paymentPlace: 'ط¶ط§ظ…ظ†',
                paymentMethod: 'ط¶ط§ظ…ظ†'
            }
        });

        console.log(`âœ… Updated ${result.count} payment records`);
        console.log('\nDone!');

    } catch (error) {
        console.error('â‌Œ Error:', error);
    } finally {
        await db.$disconnect();
    }
}

fixPaymentPlaces();
