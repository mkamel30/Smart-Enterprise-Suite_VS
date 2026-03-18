const express = require('express');
const router = express.Router();
const prisma = require('../../db');
const { server } = require('../../server'); // Avoid circular dependency if possible, but let's just use `io` directly. Wait, better to import from server...
// Actually, io is not exported correctly from server.js to routes. We can just use syncQueueService to emit an event!
const syncQueueService = require('../services/syncQueue.service');

// Optional: simple middleware for branch authentication
const branchAuth = async (req, res, next) => {
    const apiKey = req.headers['x-branch-api-key'];
    if (!apiKey) {
        return res.status(401).json({ error: 'Branch API Key required' });
    }

    const branch = await prisma.branch.findUnique({ where: { apiKey } });
    if (!branch) {
        return res.status(401).json({ error: 'Invalid Branch API Key' });
    }

    // Update lastSeen and status
    await prisma.branch.update({
        where: { id: branch.id },
        data: { lastSeen: new Date(), status: 'ONLINE' }
    });

    req.branch = branch;
    next();
};

router.use(branchAuth);

// Endpoint for receiving periodic stats directly (if we were using a BranchStat model)
// BUT since schema mirrors all enterprise models, we'll accept push payloads of core models and upsert them.
router.post('/push', async (req, res) => {
    try {
        const { payments, maintenanceRequests, users, customers, posMachines } = req.body;
        const branchId = req.branch.id;

        // Upsert Payments
        if (payments && Array.isArray(payments)) {
            for (const payment of payments) {
                await prisma.payment.upsert({
                    where: { id: payment.id },
                    update: { ...payment, branchId },
                    create: { ...payment, branchId }
                }).catch(e => console.warn('Payment sync skip:', e.message));
            }
        }

        // Upsert Maintenance Requests
        if (maintenanceRequests && Array.isArray(maintenanceRequests)) {
            for (const request of maintenanceRequests) {
                await prisma.maintenanceRequest.upsert({
                    where: { id: request.id },
                    update: { ...request, branchId },
                    create: { ...request, branchId }
                }).catch(e => console.warn('Request sync skip:', e.message));
            }
        }

        // Upsert Users
        if (users && Array.isArray(users)) {
            for (const user of users) {
                await prisma.user.upsert({
                    where: { id: user.id },
                    update: { ...user, branchId },
                    create: { ...user, branchId } // we leave password matching if it's there
                }).catch(e => console.warn('User sync skip:', e.message));
            }
        }

        // Upsert Customers
        if (customers && Array.isArray(customers)) {
            for (const customer of customers) {
                await prisma.customer.upsert({
                    where: { id: customer.id },
                    update: { ...customer, branchId },
                    create: { ...customer, branchId }
                }).catch(e => console.warn('Customer sync skip:', e.message));
            }
        }

        // Upsert POS Machines
        if (posMachines && Array.isArray(posMachines)) {
            for (const posMachine of posMachines) {
                await prisma.posMachine.upsert({
                    where: { id: posMachine.id },
                    update: { ...posMachine, branchId },
                    create: { ...posMachine, branchId }
                }).catch(e => console.warn('POS Machine sync skip:', e.message));
            }
        }

        // Update branch sync log
        await prisma.centralLog.create({
            data: {
                level: 'INFO',
                message: 'Branch Data Sync Completed',
                source: req.branch.code,
                context: `Pushed ${payments?.length || 0} payments, ${maintenanceRequests?.length || 0} requests`
            }
        });

        res.json({ message: 'Sync successful' });
    } catch (error) {
        console.error('Push sync failed:', error);
        res.status(500).json({ error: 'Push sync failed' });
    }
});

// Admin requests a specific branch to push its full historical data upwards
router.post('/request-full-sync/:branchId', async (req, res) => {
    try {
        const { branchId } = req.params;
        // Verify branch exists
        const branch = await prisma.branch.findUnique({ where: { id: branchId } });
        if (!branch) return res.status(404).json({ error: 'Branch not found' });
        
        // Emitting an internal "request" via the queue/socket system
        // We'll use syncQueueService to broadcast a special DIRECTIVE
        await syncQueueService.enqueueUpdate('SYSTEM_DIRECTIVE', 'REQUEST_FULL_SYNC', { branchId });
        
        res.json({ message: 'Full sync requested successfully via WebSockets' });
    } catch (error) {
        console.error('Failed to request full sync:', error);
        res.status(500).json({ error: 'Failed to request sync' });
    }
});

module.exports = router;
