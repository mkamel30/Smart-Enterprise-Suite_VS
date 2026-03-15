const express = require('express');
const router = express.Router();
const db = require('../../../../db');
const { success, error, paginated } = require('../../../../utils/apiResponse');
const { ROLES } = require('../../../../utils/constants');
const { logAction } = require('../../../../utils/logger');
const { authenticateToken } = require('../../../../middleware/auth');
const transferService = require('../transfer.service.js');
const movementService = require('../../shared/movement.service.js');
const { ensureBranchWhere } = require('../../../../prisma/branchHelpers');

// POST Return to Branch
router.post('/return-to-branch', authenticateToken, async (req, res) => {
    try {
        const { serialNumbers, toBranchId, waybillNumber, notes, performedBy } = req.body;
        const fromBranchId = req.user.branchId;

        if (!serialNumbers?.length || !toBranchId) return res.status(400).json({ error: 'Required fields missing' });
        if (!['CENTER_MANAGER', 'CENTER_TECH', 'SUPER_ADMIN'].includes(req.user.role)) return res.status(403).json({ error: 'Unauthorized' });

        const machines = await db.warehouseMachine.findMany({
            where: { serialNumber: { in: serialNumbers }, branchId: fromBranchId, status: 'READY_FOR_RETURN' }
        });
        if (machines.length !== serialNumbers.length) throw new Error('Some machines not ready');

        const result = await transferService.createTransferOrder({
            fromBranchId,
            toBranchId,
            waybillNumber,
            type: 'MACHINE',
            notes,
            createdBy: req.user.id,
            createdByName: performedBy || req.user.displayName,
            items: machines.map(m => ({
                serialNumber: m.serialNumber,
                type: 'MACHINE',
                model: m.model,
                manufacturer: m.manufacturer
            }))
        }, req.user);

        return success(res, result);
    } catch (err) {
        return error(res, err.message);
    }
});

// POST Exchange
router.post('/exchange', authenticateToken, async (req, res) => {
    try {
        const { outgoingMachineId, customerId, incomingMachineId, incomingNotes, performedBy = 'System' } = req.body;
        const allowedBranchId = req.user.branchId || req.body.branchId;
        if (!allowedBranchId) throw new Error('Branch ID required');

        await db.$transaction(async (tx) => {
            // 1. Get the existing machine record currently held by the customer
            const incomingPos = await tx.posMachine.findFirst({ where: { id: incomingMachineId } });
            if (!incomingPos) throw new Error('الماكينة الحالية غير موجودة في سجلات العميل');

            // 2. Get the new machine from warehouse
            const outgoing = await tx.warehouseMachine.findFirst({ where: { id: outgoingMachineId, branchId: allowedBranchId } });
            if (!outgoing) throw new Error('الماكينة الجديدة غير موجودة في مخزن الفرع');

            // 3. Mark warehouse machine as SOLD
            await tx.warehouseMachine.updateMany({
                where: { id: outgoingMachineId, branchId: allowedBranchId },
                data: { status: 'SOLD' }
            });

            // 4. Get Customer
            const customer = await tx.customer.findFirst({ where: { bkcode: customerId, branchId: allowedBranchId } });
            if (!customer) throw new Error('العميل غير موجود');

            // 5. Create new PosMachine record, PRESERVING posId and isMain status
            await tx.posMachine.create({
                data: {
                    serialNumber: outgoing.serialNumber,
                    model: outgoing.model,
                    manufacturer: outgoing.manufacturer,
                    customerId: customer.id,
                    branchId: customer.branchId,
                    posId: incomingPos.posId
                }
            });

            // 6. Delete the old machine record from customer's inventory
            await tx.posMachine.deleteMany({ where: { id: incomingMachineId, branchId: allowedBranchId } });

            // 7. Return the old machine to the warehouse for repair/audit
            const existing = await tx.warehouseMachine.findFirst({ where: { serialNumber: incomingPos.serialNumber, branchId: allowedBranchId } });
            if (existing) {
                await tx.warehouseMachine.update({
                    where: { id: existing.id },
                    data: { status: 'CLIENT_REPAIR', branchId: allowedBranchId }
                });
            } else {
                await tx.warehouseMachine.create({
                    data: {
                        branchId: allowedBranchId,
                        serialNumber: incomingPos.serialNumber,
                        model: incomingPos.model,
                        manufacturer: incomingPos.manufacturer,
                        status: 'CLIENT_REPAIR'
                    }
                });
            }

            // 8. Log the exchange action for audit
            await logAction({
                entityType: 'CUSTOMER',
                entityId: customer.id,
                action: 'MACHINE_EXCHANGE',
                details: `استبدال الماكينة ${incomingPos.serialNumber} بالجديدة ${outgoing.serialNumber} (مع الابقاء على Terminal ID: ${incomingPos.posId || 'N/A'})`,
                userId: req.user.id,
                performedBy: performedBy || req.user.displayName,
                branchId: allowedBranchId
            }, tx);
        });
        return success(res, { success: true });
    } catch (err) {
        return error(res, err.message);
    }
});

// POST Return From Client
router.post('/return', authenticateToken, async (req, res) => {
    try {
        const { customerId, machineId, status = 'STANDBY', reason, notes, performedBy = 'System' } = req.body;
        const validBranchId = req.user.branchId || req.body.branchId;
        if (!validBranchId) return res.status(400).json({ error: 'Branch ID required' });

        await db.$transaction(async (tx) => {
            const customer = await tx.customer.findFirst({ where: { bkcode: customerId, branchId: validBranchId } });
            if (!customer) throw new Error('Customer not found');
            const posMachine = await tx.posMachine.findFirst({ where: { id: machineId, customerId: customer.id } });
            if (!posMachine) throw new Error('Machine not found');

            await tx.posMachine.deleteMany({ where: { id: machineId, branchId: validBranchId } });
            const existing = await tx.warehouseMachine.findFirst({ where: { serialNumber: posMachine.serialNumber, branchId: validBranchId } });
            if (existing) {
                await tx.warehouseMachine.update({
                    where: { id: existing.id },
                    data: { status, branchId: validBranchId }
                });
            } else {
                await tx.warehouseMachine.create({
                    data: {
                        branchId: validBranchId,
                        serialNumber: posMachine.serialNumber,
                        model: posMachine.model,
                        manufacturer: posMachine.manufacturer,
                        status
                    }
                });
            }
        });
        return success(res, { success: true });
    } catch (err) {
        return error(res, err.message);
    }
});

module.exports = router;
