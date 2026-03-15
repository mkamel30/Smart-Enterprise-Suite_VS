const express = require('express');
const router = express.Router();
const { z } = require('zod');
const db = require('../../db');
const { authenticateToken } = require('../../middleware/auth');
const { validateRequest } = require('../../middleware/validation');
const { success, error, paginated } = require('../../utils/apiResponse');
const { ROLES } = require('../../utils/constants');
const movementService = require('../../services/movementService');
const transferService = require('../../services/transferService');

const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

const assignSimSchema = z.object({
    customerId: z.string().min(1),
    simId: z.string().min(1),
    cost: z.number().optional(),
    receiptNumber: z.string().optional(),
    paymentPlace: z.string().optional(),
    performedBy: z.string().optional()
});

const exchangeSimSchema = z.object({
    customerId: z.string().min(1),
    returningSimSerial: z.string().min(1),
    newSimId: z.string().min(1),
    returningStatus: z.enum(['ACTIVE', 'DEFECTIVE']).optional(),
    returningType: z.string().optional(),
    cost: z.number().optional(),
    receiptNumber: z.string().optional(),
    paymentPlace: z.string().optional(),
    notes: z.string().optional(),
    performedBy: z.string().optional()
});

const returnSimSchema = z.object({
    customerId: z.string().min(1),
    simSerial: z.string().min(1),
    status: z.enum(['ACTIVE', 'DEFECTIVE']).optional(),
    type: z.string().optional(),
    notes: z.string().optional(),
    performedBy: z.string().optional()
});

// POST Assign
router.post('/assign', authenticateToken, validateRequest(assignSimSchema), asyncHandler(async (req, res) => {
    const { customerId, simId, cost, receiptNumber, paymentPlace, performedBy } = req.body;
    const warehouseSim = await db.warehouseSim.findFirst({ where: { id: simId, branchId: req.user.branchId || { not: null } } });
    if (!warehouseSim) throw { statusCode: 404, message: 'SIM not found' };
    const customer = await db.customer.findFirst({ where: { bkcode: customerId } });
    if (!customer) throw { statusCode: 404, message: 'Customer not found' };

    const result = await db.$transaction(async (tx) => {
        if (cost > 0) await tx.payment.create({
            data: {
                branchId: customer.branchId,
                customerId: customer.id,
                customerName: customer.client_name,
                amount: cost,
                paymentMethod: 'CASH',
                type: 'SALE',
                reason: 'SIM_CARD',
                receiptNumber,
                paymentPlace: paymentPlace || 'BRANCH',
                notes: `Purchase of SIM ${warehouseSim.serialNumber}`,
                userName: req.user.displayName || req.user.email,
                userId: req.user.id
            }
        });
        const clientSim = await tx.simCard.create({ data: { branchId: customer.branchId, customerId: customer.id, serialNumber: warehouseSim.serialNumber, type: warehouseSim.type, networkType: warehouseSim.networkType, notes: `Purchased - Receipt ${receiptNumber || 'N/A'}` } });
        await tx.warehouseSim.delete({ where: { id: simId } });
        await movementService.logSimMovement(tx, { simId: warehouseSim.id, serialNumber: warehouseSim.serialNumber, action: 'ASSIGN', customerId, details: { cost: cost || 0, receiptNumber }, performedBy: req.user?.displayName || performedBy || req.user?.email || 'System', branchId: customer.branchId });
        return clientSim;
    });
    return success(res, { success: true, simCard: result });
}));

// POST Exchange
router.post('/exchange', authenticateToken, validateRequest(exchangeSimSchema), asyncHandler(async (req, res) => {
    const { customerId, returningSimSerial, newSimId, returningStatus, returningType, cost, receiptNumber, paymentPlace, notes, performedBy } = req.body;
    const branchId = req.user.branchId || req.body.branchId;

    const [customer, oldClientSim, newSim] = await Promise.all([
        db.customer.findFirst({ where: { bkcode: customerId, branchId } }),
        db.simCard.findFirst({ where: { serialNumber: returningSimSerial, branchId } }),
        db.warehouseSim.findFirst({ where: { id: newSimId, branchId } })
    ]);

    if (!customer) throw { statusCode: 404, message: 'Customer not found' };
    if (!oldClientSim) throw { statusCode: 404, message: 'Old SIM not found' };
    if (!newSim) throw { statusCode: 404, message: 'New SIM not found' };

    await db.$transaction(async (tx) => {
        if (cost > 0) await tx.payment.create({
            data: {
                branchId: customer.branchId,
                customerId: customer.id,
                customerName: customer.client_name,
                amount: cost,
                paymentMethod: 'CASH',
                type: 'SALE',
                reason: 'SIM_EXCHANGE',
                receiptNumber,
                paymentPlace: paymentPlace || 'BRANCH',
                notes: `Exchange SIM ${returningSimSerial} for ${newSim.serialNumber}`,
                userName: req.user.displayName || req.user.email,
                userId: req.user.id
            }
        });

        // Log both sides of the movement for complete history
        // 1. New SIM assigned to customer
        await tx.simCard.delete({ where: { id: oldClientSim.id } });
        await tx.simCard.create({ data: { branchId: customer.branchId, customerId: customer.id, serialNumber: newSim.serialNumber, type: newSim.type, networkType: newSim.networkType, notes: `Exchanged from ${returningSimSerial}` } });

        // 2. New SIM leaves warehouse
        await tx.warehouseSim.delete({ where: { id: newSimId } });
        await movementService.logSimMovement(tx, { simId: newSim.id, serialNumber: newSim.serialNumber, action: 'EXCHANGE_OUT', customerId, details: { cost: cost || 0, receiptNumber, oldSim: returningSimSerial }, performedBy: req.user?.displayName || performedBy || req.user?.email || 'System', branchId: customer.branchId });

        // 3. Returning SIM added to warehouse
        await tx.warehouseSim.create({ data: { branchId: branchId || customer.branchId, serialNumber: returningSimSerial, type: returningType || oldClientSim.type, networkType: oldClientSim.networkType, status: returningStatus || 'DEFECTIVE', notes: notes || `Returned from exchange for ${newSim.serialNumber}` } });
        await movementService.logSimMovement(tx, { simId: oldClientSim.id, serialNumber: returningSimSerial, action: 'EXCHANGE_IN', customerId, details: { status: returningStatus || 'DEFECTIVE', newSim: newSim.serialNumber }, performedBy: req.user?.displayName || performedBy || req.user?.email || 'System', branchId: customer.branchId });
    });
    return success(res, { success: true });
}));

// POST Return
router.post('/return', authenticateToken, validateRequest(returnSimSchema), asyncHandler(async (req, res) => {
    const { customerId, simSerial, status, type, notes, performedBy } = req.body;
    const branchId = req.user.branchId || req.body.branchId;

    const [customer, clientSim] = await Promise.all([
        db.customer.findFirst({ where: { bkcode: customerId, branchId } }),
        db.simCard.findFirst({ where: { serialNumber: simSerial, branchId } })
    ]);

    if (!customer || !clientSim) throw { statusCode: 404, message: 'Not found' };

    await db.$transaction(async (tx) => {
        await tx.simCard.delete({ where: { id: clientSim.id } });
        await tx.warehouseSim.create({ data: { branchId, serialNumber: simSerial, type: type || clientSim.type, networkType: clientSim.networkType, status: status || 'ACTIVE', notes: notes || 'Returned from customer' } });
        await movementService.logSimMovement(tx, { simId: clientSim.id, serialNumber: simSerial, action: 'RETURN', customerId, details: { status: status || 'ACTIVE', notes }, performedBy: req.user?.displayName || performedBy || req.user?.email || 'System', branchId });
    });
    return success(res, { success: true });
}));

// POST Bulk Transfer
router.post('/bulk-transfer', authenticateToken, asyncHandler(async (req, res) => {
    const { simIds, targetBranchId, notes } = req.body;
    if (!simIds?.length || !targetBranchId) return res.status(400).json({ error: 'Missing data' });
    const fromBranchId = req.user.branchId;
    if (!fromBranchId && req.user.role !== 'SUPER_ADMIN') {
        return res.status(400).json({ error: 'Branch ID required' });
    }
    // For super admin without branch, require explicit fromBranchId in body
    const effectiveFromBranchId = fromBranchId || req.body.fromBranchId;
    if (!effectiveFromBranchId) {
        return res.status(400).json({ error: 'Source Branch ID required' });
    }

    const sims = await db.warehouseSim.findMany({ where: { id: { in: simIds }, branchId: effectiveFromBranchId } });
    if (sims.length !== simIds.length) throw new Error('Some SIMs not found');

    const result = await transferService.createTransferOrder({
        fromBranchId: effectiveFromBranchId,
        toBranchId: targetBranchId,
        type: 'SIM',
        notes,
        createdBy: req.user.id,
        createdByName: req.user.displayName,
        items: sims.map(s => ({
            serialNumber: s.serialNumber,
            type: 'SIM',
            model: s.type
        }))
    }, req.user);

    return success(res, result);
}));

module.exports = router;
