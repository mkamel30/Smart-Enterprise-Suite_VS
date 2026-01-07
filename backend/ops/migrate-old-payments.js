// MOVED TO backend/ops - guarded execution
// To run: set LEGACY_OPS_ALLOW=1 and optionally DRY_RUN=1 to review behavior
if (process.env.LEGACY_OPS_ALLOW !== '1') {
  console.error('Legacy script is guarded. Set LEGACY_OPS_ALLOW=1 to run.');
  process.exit(1);
}

// Migration script to create payments from old closed requests
const db = require('./db');

async function migrateOldRequestsToPayments() {
    console.log('ًں”„ Starting migration: Creating payments from old closed requests...\n');

    try {
        // Get all closed requests with payments
        const closedRequests = await db.maintenanceRequest.findMany({
            where: {
                status: 'Closed',
                usedParts: { not: null }
            },
            include: {
                customer: true
            }
        });

        console.log(`Found ${closedRequests.length} closed requests to process\n`);

        let created = 0;
        let skipped = 0;
        let errors = 0;

        for (const request of closedRequests) {
            try {
                // Parse usedParts
                const usedPartsData = JSON.parse(request.usedParts);
                const totalCost = usedPartsData.totalCost || 0;
                const parts = usedPartsData.parts || [];

                // Skip if no cost
                if (totalCost <= 0) {
                    skipped++;
                    continue;
                }

                // Check if payment already exists for this request
                const existingPayment = await db.payment.findFirst({
                    where: {
                        requestId: request.id
                    }
                });

                if (existingPayment) {
                    console.log(`âڈ­ï¸ڈ  Request ${request.id} - Payment already exists, skipping`);
                    skipped++;
                    continue;
                }

                // Create payment
                const payment = await db.payment.create({
                    data: {
                        customerId: request.customerId,
                        customerName: request.customer?.client_name || 'Unknown',
                        requestId: request.id,
                        amount: parseFloat(totalCost),
                        type: 'MAINTENANCE',
                        reason: 'ظ‚ط·ط¹ ط؛ظٹط§ط± طµظٹط§ظ†ط© (Migration)',
                        paymentPlace: 'ط¶ط§ظ…ظ†',
                        receiptNumber: request.receiptNumber || null,
                        notes: `Migrated from request. Parts: ${parts.map(p => p.name).join(', ')}`,
                        userId: request.closingUserId || null,
                        userName: request.closingUserName || 'System',
                        createdAt: request.closingTimestamp || request.createdAt
                    }
                });

                console.log(`âœ… Created payment: ${payment.amount} ط¬.ظ… for ${payment.customerName} (Request: ${request.id.substring(0, 8)}...)`);
                created++;

            } catch (err) {
                console.error(`â‌Œ Error processing request ${request.id}:`, err.message);
                errors++;
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('ًں“ٹ Migration Complete!');
        console.log('='.repeat(60));
        console.log(`âœ… Payments created: ${created}`);
        console.log(`âڈ­ï¸ڈ  Skipped (no cost or exists): ${skipped}`);
        console.log(`â‌Œ Errors: ${errors}`);
        console.log('='.repeat(60));

    } catch (error) {
        console.error('â‌Œ Migration failed:', error);
    } finally {
        await db.$disconnect();
    }
}

// Run migration
migrateOldRequestsToPayments();
