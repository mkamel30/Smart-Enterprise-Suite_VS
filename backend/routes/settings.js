const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

// GET branches lookup
router.get('/branches-lookup', authenticateToken, async (req, res) => {
    try {
        const branches = await db.branch.findMany({
            select: { id: true, name: true, type: true },
            orderBy: { name: 'asc' }
        });
        res.json(branches);
    } catch (error) {
        console.error('Failed to fetch branches lookup:', error);
        res.status(500).json({ error: 'Failed to fetch branches' });
    }
});

// GET machine parameters
router.get('/machine-parameters', async (req, res) => {
    try {
        const params = await db.machineParameter.findMany();
        res.json(params);
    } catch (error) {
        console.error('Failed to fetch machine parameters:', error);
        res.status(500).json({ error: 'Failed to fetch machine parameters' });
    }
});

// POST create machine parameter
router.post('/machine-parameters', async (req, res) => {
    try {
        if (!req.body || !req.body.prefix) return res.status(400).json({ error: 'prefix is required' });
        const param = await db.machineParameter.create({
            data: {
                prefix: String(req.body.prefix).toUpperCase(),
                model: req.body.model ? String(req.body.model).toUpperCase() : null,
                manufacturer: req.body.manufacturer ? String(req.body.manufacturer).toUpperCase() : null
            }
        });
        res.status(201).json(param);
    } catch (error) {
        console.error('Failed to create machine parameter:', error);
        res.status(500).json({ error: 'Failed to create machine parameter' });
    }
});

// DELETE machine parameter
// DELETE machine parameter
router.delete('/machine-parameters/:id', async (req, res) => {
    try {
        await db.machineParameter.delete({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (error) {
        console.error('Failed to delete machine parameter:', error);
        if (error?.code === 'P2025') return res.status(404).json({ error: 'MachineParameter not found' });
        res.status(500).json({ error: 'Failed to delete machine parameter' });
    }
});

// --- Client Types ---

// GET client types
router.get('/settings/client-types', async (req, res) => {
    try {
        const types = await db.clientType.findMany({ orderBy: { name: 'asc' } });
        res.json(types);
    } catch (error) {
        console.error('Failed to fetch client types:', error);
        res.status(500).json({ error: 'Failed to fetch client types' });
    }
});

// POST create client type
router.post('/settings/client-types', async (req, res) => {
    try {
        if (!req.body || !req.body.name) return res.status(400).json({ error: 'name is required' });
        const type = await db.clientType.create({
            data: {
                name: String(req.body.name),
                description: req.body.description || null
            }
        });
        res.status(201).json(type);
    } catch (error) {
        console.error('Failed to create client type:', error);
        res.status(500).json({ error: 'Failed to create client type' });
    }
});
// PUT update client type
router.put('/settings/client-types/:id', async (req, res) => {
    try {
        const type = await db.clientType.update({
            where: { id: req.params.id },
            data: {
                name: req.body.name || undefined,
                description: req.body.description || undefined
            }
        });
        res.json(type);
    } catch (error) {
        console.error('Failed to update client type:', error);
        if (error?.code === 'P2025') return res.status(404).json({ error: 'ClientType not found' });
        res.status(500).json({ error: 'Failed to update client type' });
    }
});

// DELETE client type
router.delete('/settings/client-types/:id', async (req, res) => {
    try {
        await db.clientType.delete({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (error) {
        console.error('Failed to delete client type:', error);
        if (error?.code === 'P2025') return res.status(404).json({ error: 'ClientType not found' });
        res.status(500).json({ error: 'Failed to delete client type' });
    }
});

// POST force-update all machine models based on MachineParameters
router.post('/force-update-models', async (req, res) => {
    try {
        // Fetch all MachineParameters
        const machineParams = await db.machineParameter.findMany();

        if (machineParams.length === 0) {
            return res.status(400).json({ error: 'لا توجد بارامترات ماكينات محددة' });
        }

        let warehouseUpdated = 0;
        let customerUpdated = 0;

        // Update WarehouseMachines
        const warehouseMachines = await db.warehouseMachine.findMany({
            where: {
                OR: [
                    { model: null },
                    { model: '' },
                    { manufacturer: null },
                    { manufacturer: '' }
                ]
            }
        });

        for (const machine of warehouseMachines) {
            const sn = machine.serialNumber.toUpperCase();
            let matched = null;

            // Match prefix from longest to shortest
            for (let len = Math.min(5, sn.length); len >= 2; len--) {
                const prefix = sn.substring(0, len);
                matched = machineParams.find(p => p.prefix === prefix);
                if (matched) break;
            }

            if (matched) {
                await db.warehouseMachine.updateMany({
                    where: { id: machine.id, branchId: machine.branchId },
                    data: {
                        model: matched.model,
                        manufacturer: matched.manufacturer
                    }
                });
                warehouseUpdated++;
            }
        }

        // Update PosMachines (Customer machines)
        const posMachines = await db.posMachine.findMany({
            where: {
                OR: [
                    { model: null },
                    { model: '' },
                    { manufacturer: null },
                    { manufacturer: '' }
                ]
            }
        });

        for (const machine of posMachines) {
            const sn = machine.serialNumber.toUpperCase();
            let matched = null;

            for (let len = Math.min(5, sn.length); len >= 2; len--) {
                const prefix = sn.substring(0, len);
                matched = machineParams.find(p => p.prefix === prefix);
                if (matched) break;
            }

            if (matched) {
                await db.posMachine.updateMany({
                    where: { id: machine.id, branchId: machine.branchId },
                    data: {
                        model: matched.model,
                        manufacturer: matched.manufacturer
                    }
                });
                customerUpdated++;
            }
        }

        res.json({
            success: true,
            message: `تم تحديث ${warehouseUpdated} ماكينة مخزن + ${customerUpdated} ماكينة عملاء`,
            warehouseUpdated,
            customerUpdated,
            total: warehouseUpdated + customerUpdated
        });
    } catch (error) {
        console.error('Force update models failed:', error);
        res.status(500).json({ error: 'فشل تحديث الموديلات' });
    }
});

module.exports = router;
