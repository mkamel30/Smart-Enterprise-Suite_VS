const prisma = require('../db');
const syncQueueService = require('../services/syncQueue.service');

module.exports = (io) => {
    io.use(async (socket, next) => {
        const apiKey = socket.handshake.auth.apiKey || socket.handshake.headers['x-api-key'];
        if (!apiKey) {
            return next(new Error('Authentication error: Missing API Key'));
        }

        try {
            const branch = await prisma.branch.findUnique({ where: { apiKey } });
            if (!branch) {
                return next(new Error('Authentication error: Invalid API Key'));
            }

            // Bind branch info to socket
            socket.branchId = branch.id;
            socket.branchCode = branch.code;
            
            // Mark branch as ONLINE
            await prisma.branch.update({
                where: { id: branch.id },
                data: { status: 'ONLINE', lastSeen: new Date() }
            });
            
            // Join a secure room exclusively for this branch
            socket.join(`branch_${branch.id}`);
            next();
        } catch (err) {
            console.error('Socket auth error:', err);
            next(new Error('Internal server error during auth'));
        }
    });

    io.on('connection', (socket) => {
        console.log(`[Socket] Branch Connected: ${socket.branchCode}`);

        // Push any pending updates to the branch that just connected
        syncQueueService.pushPendingToBranch(socket.branchId);

        // Listen for acknowledgments of synced updates
        socket.on('ack_update', async (data) => {
            const { queueId } = data;
            if (queueId) {
                try {
                    await prisma.syncQueue.update({
                        where: { id: queueId },
                        data: { status: 'SYNCED' }
                    });
                    console.log(`[Sync] Queue item ${queueId} marked as SYNCED for branch ${socket.branchCode}`);
                } catch (error) {
                    console.error('[Sync] Error marking queue item as synced:', error.message);
                }
            }
        });

        // Upward Sync: Listen for users created at the branch
        socket.on('branch_user_update', async (payload) => {
            console.log(`[Sync] Received user update from branch ${socket.branchCode}`);
            try {
                const { user } = payload;
                if (user) {
                    await prisma.user.upsert({
                        where: { id: user.id },
                        update: { ...user, branchId: socket.branchId },
                        create: { ...user, branchId: socket.branchId }
                    });
                    console.log(`[Sync] User ${user.username} synced to Central DB`);
                }
            } catch (error) {
                console.error('[Sync] Error processing branch_user_update:', error.message);
            }
        });

        socket.on('disconnect', async () => {
            console.log(`[Socket] Branch Disconnected: ${socket.branchCode}`);
            try {
                await prisma.branch.update({
                    where: { id: socket.branchId },
                    data: { status: 'OFFLINE', lastSeen: new Date() }
                });
            } catch (error) {
                console.error('[Socket] Error updating branch status:', error.message);
            }
        });
    });
};
