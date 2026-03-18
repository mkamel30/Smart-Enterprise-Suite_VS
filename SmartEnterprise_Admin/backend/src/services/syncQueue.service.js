let io = null;
const prisma = require('../db');

/**
 * Service to manage syncing data from Admin to Branches via WebSockets and Queueing.
 */
const syncQueueService = {
    init(socketIo) {
        io = socketIo;
    },

    /**
     * Enqueues an update for all connected branches and emits it immediately if the branch is online.
     */
    async enqueueUpdate(entityType, action, payloadObj) {
        const payloadStr = JSON.stringify(payloadObj);
        
        // Find all active branches that should receive updates
        const branches = await prisma.branch.findMany({
            where: { isActive: true }
        });

        for (const branch of branches) {
            try {
                // 1. Save to SyncQueue
                const queueItem = await prisma.syncQueue.create({
                    data: {
                        branchId: branch.id,
                        entityType,
                        action,
                        payload: payloadStr,
                        status: 'PENDING'
                    }
                });

                // 2. If branch is ONLINE, emit the event immediately
                if (branch.status === 'ONLINE' && io) {
                    io.to(`branch_${branch.id}`).emit('admin_update', {
                        queueId: queueItem.id,
                        entityType,
                        action,
                        payload: payloadObj
                    });
                    console.log(`[SyncService] Emitted UPDATE to branch ${branch.code} (Queue ID: ${queueItem.id})`);
                } else {
                    console.log(`[SyncService] Branch ${branch.code} is offline. Update queued (Queue ID: ${queueItem.id})`);
                }
            } catch (error) {
                console.error(`[SyncService] Error enqueuing update for branch ${branch.code}:`, error.message);
            }
        }
    },

    /**
     * Pushes all pending queue items to a specific branch upon reconnection.
     */
    async pushPendingToBranch(branchId) {
        if (!io) return;

        try {
            const pendingItems = await prisma.syncQueue.findMany({
                where: { branchId, status: 'PENDING' },
                orderBy: { createdAt: 'asc' }
            });

            if (pendingItems.length > 0) {
                console.log(`[SyncService] Pushing ${pendingItems.length} pending updates to branch ID ${branchId}`);
                
                for (const item of pendingItems) {
                    const payloadObj = JSON.parse(item.payload);
                    io.to(`branch_${branchId}`).emit('admin_update', {
                        queueId: item.id,
                        entityType: item.entityType,
                        action: item.action,
                        payload: payloadObj
                    });
                }
            }
        } catch (error) {
            console.error(`[SyncService] Error pushing pending updates to branch ${branchId}:`, error.message);
        }
    }
};

module.exports = syncQueueService;
