const express = require('express');
const router = express.Router();
const db = require('../../../../db');
const { authenticateToken } = require('../../../../middleware/auth');
const { success, error, paginated } = require('../../../../utils/apiResponse');
const { ROLES, isGlobalRole } = require('../../../../utils/constants');

// POST Withdraw for external repair
router.post('/withdraw', authenticateToken, async (req, res) => {
    try {
        const { serialNumber, customerId, customerName, requestId, notes } = req.body;
        const branchId = req.user?.branchId || req.body.branchId;
        const performedBy = req.user?.displayName || 'System';

        if (!serialNumber || !customerId) return error(res, 'Serial/Customer missing', 400);

        // RULE 1: Must include branchId filter
        const customerMachine = await db.posMachine.findFirst({
            where: { serialNumber },
            include: { customer: true }
        });
        if (!customerMachine) return error(res, 'Machine not found', 404);

        const existingWarehouse = await db.warehouseMachine.findFirst({
            where: { serialNumber }
        });
        if (existingWarehouse) return error(res, 'Already in warehouse', 400);

        const warehouseMachine = await db.warehouseMachine.create({
            data: {
                id: `ER-${Date.now()}`, serialNumber, model: customerMachine.model, manufacturer: customerMachine.manufacturer,
                status: 'EXTERNAL_REPAIR', branchId, customerId, customerName: customerName || customerMachine.customer?.client_name,
                requestId, notes: notes || 'سحب للصيانة الخارجية'
            }
        });

        await db.machineMovementLog.create({
            data: {
                machineId: warehouseMachine.id,
                serialNumber,
                action: 'WITHDRAW_EXTERNAL',
                performedBy,
                branchId: branchId
            }
        });

        if (requestId) {
            await db.maintenanceRequest.update({
                where: { id: requestId },
                data: { status: 'PENDING_TRANSFER' }
            });
        }

        return success(res, { success: true, machine: warehouseMachine });
    } catch (err) {
        return error(res, err.message);
    }
});

// Pagination helpers removed

// GET External repairs - PAGINATED
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { status } = req.query;
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        const where = { status: { in: ['EXTERNAL_REPAIR', 'AT_CENTER', 'READY_DELIVERY'] } };

        if (status) where.status = status;

        const [machines, total] = await Promise.all([
            db.warehouseMachine.findMany({
                where,
                orderBy: { importDate: 'desc' },
                take: limit,
                skip: offset
            }),
            db.warehouseMachine.count({ where })
        ]);

        return paginated(res, machines, total, limit, offset);
    } catch (err) {
        return error(res, 'Failed');
    }
});

// PUT Ready
router.put('/:id/ready', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const branchId = req.user.branchId;
        if (!branchId) return error(res, 'Branch ID required', 400);

        const result = await db.warehouseMachine.updateMany({
            where: { id, branchId },
            data: { status: 'READY_DELIVERY', readyForPickup: true }
        });

        if (result.count === 0) return error(res, 'Machine not found or access denied', 404);

        return success(res, { success: true });
    } catch (err) {
        return error(res, 'Failed');
    }
});

// POST Deliver
router.post('/:id/deliver', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        const machine = await db.warehouseMachine.findUnique({
            where: { id }
        });

        if (!machine || machine.status !== 'READY_DELIVERY') {
            return error(res, 'Invalid machine status or not found', 400);
        }

        if (machine.requestId) {
            await db.maintenanceRequest.update({
                where: { id: machine.requestId },
                data: { status: 'Closed' }
            });
        }

        await db.warehouseMachine.delete({
            where: { id }
        });

        return success(res, { success: true });
    } catch (err) {
        return error(res, 'Failed');
    }
});

module.exports = router;
