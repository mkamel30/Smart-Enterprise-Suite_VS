const express = require('express');
const router = express.Router();
const { z } = require('zod');
const db = require('../db');
const { logAction } = require('../utils/logger');
const { authenticateToken } = require('../middleware/auth');
const { getBranchFilter } = require('../middleware/permissions');
const { validateQuery } = require('../middleware/validation');
const { normalizeSerial } = require('../services/serialService');
const { ensureBranchWhere } = require('../prisma/branchHelpers');

// Validation Schemas
const listQuerySchema = z.object({
    branchId: z.string().regex(/^[a-z0-9]{25}$/).optional(),
    status: z.union([
        z.string(),
        z.array(z.string())
    ]).optional(),
    q: z.string().optional()
});

// GET Machines by Status
router.get('/', authenticateToken, validateQuery(listQuerySchema), async (req, res) => {
    try {
        const { status, q } = req.query;
        const branchFilter = getBranchFilter(req);
        const targetBranchId = req.query.branchId;

        const whereClause = { ...branchFilter };

        // Allow Super Admin/Management to filter by branch
        if (targetBranchId && (['SUPER_ADMIN', 'MANAGEMENT'].includes(req.user.role))) {
            whereClause.branchId = targetBranchId;
        }

        // Status Filtering
        if (status) {
            if (status === 'CLIENT_REPAIR') {
                whereClause.status = { in: ['CLIENT_REPAIR', 'AT_CENTER', 'EXTERNAL_REPAIR'] };
            } else if (Array.isArray(status)) {
                whereClause.status = { in: status };
            } else {
                whereClause.status = status;
            }
        }

        // Search Filtering (if q is provided)
        if (q) {
            whereClause.OR = [
                { serialNumber: { contains: q } },
                { model: { contains: q, mode: 'insensitive' } }
            ];
        }

        const machines = await db.warehouseMachine.findMany(ensureBranchWhere({
            where: whereClause,
            orderBy: { importDate: 'desc' },
            include: { branch: true }
        }, req));

        res.json(machines);
    } catch (error) {
        console.error('Failed to fetch warehouse machines:', error);
        res.status(500).json({ error: 'فشل في جلب الماكينات' });
    }
});

// GET Machine Counts
router.get('/counts', authenticateToken, async (req, res) => {
    try {
        const branchFilter = getBranchFilter(req);
        const targetBranchId = req.query.branchId;

        const whereClause = { ...branchFilter };

        if (targetBranchId && (['SUPER_ADMIN', 'MANAGEMENT', 'CENTER_MANAGER'].includes(req.user.role))) {
            whereClause.branchId = targetBranchId;
        }

        const counts = await db.warehouseMachine.groupBy(ensureBranchWhere({
            by: ['status'],
            where: whereClause,
            _count: { status: true }
        }, req));

        // Format: { NEW: 10, STANDBY: 5, ... }
        const formattedCounts = counts.reduce((acc, curr) => {
            acc[curr.status] = curr._count.status;
            return acc;
        }, {});

        res.json(formattedCounts);
    } catch (error) {
        console.error('Failed to fetch machine counts:', error);
        res.status(500).json({ error: 'فشل في جلب الإحصائيات' });
    }
});

// GET Duplicated serial numbers across warehouse and customer machines
router.get('/duplicates', authenticateToken, async (_req, res) => {
    try {
        // Only Admin/Management/AdminAffairs should see duplicates
        if (!['SUPER_ADMIN', 'MANAGEMENT', 'ADMIN_AFFAIRS'].includes(_req.user.role)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const [warehouse, pos] = await Promise.all([
            db.warehouseMachine.findMany({
                where: { branchId: { not: null } },
                include: { branch: true }
            }),
            db.posMachine.findMany({
                where: { branchId: { not: null } },
                include: { customer: { include: { branch: true } } }
            })
        ]);

        const map = new Map();

        const push = (serial, entry) => {
            const key = normalizeSerial(serial);
            if (!key) return;
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(entry);
        };

        for (const m of warehouse) {
            push(m.serialNumber, {
                source: 'WAREHOUSE',
                id: m.id,
                branchId: m.branchId,
                branchName: m.branch?.name || null,
                status: m.status,
                model: m.model,
                manufacturer: m.manufacturer
            });
        }

        for (const p of pos) {
            push(p.serialNumber, {
                source: 'CUSTOMER',
                id: p.id,
                customerId: p.customerId,
                customerName: p.customer?.client_name || null,
                branchId: p.customer?.branchId || p.branchId || null,
                branchName: p.customer?.branch?.name || null
            });
        }

        const duplicates = [];
        for (const [serialNumber, occurrences] of map.entries()) {
            if (occurrences.length > 1) {
                duplicates.push({ serialNumber, count: occurrences.length, occurrences });
            }
        }

        duplicates.sort((a, b) => b.count - a.count || a.serialNumber.localeCompare(b.serialNumber));

        res.json({ duplicates, totalDuplicates: duplicates.length });
    } catch (error) {
        console.error('Failed to fetch duplicate machines:', error);
        res.status(500).json({ error: 'فشل في جلب التكرارات' });
    }
});

// GET Logs
router.get('/logs', authenticateToken, async (req, res) => {
    try {
        // Logs are currently global but we should try to filter if possible.
        // MachineMovementLog contains machineId/serialNumber but not branchId directly.
        // We can join with WarehouseMachine or infer.
        // For now, if user is branch restricted, maybe only show logs for their machines?
        // This is complex because logs are historical.
        // Let's keep logs global to Admin, and maybe restricted to Branch User if we can efficiently filter.
        // Current implementation: return last 100 logs regardless of branch (simplification).
        // TODO: Implement strict log filtering by joining with WarehouseMachine history if needed.

        const branchFilter = getBranchFilter(req);
        const logs = await db.machineMovementLog.findMany(ensureBranchWhere({
            where: branchFilter,
            orderBy: { createdAt: 'desc' },
            take: 100 // Limit to last 100 logs
        }, req));
        res.json(logs);
    } catch (error) {
        console.error('Failed to fetch machine logs:', error);
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
});

// POST Import Machines (Bulk or Single)
router.post('/import', authenticateToken, async (req, res) => {
    try {
        const { machines, performedBy = 'System' } = req.body;
        const branchId = req.user.branchId || req.body.branchId;
        if (!branchId) return res.status(400).json({ error: 'Branch ID is required for import' });

        const results = await warehouseService.importMachines(machines, branchId, performedBy);
        res.json(results);
    } catch (error) {
        console.error('Import failed:', error.message || error);
        res.status(error.status || 500).json({ error: error.message || 'Import failed' });
    }
});

// POST Bulk Transfer to Maintenance Center
router.post('/bulk-transfer', authenticateToken, async (req, res) => {
    try {
        const payload = req.body;
        const result = await transferService.createBulkTransfer(payload, req.user);
        res.json(result);
    } catch (error) {
        console.error('Bulk transfer failed:', error.message || error);
        res.status(error.status || 500).json({ error: error.message || 'Bulk transfer failed' });
    }
});

// POST Return machines from Maintenance Center to Branch
router.post('/return-to-branch', authenticateToken, async (req, res) => {
    try {
        const { serialNumbers, toBranchId, waybillNumber, notes, performedBy } = req.body;
        const fromBranchId = req.user.branchId; // Maintenance center

        if (!serialNumbers?.length || !toBranchId) {
            return res.status(400).json({ error: 'Serial numbers and destination branch are required' });
        }

        // Verify user is from maintenance center
        if (!['CENTER_MANAGER', 'CENTER_TECH', 'SUPER_ADMIN'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Only maintenance center can return machines' });
        }

        const result = await db.$transaction(async (tx) => {
            // Get machines with READY_FOR_RETURN status
            const machines = await tx.warehouseMachine.findMany(ensureBranchWhere({
                where: {
                    serialNumber: { in: serialNumbers },
                    branchId: fromBranchId,
                    status: 'READY_FOR_RETURN'
                },
                select: {
                    id: true,
                    serialNumber: true,
                    model: true,
                    manufacturer: true,
                    requestId: true,
                    originBranchId: true,
                    resolution: true
                }
            }, req));

            if (machines.length !== serialNumbers.length) {
                const found = machines.map(m => m.serialNumber);
                const missing = serialNumbers.filter(s => !found.includes(s));
                throw new Error(`ط¨ط¹ط¶ ط§ظ„ظ…ط§ظƒظٹظ†ط§طھ ط؛ظٹط± ط¬ط§ظ‡ط²ط© ظ„ظ„ط¥ط±ط¬ط§ط¹ ط£ظˆ ط؛ظٹط± ظ…ظˆط¬ظˆط¯ط©: ${missing.join(', ')}`);
            }

            // Verify all machines are returning to their origin branch
            const wrongBranch = machines.filter(m => m.originBranchId && m.originBranchId !== toBranchId);
            if (wrongBranch.length > 0) {
                throw new Error(`ط¨ط¹ط¶ ط§ظ„ظ…ط§ظƒظٹظ†ط§طھ ظ„ط§ طھظ†طھظ…ظٹ ظ„ظ„ظپط±ط¹ ط§ظ„ظ…ط­ط¯ط¯: ${wrongBranch.map(m => m.serialNumber).join(', ')}`);
            }

            const machineMap = new Map(machines.map(m => [m.serialNumber, m]));
            const orderNumber = `TO-RT-${Date.now()}`; // RT = Return Transfer

            // Create return transfer order
            const order = await tx.transferOrder.create({
                data: {
                    orderNumber,
                    waybillNumber,
                    fromBranchId,
                    toBranchId,
                    branchId: toBranchId,
                    type: 'RETURN', // New type for returns
                    notes: notes || 'ط¥ط±ط¬ط§ط¹ ظ…ط§ظƒظٹظ†ط§طھ ظ…ظ† ظ…ط±ظƒط² ط§ظ„طµظٹط§ظ†ط©',
                    createdByUserId: req.user.id,
                    createdByName: performedBy || req.user.displayName,
                    items: {
                        create: serialNumbers.map(s => {
                            const machineInfo = machineMap.get(s) || {};
                            return {
                                serialNumber: s,
                                type: 'MACHINE',
                                model: machineInfo.model || null,
                                manufacturer: machineInfo.manufacturer || null
                            };
                        })
                    }
                }
            });

            // Update machines to RETURNING status
            for (const serial of serialNumbers) {
                const machine = machineMap.get(serial);
                await tx.warehouseMachine.update({
                    where: { serialNumber: serial },
                    data: {
                        status: 'RETURNING',
                        notes: `ظپظٹ ط·ط±ظٹظ‚ ط§ظ„ط¹ظˆط¯ط© ظ„ظ„ظپط±ط¹ - ط¥ط°ظ† ${orderNumber} - ط¨ظˆظ„ظٹطµط©: ${waybillNumber || 'ط¨ط¯ظˆظ†'}`,
                        branchId: toBranchId // Transfer ownership back to branch
                    }
                });

                // Create movement log
                await tx.machineMovementLog.create({
                    data: {
                        machineId: machine.id,
                        serialNumber: serial,
                        action: 'RETURN_TO_BRANCH',
                        details: `ط¥ط±ط¬ط§ط¹ ظ…ظ† ظ…ط±ظƒط² ط§ظ„طµظٹط§ظ†ط© - ط¥ط°ظ† ${orderNumber} - ط¨ظˆظ„ظٹطµط©: ${waybillNumber || 'ط¨ط¯ظˆظ†'} - ط§ظ„ظ†طھظٹط¬ط©: ${machine.resolution || 'ط؛ظٹط± ظ…ط­ط¯ط¯'}`,
                        performedBy: performedBy || req.user.displayName,
                        branchId: fromBranchId
                    }
                });

                // Update maintenance request status if exists
                if (machine.requestId) {
                    await tx.maintenanceRequest.update({
                        where: { id: machine.requestId },
                        data: {
                            status: 'RETURNING_FROM_CENTER',
                            actionTaken: machine.resolution === 'REPAIRED' ? 'طھظ… ط§ظ„ط¥طµظ„ط§ط­ ط¨ظ…ط±ظƒط² ط§ظ„طµظٹط§ظ†ط©' : machine.resolution === 'SCRAPPED' ? 'طھط§ظ„ظپط© - ط®ط±ط¯ط©' : 'طھظ… ط§ظ„ط±ظپط¶'
                        }
                    });
                }
            }

            // Send notification to destination branch
            const { createNotification } = require('../services/notificationService');
            const fromBranch = await tx.branch.findUnique({
                where: { id: fromBranchId },
                select: { name: true }
            });

            await createNotification({
                branchId: toBranchId,
                type: 'TRANSFER_ORDER',
                title: 'ظ…ط§ظƒظٹظ†ط§طھ ط¹ط§ط¦ط¯ط© ظ…ظ† ظ…ط±ظƒط² ط§ظ„طµظٹط§ظ†ط©',
                message: `طھظ… ط¥ط±ط³ط§ظ„ ${serialNumbers.length} ظ…ط§ظƒظٹظ†ط© ظ…ظ† ${fromBranch?.name || 'ظ…ط±ظƒط² ط§ظ„طµظٹط§ظ†ط©'} - ط¥ط°ظ† ${orderNumber} - ط¨ظˆظ„ظٹطµط©: ${waybillNumber || 'ط¨ط¯ظˆظ†'}`,
                data: {
                    orderId: order.id,
                    orderNumber: order.orderNumber,
                    fromBranchName: fromBranch?.name,
                    fromBranchId,
                    machineCount: serialNumbers.length,
                    waybillNumber,
                    type: 'RETURN'
                },
                link: `/receive-orders?orderId=${order.id}`
            });

            return order;
        });

        res.json(result);
    } catch (error) {
        console.error('Return to branch failed:', error);
        res.status(error.status || 500).json({ error: error.message || 'ظپط´ظ„ ط¥ط±ط¬ط§ط¹ ط§ظ„ظ…ط§ظƒظٹظ†ط§طھ' });
    }
});

// POST Create One
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { performedBy = 'System', ...data } = req.body;
        const machine = await warehouseService.createMachine({ ...data, performedBy }, req.user);
        res.json(machine);
    } catch (error) {
        console.error('=== WAREHOUSE MACHINE CREATE ERROR ===', error.message || error);
        res.status(error.status || 400).json({ error: error.message || 'Creation failed' });
    }
});

// PUT Update Machines by Prefix (for unknown model quick-add)
// TODO: Limit this to branch
router.put('/update-by-prefix', authenticateToken, async (req, res) => {
    try {
        const { prefix, model, manufacturer } = req.body;
        const branchFilter = getBranchFilter(req);

        if (!prefix || !model || !manufacturer) {
            return res.status(400).json({ error: 'prefix, model, and manufacturer are required' });
        }

        // Find all machines with this prefix that don't have a model set AND belong to branch
        const machines = await db.warehouseMachine.findMany(ensureBranchWhere({
            where: {
                serialNumber: { startsWith: prefix },
                OR: [
                    { model: null },
                    { model: '' },
                    { model: '-' }
                ]
            }
        }, req));

        // Update all matching machines
        const updateResult = await db.warehouseMachine.updateMany({
            where: {
                ...branchFilter,
                serialNumber: { startsWith: prefix },
                OR: [
                    { model: null },
                    { model: '' },
                    { model: '-' }
                ]
            },
            data: {
                model: model.toUpperCase(),
                manufacturer: manufacturer.toUpperCase()
            }
        });

        res.json({
            success: true,
            updated: updateResult.count,
            message: `Updated ${updateResult.count} machines with prefix ${prefix}`
        });
    } catch (error) {
        console.error('Update by prefix failed:', error);
        res.status(500).json({ error: 'Update failed' });
    }
});

// PUT Receive returned machine from maintenance center
router.put('/:id/receive-return', authenticateToken, async (req, res) => {
    try {
        const { performedBy } = req.body;
        const machineId = req.params.id;

        const result = await db.$transaction(async (tx) => {
            // Get machine - RULE 1: MUST include branchId
            const machine = await tx.warehouseMachine.findFirst({
                where: { id: machineId, branchId: { not: null } },
                include: { branch: true }
            });

            if (!machine) {
                throw new Error('ط§ظ„ظ…ط§ظƒظٹظ†ط© ط؛ظٹط± ظ…ظˆط¬ظˆط¯ط©');
            }

            // Verify machine is in RETURNING status
            if (machine.status !== 'RETURNING') {
                throw new Error(`ط§ظ„ظ…ط§ظƒظٹظ†ط© ظ„ظٹط³طھ ظپظٹ ط­ط§ظ„ط© "ظپظٹ ط·ط±ظٹظ‚ ط§ظ„ط¹ظˆط¯ط©". ط§ظ„ط­ط§ظ„ط© ط§ظ„ط­ط§ظ„ظٹط©: ${machine.status}`);
            }

            // Verify user has access to this branch
            if (req.user.branchId && machine.branchId !== req.user.branchId) {
                throw new Error('ظ„ظٹط³ ظ„ط¯ظٹظƒ طµظ„ط§ط­ظٹط© ط§ط³طھظ„ط§ظ… ظ‡ط°ظ‡ ط§ظ„ظ…ط§ظƒظٹظ†ط©');
            }

            // Update machine status to COMPLETED - RULE 1
            await tx.warehouseMachine.updateMany({
                where: { id: machineId, branchId: { not: null } },
                data: {
                    status: 'COMPLETED',
                    notes: `طھظ… ط§ط³طھظ„ط§ظ…ظ‡ط§ ظ…ظ† ظ…ط±ظƒط² ط§ظ„طµظٹط§ظ†ط© - ${machine.resolution || 'ط؛ظٹط± ظ…ط­ط¯ط¯'}`,
                    readyForPickup: machine.resolution === 'REPAIRED' // Ready if repaired
                }
            });

            const updatedMachine = await tx.warehouseMachine.findFirst({ where: { id: machineId, branchId: { not: null } } });

            // Create movement log
            await tx.machineMovementLog.create({
                data: {
                    machineId: machine.id,
                    serialNumber: machine.serialNumber,
                    action: 'RECEIVED_FROM_CENTER',
                    details: `طھظ… ط§ط³طھظ„ط§ظ… ط§ظ„ظ…ط§ظƒظٹظ†ط© ظ…ظ† ظ…ط±ظƒط² ط§ظ„طµظٹط§ظ†ط© - ط§ظ„ظ†طھظٹط¬ط©: ${machine.resolution || 'ط؛ظٹط± ظ…ط­ط¯ط¯'}`,
                    performedBy: performedBy || req.user.displayName,
                    branchId: machine.branchId
                }
            });

            // Update maintenance request if exists
            if (machine.requestId) {
                await tx.maintenanceRequest.updateMany({
                    where: { id: machine.requestId, branchId: { not: null } },
                    data: {
                        status: machine.resolution === 'REPAIRED' ? 'READY_FOR_DELIVERY' :
                            machine.resolution === 'SCRAPPED' ? 'Closed' :
                                'READY_FOR_DELIVERY'
                    }
                });
            }

            return updatedMachine;
        });

        res.json(result);
    } catch (error) {
        console.error('Failed to receive return:', error);
        res.status(error.status || 500).json({ error: error.message || 'ظپط´ظ„ ط§ط³طھظ„ط§ظ… ط§ظ„ظ…ط§ظƒظٹظ†ط©' });
    }
});

// PUT Update Status/Notes
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const { performedBy = 'System', ...data } = req.body;
        const existing = await db.warehouseMachine.findFirst({
            where: { id: req.params.id, branchId: { not: null } }
        });

        if (!existing) return res.status(404).json({ error: 'Machine not found' });

        if (req.user.branchId && existing.branchId !== req.user.branchId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // VALIDATION: Prevent manual status change to IN_TRANSIT
        // IN_TRANSIT can only be set through transfer orders
        if (data.status === 'IN_TRANSIT' && existing.status !== 'IN_TRANSIT') {
            return res.status(400).json({
                error: 'ظ„ط§ ظٹظ…ظƒظ† طھط؛ظٹظٹط± ط§ظ„ط­ط§ظ„ط© ط¥ظ„ظ‰ "ظ‚ظٹط¯ ط§ظ„ظ†ظ‚ظ„" ظٹط¯ظˆظٹط§ظ‹. ظٹط¬ط¨ ط¥ظ†ط´ط§ط، ط¥ط°ظ† طھط­ظˆظٹظ„.'
            });
        }

        if (data.status && data.status !== existing.status) {
            await movementService.logMachineMovement(db, {
                machineId: existing.id,
                serialNumber: existing.serialNumber,
                action: 'STATUS_CHANGE',
                details: `Changed from ${existing.status} to ${data.status}`,
                performedBy,
                branchId: existing.branchId
            });
        }

        await db.warehouseMachine.updateMany({
            where: { id: req.params.id, branchId: { not: null } },
            data
        });
        const machine = await db.warehouseMachine.findFirst({ where: { id: req.params.id, branchId: { not: null } } });
        res.json(machine);
    } catch (error) {
        res.status(400).json({ error: 'Update failed' });
    }
});

// POST Exchange Machine
// Incoming customer machines ALWAYS go to CLIENT_REPAIR
router.post('/exchange', authenticateToken, async (req, res) => {
    try {
        const {
            outgoingMachineId,
            customerId,
            incomingMachineId, // PosMachine ID
            incomingNotes,
            performedBy = 'System'
        } = req.body;

        const branchId = req.user.branchId || req.body.branchId;

        // Customer machines always go to CLIENT_REPAIR
        const incomingStatus = 'CLIENT_REPAIR';

        await db.$transaction(async (tx) => {
            // 1. Process Outgoing Machine (Warehouse -> Client) - RULE 1
            const outgoing = await tx.warehouseMachine.findFirst({
                where: { id: outgoingMachineId, branchId: { not: null } }
            });
            if (!outgoing) throw new Error('Outgoing machine not found');
            if (req.user.branchId && outgoing.branchId !== req.user.branchId) throw new Error('Access denied to outgoing machine');

            await tx.warehouseMachine.updateMany({
                where: { id: outgoingMachineId, branchId: { not: null } },
                data: { status: 'SOLD' }
            });

            // Check if this machine already exists with ANY customer - RULE 1
            const existingPos = await tx.posMachine.findFirst({
                where: { serialNumber: outgoing.serialNumber, branchId: { not: null } }
            });

            if (existingPos) {
                // Technically it shouldn't exist because it's in warehouse "SOLD" but let's be safe
                throw new Error(`Machine ${outgoing.serialNumber} already exists with customer ${existingPos.customerId}`);
            }

            // Create PosMachine for client
            await tx.posMachine.create({
                data: {
                    serialNumber: outgoing.serialNumber,
                    model: outgoing.model,
                    manufacturer: outgoing.manufacturer,
                    customerId,
                    isMain: false // Default
                }
            });

            // Fetch Customer Name for Report/Log and check branch
            const customer = await tx.customer.findFirst({
                where: { bkcode: customerId, branchId },
                select: { client_name: true, bkcode: true, address: true, branchId: true }
            });

            if (!customer) throw new Error('Customer not found');
            if (req.user.branchId && customer.branchId !== req.user.branchId) throw new Error('Access denied to customer');

            // 2. Process Incoming Machine (Client -> Warehouse) - RULE 1
            const incomingPos = await tx.posMachine.findFirst({
                where: { id: incomingMachineId, branchId: { not: null } }
            });

            if (!incomingPos) throw new Error('Incoming machine not found');

            const reportData = {
                customer: customer || { bkcode: customerId, client_name: 'Unknown' },
                incomingMachine: {
                    serialNumber: incomingPos.serialNumber,
                    model: incomingPos.model,
                    manufacturer: incomingPos.manufacturer,
                    status: incomingStatus
                },
                outgoingMachine: {
                    serialNumber: outgoing.serialNumber,
                    model: outgoing.model,
                    manufacturer: outgoing.manufacturer
                },
                notes: incomingNotes,
                timestamp: new Date().toISOString()
            };

            const logDetails = JSON.stringify(reportData);

            // Log Outgoing with FULL Report Data using centralized service
            await movementService.logMachineMovement(tx, {
                machineId: outgoing.id,
                serialNumber: outgoing.serialNumber,
                action: 'EXCHANGE_OUT',
                details: reportData,
                performedBy,
                branchId: outgoing.branchId
            });

            // Remove from client - RULE 1
            await tx.posMachine.deleteMany({
                where: { id: incomingMachineId, branchId: { not: null } }
            });

            // Add/Update to Warehouse - RULE 1
            const existingWarehouse = await tx.warehouseMachine.findFirst({
                where: { serialNumber: incomingPos.serialNumber, branchId: { not: null } }
            });

            if (existingWarehouse) {
                // Ensure existing warehouse machine belongs to same branch? 
                // If it exists in warehouse, it should belong to some branch.
                // Assuming it comes back to the branch handling the customer.
                // If it belonged to another branch, we should probably update it to this branch?
                // Or error? Let's claim it for this branch.
                await tx.warehouseMachine.updateMany({
                    where: { id: existingWarehouse.id, branchId: { not: null } },
                    data: {
                        status: incomingStatus,
                        notes: incomingNotes,
                        originalOwnerId: customerId,
                        branchId: branchId // Claim for current branch
                    }
                });
                // Log Update using centralized service
                await movementService.logMachineMovement(tx, {
                    machineId: existingWarehouse.id,
                    serialNumber: existingWarehouse.serialNumber,
                    action: 'EXCHANGE_IN',
                    details: reportData,
                    performedBy,
                    branchId: branchId
                });
            } else {
                const newWarehouse = await tx.warehouseMachine.create({
                    data: {
                        branchId: branchId, // Set branch
                        serialNumber: incomingPos.serialNumber,
                        model: incomingPos.model,
                        manufacturer: incomingPos.manufacturer,
                        status: incomingStatus,
                        notes: incomingNotes,
                        originalOwnerId: customerId
                    }
                });
                // Log Create using centralized service
                await movementService.logMachineMovement(tx, {
                    machineId: newWarehouse.id,
                    serialNumber: newWarehouse.serialNumber,
                    action: 'EXCHANGE_IN',
                    details: reportData,
                    performedBy,
                    branchId: branchId
                });
            }
        });

        // Log to Customer's Audit Trail
        await logAction({
            entityType: 'CUSTOMER',
            entityId: customerId,
            action: 'MACHINE_EXCHANGE',
            details: JSON.stringify({
                outgoing: req.body.outgoingMachineId,
                incoming: req.body.incomingMachineId,
                status: incomingStatus
            }),
            performedBy
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Exchange failed:', error);
        res.status(500).json({ error: error.message || 'Exchange failed' });
    }
});

// POST Return Machine (Client -> Warehouse)
// Customer machines ALWAYS go to CLIENT_REPAIR for external repair tracking
router.post('/return', authenticateToken, async (req, res) => {
    try {
        const {
            machineId, // PosMachine ID
            customerId,
            reason, // e.g. "Maintenance", "End of Contract"
            notes,
            performedBy = 'System',
            status: requestedStatus
        } = req.body;

        const branchId = req.user.branchId || req.body.branchId;
        if (!branchId) return res.status(400).json({ error: 'Branch ID required' });

        // Use requested status if valid, otherwise default to CLIENT_REPAIR
        const validStatuses = ['CLIENT_REPAIR', 'STANDBY', 'DEFECTIVE', 'NEW'];
        const status = (requestedStatus && validStatuses.includes(requestedStatus))
            ? requestedStatus
            : 'CLIENT_REPAIR';

        await db.$transaction(async (tx) => {
            // 1. Find Valid Machine - RULE 1
            const posMachine = await tx.posMachine.findFirst({
                where: { id: machineId, branchId: { not: null } }
            });

            if (!posMachine) throw new Error('Machine not found');
            if (posMachine.customerId !== customerId) throw new Error('Machine does not belong to this customer');

            // 2. Fetch Customer for Report and check branch
            const customer = await tx.customer.findFirst({
                where: { bkcode: customerId, branchId },
                select: { client_name: true, bkcode: true, branchId: true }
            });

            if (!customer) throw new Error('Customer not found');
            if (req.user.branchId && customer.branchId !== req.user.branchId) throw new Error('Access denied to customer');


            const reportData = {
                customer: customer,
                machine: {
                    serialNumber: posMachine.serialNumber,
                    model: posMachine.model,
                    manufacturer: posMachine.manufacturer
                },
                reason,
                notes,
                timestamp: new Date().toISOString()
            };
            const logDetails = JSON.stringify(reportData);

            // 3. Remove from Client - RULE 1
            await tx.posMachine.deleteMany({
                where: { id: machineId, branchId: { not: null } }
            });

            // 4. Add/Update to Warehouse - RULE 1
            const existingWarehouse = await tx.warehouseMachine.findFirst({
                where: { serialNumber: posMachine.serialNumber, branchId: { not: null } }
            });

            if (existingWarehouse) {
                await tx.warehouseMachine.updateMany({
                    where: { id: existingWarehouse.id, branchId: { not: null } },
                    data: {
                        status: status,
                        notes: notes,
                        originalOwnerId: customerId, // Track owner
                        branchId: branchId // Claim for branch
                    }
                });
                // Log using centralized service
                await movementService.logMachineMovement(tx, {
                    machineId: existingWarehouse.id,
                    serialNumber: existingWarehouse.serialNumber,
                    action: 'RETURN_FROM_CLIENT',
                    details: reportData,
                    performedBy,
                    branchId: branchId
                });
            } else {
                const newWarehouse = await tx.warehouseMachine.create({
                    data: {
                        branchId: branchId, // Set branch
                        serialNumber: posMachine.serialNumber,
                        model: posMachine.model,
                        manufacturer: posMachine.manufacturer,
                        status: status,
                        notes: notes,
                        originalOwnerId: customerId // Track owner
                    }
                });
                // Log using centralized service
                await movementService.logMachineMovement(tx, {
                    machineId: newWarehouse.id,
                    serialNumber: newWarehouse.serialNumber,
                    action: 'RETURN_FROM_CLIENT',
                    details: reportData,
                    performedBy,
                    branchId: branchId
                });
            }
        });

        // Log to Customer's Audit Trail
        await logAction({
            entityType: 'CUSTOMER',
            entityId: customerId,
            action: 'MACHINE_RETURN',
            details: JSON.stringify({
                machine: machineId,
                reason,
                status,
                notes
            }),
            performedBy
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Return failed:', error);
        res.status(500).json({ error: error.message || 'Return failed' });
    }
});

// DELETE
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const machine = await db.warehouseMachine.findUnique({ where: { id: req.params.id } });
        if (machine) {
            if (req.user.branchId && machine.branchId !== req.user.branchId) {
                return res.status(403).json({ error: 'Access denied' });
            }
            await db.warehouseMachine.delete({
                where: { id: req.params.id }
            });
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Delete failed' });
    }
});

// POST Return Machine to Customer (After Repair)
// For CLIENT_REPAIR machines that have been fixed and need to go back to customer
router.post('/return-to-customer', authenticateToken, async (req, res) => {
    try {
        const {
            machineId, // WarehouseMachine ID in CLIENT_REPAIR
            customerId, // Can be original owner or different customer
            notes,
            performedBy = 'System'
        } = req.body;

        const branchId = req.user.branchId || req.body.branchId;

        await db.$transaction(async (tx) => {
            // 1. Validate machine is in CLIENT_REPAIR
            const machine = await tx.warehouseMachine.findUnique({
                where: { id: machineId }
            });

            if (!machine) throw new Error('Machine not found');
            if (req.user.branchId && machine.branchId !== req.user.branchId) throw new Error('Access denied to machine');

            if (machine.status === 'AT_CENTER') {
                throw new Error('ط§ظ„ظ…ط§ظƒظٹظ†ط© ظپظٹ ظ…ط±ظƒط² ط§ظ„طµظٹط§ظ†ط©. ظٹط¬ط¨ ط§ط³طھظ„ط§ظ…ظ‡ط§ ط£ظˆظ„ط§ظ‹.');
            }

            if (machine.status !== 'CLIENT_REPAIR' && machine.status !== 'READY_DELIVERY') {
                throw new Error('Machine not in client repair status');
            }

            // 2. Get customer info
            const customer = await tx.customer.findFirst({
                where: { bkcode: customerId, branchId },
                select: { client_name: true, bkcode: true, branchId: true }
            });

            if (!customer) throw new Error('Customer not found');
            if (req.user.branchId && customer.branchId !== req.user.branchId) throw new Error('Access denied to customer');


            // 3. Create/Update customer machine
            const existing = await tx.posMachine.findUnique({
                where: { serialNumber: machine.serialNumber }
            });

            if (existing && existing.customerId !== customerId) {
                throw new Error(`Machine ${machine.serialNumber} already exists with another customer`);
            }

            if (existing) {
                // Update to new/same customer
                await tx.posMachine.update({
                    where: { serialNumber: machine.serialNumber },
                    data: { customerId: customerId }
                });
            } else {
                // Create new customer machine
                await tx.posMachine.create({
                    data: {
                        serialNumber: machine.serialNumber,
                        model: machine.model,
                        manufacturer: machine.manufacturer,
                        customerId: customerId,
                        isMain: false
                    }
                });
            }

            // 4. Remove from warehouse
            await tx.warehouseMachine.delete({
                where: { id: machineId }
            });

            // 5. Log action using centralized service
            await movementService.logMachineMovement(tx, {
                machineId: machine.id,
                serialNumber: machine.serialNumber,
                action: 'RETURN_TO_CUSTOMER',
                details: {
                    customer: customer,
                    notes: notes,
                    timestamp: new Date().toISOString()
                },
                performedBy,
                branchId: machine.branchId
            });
        });

        // Log to Customer's Audit Trail
        await logAction({
            entityType: 'CUSTOMER',
            entityId: customerId,
            action: 'MACHINE_RECEIVED',
            details: JSON.stringify({
                machineId: machineId,
                notes: notes
            }),
            performedBy
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Return to customer failed:', error);
        res.status(500).json({ error: error.message || 'Return to customer failed' });
    }
});

// POST Repair Defective Machine to Standby
// For branch-owned DEFECTIVE machines that have been repaired
router.post('/repair-to-standby', authenticateToken, async (req, res) => {
    try {
        const {
            machineId, // WarehouseMachine ID in DEFECTIVE
            notes,
            performedBy = 'System'
        } = req.body;

        await db.$transaction(async (tx) => {
            // 1. Validate machine is DEFECTIVE
            const machine = await tx.warehouseMachine.findUnique({
                where: { id: machineId }
            });

            if (!machine) throw new Error('Machine not found');
            if (req.user.branchId && machine.branchId !== req.user.branchId) throw new Error('Access denied');

            if (machine.status !== 'DEFECTIVE') {
                throw new Error('Machine is not defective');
            }

            // 2. Update status to STANDBY
            await tx.warehouseMachine.update({
                where: { id: machineId },
                data: {
                    status: 'STANDBY',
                    notes: notes || `Repaired on ${new Date().toISOString()}`
                }
            });

            // 3. Log action
            await tx.machineMovementLog.create({
                data: {
                    machineId: machine.id,
                    serialNumber: machine.serialNumber,
                    action: 'REPAIR_TO_STANDBY',
                    details: `Repaired and moved to standby. ${notes || ''}`,
                    performedBy
                }
            });
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Repair to standby failed:', error);
        res.status(500).json({ error: error.message || 'Repair to standby failed' });
    }
});

// GET Check for duplicate machines (diagnostic endpoint)
router.get('/check-duplicates', authenticateToken, async (req, res) => {
    try {
        console.log('ًں”چ Checking for duplicates...');

        const branchFilter = getBranchFilter(req);

        // Get all warehouse machines
        const warehouseMachines = await db.warehouseMachine.findMany({
            where: branchFilter,
            select: {
                serialNumber: true,
                status: true,
                originalOwnerId: true
            }
        });
        console.log(`Found ${warehouseMachines.length} warehouse machines`);

        // Get all customer machines (filtering by customer branch is harder here efficiently without join)
        // With prisma we can do:
        const customerMachines = await db.posMachine.findMany({
            where: req.user.branchId ? {
                customer: {
                    branchId: req.user.branchId
                }
            } : {},
            select: {
                serialNumber: true,
                customerId: true
            }
        });
        console.log(`Found ${customerMachines.length} customer machines`);

        // Find duplicates
        const customerSerials = new Set(customerMachines.map(m => m.serialNumber));
        const duplicates = warehouseMachines
            .filter(wm => customerSerials.has(wm.serialNumber))
            .map(wm => ({
                serialNumber: wm.serialNumber,
                warehouseStatus: wm.status,
                originalOwnerId: wm.originalOwnerId,
                currentCustomerId: customerMachines.find(cm => cm.serialNumber === wm.serialNumber)?.customerId
            }));

        console.log(`Found ${duplicates.length} duplicates`);

        res.json({
            warehouseCount: warehouseMachines.length,
            customerCount: customerMachines.length,
            duplicateCount: duplicates.length,
            duplicates: duplicates
        });

    } catch (error) {
        console.error('â‌Œ Check duplicates failed:', error);
        res.status(500).json({
            error: 'Failed to check duplicates',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// GET Check for ALL duplicate serial numbers across ALL tables
router.get('/check-all-duplicates', authenticateToken, async (req, res) => {
    try {
        console.log('ًں”چ Checking for duplicates across ALL machines...');

        const branchFilter = getBranchFilter(req);

        // Get all warehouse machines
        const warehouseMachines = await db.warehouseMachine.findMany({
            where: branchFilter,
            select: {
                serialNumber: true,
                status: true,
                importDate: true
            }
        });

        // Get all customer machines
        const customerMachines = await db.posMachine.findMany({
            where: req.user.branchId ? {
                customer: {
                    branchId: req.user.branchId
                }
            } : {},
            select: {
                serialNumber: true,
                customerId: true
            }
        });

        console.log(`Found ${warehouseMachines.length} warehouse machines`);
        console.log(`Found ${customerMachines.length} customer machines`);

        // Combine all machines with their source
        const allMachines = [
            ...warehouseMachines.map(m => ({
                serialNumber: m.serialNumber,
                location: 'WAREHOUSE',
                details: { status: m.status, importDate: m.importDate }
            })),
            ...customerMachines.map(m => ({
                serialNumber: m.serialNumber,
                location: 'CUSTOMER',
                details: { customerId: m.customerId }
            }))
        ];

        // Group by serial number and find duplicates
        const groupedBySerial = {};
        allMachines.forEach(machine => {
            if (!groupedBySerial[machine.serialNumber]) {
                groupedBySerial[machine.serialNumber] = [];
            }
            groupedBySerial[machine.serialNumber].push(machine);
        });

        // Find only duplicates (serialNumber appears more than once)
        const duplicates = Object.entries(groupedBySerial)
            .filter(([serial, machines]) => machines.length > 1)
            .map(([serial, machines]) => ({
                serialNumber: serial,
                count: machines.length,
                locations: machines
            }));

        console.log(`Found ${duplicates.length} duplicate serial numbers`);

        res.json({
            totalMachines: allMachines.length,
            warehouseCount: warehouseMachines.length,
            customerCount: customerMachines.length,
            duplicateCount: duplicates.length,
            duplicates: duplicates
        });

    } catch (error) {
        console.error('â‌Œ Check all duplicates failed:', error);
        res.status(500).json({
            error: 'Failed to check all duplicates',
            details: error.message
        });
    }
});

// POST Clean up duplicate machines (remove from warehouse, keep with customer)
router.post('/cleanup-duplicates', authenticateToken, async (req, res) => {
    try {
        console.log('ًں§¹ Starting duplicate cleanup...');
        const branchFilter = getBranchFilter(req);

        // Get all warehouse machines
        const warehouseMachines = await db.warehouseMachine.findMany({
            where: branchFilter,
            select: {
                id: true,
                serialNumber: true,
                status: true
            }
        });

        // Get all customer machines
        const customerMachines = await db.posMachine.findMany({
            where: req.user.branchId ? {
                customer: {
                    branchId: req.user.branchId
                }
            } : {},
            select: {
                serialNumber: true,
                customerId: true
            }
        });

        // Find duplicates
        const customerMachinesMap = new Map(
            customerMachines.map(m => [m.serialNumber, m.customerId])
        );

        const duplicatesToDelete = warehouseMachines.filter(wm =>
            customerMachinesMap.has(wm.serialNumber)
        );

        console.log(`Found ${duplicatesToDelete.length} duplicates to clean up`);

        if (duplicatesToDelete.length === 0) {
            return res.json({
                success: true,
                message: 'No duplicates found',
                deletedCount: 0
            });
        }

        // Delete duplicates from warehouse
        const deletedIds = duplicatesToDelete.map(m => m.id);
        const deleteResult = await db.warehouseMachine.deleteMany({
            where: {
                id: {
                    in: deletedIds
                }
            }
        });

        // Log the cleanup
        await db.machineMovementLog.create({
            data: {
                serialNumber: 'CLEANUP',
                action: 'DUPLICATE_CLEANUP',
                details: `Removed ${deleteResult.count} duplicate machines from warehouse (kept with customers)`,
                performedBy: req.body.performedBy || 'System'
            }
        });

        console.log(`âœ… Deleted ${deleteResult.count} duplicates from warehouse`);

        res.json({
            success: true,
            message: `Cleaned up ${deleteResult.count} duplicate machines`,
            deletedCount: deleteResult.count,
            deletedMachines: duplicatesToDelete.map(m => ({
                serialNumber: m.serialNumber,
                status: m.status,
                customerId: customerMachinesMap.get(m.serialNumber)
            }))
        });

    } catch (error) {
        console.error('â‌Œ Cleanup failed:', error);
        res.status(500).json({
            error: 'Failed to cleanup duplicates',
            details: error.message
        });
    }
});

// ============================================
// External Repair Routes (طµظٹط§ظ†ط© ط®ط§ط±ط¬ظٹط©)
// ============================================

// POST Withdraw machine for external repair (ط³ط­ط¨ ظ…ط§ظƒظٹظ†ط© ظ„ظ„طµظٹط§ظ†ط© ط§ظ„ط®ط§ط±ط¬ظٹط©)
router.post('/external-repair/withdraw', authenticateToken, async (req, res) => {
    try {
        const { serialNumber, customerId, customerName, requestId, notes } = req.body;
        const branchId = req.user?.branchId || req.body.branchId;
        const performedBy = req.user?.displayName || 'System';

        if (!serialNumber || !customerId) {
            return res.status(400).json({ error: 'Serial number and customer ID are required' });
        }

        // Check if machine exists in PosMachine (customer's machine)
        const customerMachine = await db.posMachine.findUnique({
            where: { serialNumber },
            include: { customer: true }
        });

        if (!customerMachine) {
            return res.status(404).json({ error: 'Machine not found with customer' });
        }

        // Check if already in warehouse
        const existingWarehouse = await db.warehouseMachine.findUnique({
            where: { serialNumber }
        });

        if (existingWarehouse) {
            return res.status(400).json({
                error: 'Machine already in warehouse',
                status: existingWarehouse.status
            });
        }

        // Add to warehouse with EXTERNAL_REPAIR status
        const warehouseMachine = await db.warehouseMachine.create({
            data: {
                id: `ER-${Date.now()}`,
                serialNumber,
                model: customerMachine.model,
                manufacturer: customerMachine.manufacturer,
                status: 'EXTERNAL_REPAIR',
                branchId,
                customerId,
                customerName: customerName || customerMachine.customer?.client_name,
                requestId,
                notes: notes || 'ط³ط­ط¨ ظ„ظ„طµظٹط§ظ†ط© ط§ظ„ط®ط§ط±ط¬ظٹط©',
                importDate: new Date(),
                updatedAt: new Date()
            }
        });

        // Log the action
        await db.machineMovementLog.create({
            data: {
                machineId: warehouseMachine.id,
                serialNumber,
                action: 'WITHDRAW_EXTERNAL',
                details: JSON.stringify({
                    customerId,
                    customerName,
                    requestId,
                    branchId
                }),
                performedBy
            }
        });

        // Update maintenance request status if provided
        if (requestId) {
            await db.maintenanceRequest.update({
                where: { id: requestId },
                data: { status: 'PENDING_TRANSFER' }
            });
        }

        res.json({
            success: true,
            message: 'طھظ… ط³ط­ط¨ ط§ظ„ظ…ط§ظƒظٹظ†ط© ظ„ظ„طµظٹط§ظ†ط© ط§ظ„ط®ط§ط±ط¬ظٹط©',
            machine: warehouseMachine
        });

    } catch (error) {
        console.error('Failed to withdraw machine for external repair:', error);
        res.status(500).json({ error: 'Failed to withdraw machine', details: error.message });
    }
});

// GET External repair machines (ظ…ط§ظƒظٹظ†ط§طھ ط§ظ„طµظٹط§ظ†ط© ط§ظ„ط®ط§ط±ط¬ظٹط©)
router.get('/external-repair', authenticateToken, async (req, res) => {
    try {
        const branchId = req.user?.branchId;
        const { status } = req.query;

        const where = {
            status: {
                in: ['EXTERNAL_REPAIR', 'AT_CENTER', 'READY_DELIVERY']
            }
        };

        if (branchId) {
            where.branchId = branchId;
        }

        if (status) {
            where.status = status;
        }

        const machines = await db.warehouseMachine.findMany({
            where,
            orderBy: { importDate: 'desc' }
        });

        res.json(machines);
    } catch (error) {
        console.error('Failed to fetch external repair machines:', error);
        res.status(500).json({ error: 'Failed to fetch machines' });
    }
});

// PUT Mark machine as ready for pickup (ط¬ط§ظ‡ط² ظ„ظ„طھط³ظ„ظٹظ…)
router.put('/external-repair/:id/ready', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const performedBy = req.user?.displayName || 'System';

        const machine = await db.warehouseMachine.update({
            where: { id },
            data: {
                status: 'READY_DELIVERY',
                readyForPickup: true,
                updatedAt: new Date()
            }
        });

        // Log the action
        await db.machineMovementLog.create({
            data: {
                machineId: id,
                serialNumber: machine.serialNumber,
                action: 'READY_FOR_PICKUP',
                details: 'ط§ظ„ظ…ط§ظƒظٹظ†ط© ط¬ط§ظ‡ط²ط© ظ„ظ„طھط³ظ„ظٹظ… ظ„ظ„ط¹ظ…ظٹظ„',
                performedBy
            }
        });

        res.json({
            success: true,
            message: 'طھظ… طھط­ط¯ظٹط« ط­ط§ظ„ط© ط§ظ„ظ…ط§ظƒظٹظ†ط© - ط¬ط§ظ‡ط²ط© ظ„ظ„طھط³ظ„ظٹظ…',
            machine
        });

    } catch (error) {
        console.error('Failed to update machine status:', error);
        res.status(500).json({ error: 'Failed to update machine status' });
    }
});

// POST Deliver machine to customer (طھط³ظ„ظٹظ… ظ„ظ„ط¹ظ…ظٹظ„)
router.post('/external-repair/:id/deliver', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const performedBy = req.user?.displayName || 'System';

        const machine = await db.warehouseMachine.findUnique({
            where: { id }
        });

        if (!machine) {
            return res.status(404).json({ error: 'Machine not found' });
        }

        if (machine.status !== 'READY_DELIVERY') {
            return res.status(400).json({ error: 'Machine is not ready for delivery' });
        }

        // Close the maintenance request if exists
        if (machine.requestId) {
            await db.maintenanceRequest.update({
                where: { id: machine.requestId },
                data: {
                    status: 'Closed',
                    closingTimestamp: new Date(),
                    closingUserName: performedBy,
                    actionTaken: (await db.maintenanceRequest.findUnique({
                        where: { id: machine.requestId }
                    }))?.actionTaken + '\nطھظ… طھط³ظ„ظٹظ… ط§ظ„ظ…ط§ظƒظٹظ†ط© ظ„ظ„ط¹ظ…ظٹظ„ ط¨ط¹ط¯ ط§ظ„طµظٹط§ظ†ط© ط§ظ„ط®ط§ط±ط¬ظٹط©'
                }
            });
        }

        // Log the action
        await db.machineMovementLog.create({
            data: {
                machineId: id,
                serialNumber: machine.serialNumber,
                action: 'DELIVERED_TO_CUSTOMER',
                details: JSON.stringify({
                    customerId: machine.customerId,
                    customerName: machine.customerName,
                    requestId: machine.requestId
                }),
                performedBy
            }
        });

        // Remove from warehouse
        await db.warehouseMachine.delete({
            where: { id }
        });

        res.json({
            success: true,
            message: 'طھظ… طھط³ظ„ظٹظ… ط§ظ„ظ…ط§ظƒظٹظ†ط© ظ„ظ„ط¹ظ…ظٹظ„ ظˆط¥ط؛ظ„ط§ظ‚ ط§ظ„ط·ظ„ط¨',
            deliveredMachine: machine
        });

    } catch (error) {
        console.error('Failed to deliver machine:', error);
        res.status(500).json({ error: 'Failed to deliver machine', details: error.message });
    }
});

// GET Ready for pickup count (ط¹ط¯ط¯ ط§ظ„ظ…ط§ظƒظٹظ†ط§طھ ط§ظ„ط¬ط§ظ‡ط²ط© ظ„ظ„طھط³ظ„ظٹظ…)
router.get('/external-repair/ready-count', authenticateToken, async (req, res) => {
    try {
        const branchId = req.user?.branchId;

        const where = {
            status: 'READY_DELIVERY',
            readyForPickup: true
        };

        if (branchId) {
            where.branchId = branchId;
        }

        const count = await db.warehouseMachine.count({ where });

        res.json({ count });
    } catch (error) {
        console.error('Failed to get ready count:', error);
        res.status(500).json({ error: 'Failed to get count' });
    }
});

module.exports = router;

