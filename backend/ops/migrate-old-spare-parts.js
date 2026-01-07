// MOVED TO backend/ops - guarded execution
// To run: set LEGACY_OPS_ALLOW=1 and optionally DRY_RUN=1 to review behavior
if (process.env.LEGACY_OPS_ALLOW !== '1') {
  console.error('Legacy script is guarded. Set LEGACY_OPS_ALLOW=1 to run.');
  process.exit(1);
}

// Migration script to process closed requests from Dec 19 onwards
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function processOldClosedRequests() {
    console.log('ًں”„ Starting migration: Processing requests from Dec 19...\n');

    try {
        // Get closed requests from Dec 19 onwards only
        const startDate = new Date('2025-12-19T00:00:00.000Z');

        const closedRequests = await db.maintenanceRequest.findMany({
            where: {
                status: 'Closed',
                closingTimestamp: {
                    gte: startDate
                },
                usedParts: { not: null }
            },
            include: {
                customer: true
            },
            orderBy: {
                closingTimestamp: 'asc'
            }
        });

        console.log(`Found ${closedRequests.length} requests to process\n`);

        let processed = 0;
        let skipped = 0;
        let partsProcessed = 0;
        let paymentsCreated = 0;
        let errors = 0;

        for (const request of closedRequests) {
            try {
                console.log(`\nًں“‹ ${request.id.substring(0, 8)}... (${request.closingTimestamp?.toLocaleDateString('ar-EG')})`);

                const usedPartsData = JSON.parse(request.usedParts);
                const parts = usedPartsData.parts || [];

                if (parts.length === 0) {
                    console.log('  âڈ­ï¸ڈ  No parts');
                    skipped++;
                    continue;
                }

                console.log(`  ًں“¦ ${parts.length} parts...`);

                for (const part of parts) {
                    if (!part.partId || part.quantity <= 0) continue;

                    try {
                        console.log(`    â†’ ${part.name} (${part.quantity}x)`);

                        await db.$transaction(async (tx) => {
                            // 1. Find inventory item
                            const invItem = await tx.inventoryItem.findFirst({
                                where: {
                                    partId: part.partId,
                                    branchId: request.branchId // Filter by branch!
                                },
                                include: { part: true }
                            });

                            if (!invItem) {
                                throw new Error(`No inventory for ${part.partId}`);
                            }

                            // 2. Update inventory
                            await tx.inventoryItem.update({
                                where: { id: invItem.id },
                                data: { quantity: { decrement: part.quantity } }
                            });

                            // 3. Log movement
                            await tx.stockMovement.create({
                                data: {
                                    partId: part.partId,
                                    type: 'OUT',
                                    quantity: part.quantity,
                                    reason: `طµظٹط§ظ†ط© - ${request.actionTaken || ''} (Migration)`,
                                    requestId: request.id,
                                    performedBy: request.closingUserName || 'System',
                                    createdAt: request.closingTimestamp || new Date(),
                                    branchId: request.branchId // Add branchId
                                }
                            });

                            // 4. Create payment if needed
                            if (part.isPaid && part.cost > 0 && request.customerId) {
                                await tx.payment.create({
                                    data: {
                                        customerId: request.customerId,
                                        customerName: request.customer?.client_name || 'Unknown',
                                        requestId: request.id,
                                        amount: parseFloat(part.cost),
                                        type: 'MAINTENANCE',
                                        reason: `ظ‚ط·ط¹ ط؛ظٹط§ط±: ${part.name}`,
                                        paymentPlace: 'ط¶ط§ظ…ظ†',
                                        userId: request.closingUserId,
                                        userName: request.closingUserName || 'System',
                                        createdAt: request.closingTimestamp || new Date()
                                    }
                                });
                                paymentsCreated++;
                                console.log(`      ًں’° ${part.cost} ط¬.ظ…`);
                            }

                            console.log(`      âœ… Remaining: ${invItem.quantity - part.quantity}`);
                        });

                        partsProcessed++;

                    } catch (partErr) {
                        if (partErr.message?.includes('Unique')) {
                            console.log(`      âڈ­ï¸ڈ  Skip (exists)`);
                        } else {
                            console.error(`      â‌Œ ${partErr.message}`);
                            errors++;
                        }
                    }
                }

                processed++;

            } catch (err) {
                console.error(`  â‌Œ ${err.message}`);
                errors++;
            }
        }

        console.log('\n' + '='.repeat(50));
        console.log('ًں“ٹ Complete!');
        console.log('='.repeat(50));
        console.log(`âœ… Requests: ${processed}`);
        console.log(`ًں“¦ Parts: ${partsProcessed}`);
        console.log(`ًں’° Payments: ${paymentsCreated}`);
        console.log(`âڈ­ï¸ڈ  Skipped: ${skipped}`);
        console.log(`â‌Œ Errors: ${errors}`);
        console.log('='.repeat(50));

    } catch (error) {
        console.error('â‌Œ Failed:', error);
    } finally {
        await db.$disconnect();
    }
}

processOldClosedRequests();
