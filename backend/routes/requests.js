const express = require('express');
const router = express.Router();
const db = require('../db');
const requestService = require('../services/requestService');
const authenticateToken = require('../middleware/auth');
const { getBranchFilter, requirePermission, PERMISSIONS } = require('../middleware/permissions');
const { logAction } = require('../utils/logger');

// GET all requests
router.get('/requests', authenticateToken, async (req, res) => {
    try {
        const branchFilter = getBranchFilter(req);
        const targetBranchId = req.query.branchId;
        const where = { ...branchFilter };

        if (targetBranchId && (['SUPER_ADMIN', 'MANAGEMENT', 'CENTER_MANAGER'].includes(req.user.role))) {
            where.branchId = targetBranchId;
        }

        const requests = await db.maintenanceRequest.findMany({
            where,
            include: {
                customer: true,
                posMachine: true,
                branch: true // Include branch info for admins
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(requests);
    } catch (error) {
        console.error('Failed to fetch requests:', error);
        res.status(500).json({ error: 'Failed to fetch requests' });
    }
});

// GET single request
router.get('/requests/:id', authenticateToken, async (req, res) => {
    try {
        const request = await db.maintenanceRequest.findUnique({
            where: { id: req.params.id },
            include: {
                customer: true,
                posMachine: true
            },
            __allow_unscoped: true
        });

        if (request && req.user.branchId && request.branchId !== req.user.branchId) {
            return res.status(403).json({ error: 'Access denied' });
        }
        if (!request) {
            return res.status(404).json({ error: 'Request not found' });
        }
        res.json(request);
    } catch (error) {
        console.error('Failed to fetch request:', error);
        res.status(500).json({ error: 'Failed to fetch request' });
    }
});

// GET monthly repair count for a machine
router.get('/requests/machine/:serialNumber/monthly-count', authenticateToken, async (req, res) => {
    try {
        const { serialNumber } = req.params;
        const { date } = req.query;

        // Find machine ID first
        const machine = await db.posMachine.findUnique({
            where: { serialNumber },
            // We can includes customer to check branch logic but let's check customer's branch
            include: { customer: true },
            __allow_unscoped: true
        });

        if (machine && machine.customer && req.user.branchId && machine.customer.branchId !== req.user.branchId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (!machine) {
            return res.status(404).json({ error: 'Machine not found' });
        }

        // Determine target month based on provided date or current date
        const targetDate = date ? new Date(date) : new Date();
        const startOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);

        // Count closed requests within that specific month UP TO the specific date
        // This ensures that if we print an old report, we get the count AS OF that date.
        const where = {
            posMachineId: machine.id,
            status: 'Closed',
            closingTimestamp: {
                gte: startOfMonth,
                lte: targetDate
            }
        };
        if (req.user.branchId) where.branchId = req.user.branchId;

        const count = await db.maintenanceRequest.count({
            where,
            __allow_unscoped: true
        });

        res.json({ count });
    } catch (error) {
        console.error('Failed to get monthly count:', error);
        res.status(500).json({ error: 'Failed to get monthly count' });
    }
});

// POST create request
router.post('/requests', authenticateToken, async (req, res) => {
    try {
        const branchId = req.user.branchId || req.body.branchId;
        if (!branchId) {
            return res.status(400).json({ error: 'Branch ID is required' });
        }

        const request = await db.$transaction(async (tx) => {
            const newRequest = await tx.maintenanceRequest.create({
                data: {
                    branchId,
                    customerId: req.body.customerId,
                    posMachineId: req.body.machineId,
                    technician: req.body.technicianId || null,
                    status: req.body.status || 'Open',
                    complaint: req.body.problemDescription,
                    createdAt: new Date(),
                }
            });

            // If taking the machine to branch warehouse
            if (req.body.takeMachine && req.body.machineId) {
                // Find machine serial first
                const machine = await tx.posMachine.findUnique({
                    where: { id: req.body.machineId },
                    include: { customer: true }
                });

                if (machine) {
                    await requestService.receiveMachineToWarehouse(tx, {
                        serialNumber: machine.serialNumber,
                        customerId: req.body.customerId,
                        customerName: machine.customer?.client_name || 'Generic Customer',
                        requestId: newRequest.id,
                        branchId: branchId,
                        performedBy: req.user?.displayName || 'System'
                    });
                }
            }

            return newRequest;
        });

        await logAction({
            entityType: 'REQUEST',
            entityId: request.id,
            action: 'CREATE',
            details: `Created request for customer ${req.body.customerId}${req.body.takeMachine ? ' (Machine Received)' : ''}`,
            userId: req.user?.id,
            performedBy: req.user?.displayName || 'System'
        });

        // Also log to Customer's audit trail
        await logAction({
            entityType: 'CUSTOMER',
            entityId: req.body.customerId,
            action: 'REQUEST_CREATED',
            details: JSON.stringify({
                requestId: request.id,
                machineId: req.body.machineId,
                complaint: req.body.problemDescription
            }),
            userId: req.user?.id,
            performedBy: req.user?.displayName || 'System',
            branchId: branchId
        });

        res.status(201).json(request);
    } catch (error) {
        console.error('Failed to create request:', error);
        res.status(500).json({ error: 'Failed to create request' });
    }
});

// PUT assign technician
router.put('/requests/:id/assign', authenticateToken, async (req, res) => {
    try {
        const branchFilter = getBranchFilter(req);
        const where = { id: req.params.id, ...branchFilter };
        
        const existing = await db.maintenanceRequest.findUnique({ where, __allow_unscoped: true });
        if (!existing) return res.status(404).json({ error: 'Request not found' });

        // Get technician name
        const technician = await db.user.findUnique({
            where: { id: req.body.technicianId },
            __allow_unscoped: true
        });
        if (!technician) return res.status(404).json({ error: 'Technician not found' });

        const request = await db.maintenanceRequest.update({
            where,
            data: {
                technician: technician.displayName,
                technicianId: req.body.technicianId,
                status: 'In Progress',
            }
        });

        await logAction({
            entityType: 'REQUEST',
            entityId: request.id,
            action: 'STATUS_CHANGE',
            details: `Assigned to technician ${req.body.technicianId} (In Progress)`,
            userId: req.user?.id,
            performedBy: req.user?.displayName || 'System',
            branchId: req.user?.branchId
        });

        res.json(request);
    } catch (error) {
        console.error('Failed to assign technician:', error);
        res.status(500).json({ error: 'Failed to assign technician' });
    }
});



// ...

// PUT close request
router.put('/requests/:id/close', authenticateToken, async (req, res) => {
    console.log('🚀 Close request endpoint called');
    console.log('   Request ID:', req.params.id);
    console.log('   User:', req.user?.displayName, '(', req.user?.id, ')');
    console.log('   Body keys:', Object.keys(req.body));
    
    try {
        const { actionTaken, usedParts, receiptNumber } = req.body;
        console.log('   Receipt:', receiptNumber);
        console.log('   Parts count:', usedParts?.length || 0);

        const existing = await db.maintenanceRequest.findUnique({ 
            where: { id: req.params.id },
            __allow_unscoped: true 
        });
        
        console.log('   Existing request found:', !!existing);
        if (!existing) {
            console.log('   ❌ Request not found');
            return res.status(404).json({ error: 'Request not found' });
        }

        if (req.user.branchId && existing.branchId !== req.user.branchId) {
            console.log('   ❌ Access denied - branch mismatch');
            return res.status(403).json({ error: 'Access denied' });
        }

        console.log('   ✅ Validation passed, calling closeRequest service...');
        const request = await requestService.closeRequest(
            req.params.id,
            actionTaken,
            usedParts || [],
            {
                id: req.user?.id,
                name: req.user?.name || req.user?.displayName || 'Unknown'
            },
            receiptNumber
        );

        console.log('   ✅ Request closed successfully');
        res.json(request);
    } catch (error) {
        console.error('❌ CLOSE REQUEST ERROR:');
        console.error('   Message:', error.message);
        console.error('   Stack:', error.stack);
        res.status(500).json({ error: error.message || 'Failed to close request' });
    }
});

// PUT deliver machine to customer (final step after external repair)
router.put('/requests/:id/deliver-to-customer', authenticateToken, async (req, res) => {
    try {
        const requestId = req.params.id;
        const { performedBy } = req.body;

        const result = await db.$transaction(async (tx) => {
            // Get maintenance request
            const request = await tx.maintenanceRequest.findUnique({
                where: { id: requestId },
                include: {
                    posMachine: true,
                    customer: true
                }
            });

            if (!request) {
                throw new Error('طلب الصيانة غير موجود');
            }

            // Verify branch access
            if (req.user.branchId && request.branchId !== req.user.branchId) {
                throw new Error('ليس لديك صلاحية الوصول لهذا الطلب');
            }

            // Verify request is ready for delivery
            if (request.status !== 'READY_FOR_DELIVERY') {
                throw new Error(`الطلب ليس جاهزاً للتسليم. الحالة الحالية: ${request.status}`);
            }

            // Get the warehouse machine if it exists
            let warehouseMachine = null;
            if (request.serialNumber) {
                warehouseMachine = await tx.warehouseMachine.findUnique({
                    where: { serialNumber: request.serialNumber }
                });
            }

            // Close the maintenance request
            const closedRequest = await tx.maintenanceRequest.update({
                where: { id: requestId },
                data: {
                    status: 'Closed',
                    closingUserId: req.user.id,
                    closingUserName: req.user.displayName,
                    closingTimestamp: new Date(),
                    actionTaken: warehouseMachine?.resolution === 'REPAIRED' 
                        ? 'تم الإصلاح وتسليم الماكينة للعميل'
                        : warehouseMachine?.resolution === 'SCRAPPED'
                        ? 'الماكينة تالفة - تم إبلاغ العميل'
                        : 'تم تسليم الماكينة للعميل'
                }
            });

            // Update PosMachine if it exists and was repaired
            if (request.posMachineId && warehouseMachine?.resolution === 'REPAIRED') {
                await tx.posMachine.update({
                    where: { id: request.posMachineId },
                    data: {
                        // Machine is back with customer and working
                        // No status change needed as it's already with customer
                    }
                });
            }

            // Update warehouse machine status if exists
            if (warehouseMachine) {
                await tx.warehouseMachine.update({
                    where: { id: warehouseMachine.id },
                    data: {
                        status: warehouseMachine.resolution === 'REPAIRED' ? 'STANDBY' : 'SCRAPPED',
                        notes: `تم تسليم الماكينة للعميل ${request.customerName || request.customerId}`,
                        readyForPickup: false,
                        customerId: warehouseMachine.resolution === 'REPAIRED' ? request.customerId : null,
                        customerName: warehouseMachine.resolution === 'REPAIRED' ? request.customerName : null
                    }
                });

                // Log the delivery
                await tx.machineMovementLog.create({
                    data: {
                        machineId: warehouseMachine.id,
                        serialNumber: warehouseMachine.serialNumber,
                        action: 'DELIVERED_TO_CUSTOMER',
                        details: `تم تسليم الماكينة للعميل ${request.customerName || request.customerId} - النتيجة: ${warehouseMachine.resolution || 'غير محدد'}`,
                        performedBy: performedBy || req.user.displayName,
                        branchId: request.branchId
                    }
                });
            }

            // Log the request closure
            await logAction({
                entityType: 'REQUEST',
                entityId: requestId,
                action: 'DELIVERED_TO_CUSTOMER',
                details: `تم تسليم الماكينة للعميل وإغلاق الطلب - النتيجة: ${warehouseMachine?.resolution || 'غير محدد'}`,
                userId: req.user.id,
                performedBy: performedBy || req.user.displayName,
                branchId: request.branchId
            });

            return closedRequest;
        });

        res.json(result);
    } catch (error) {
        console.error('Failed to deliver to customer:', error);
        res.status(error.status || 500).json({ error: error.message || 'فشل تسليم الماكينة للعميل' });
    }
});

// DELETE request
router.delete('/requests/:id', authenticateToken, async (req, res) => {
    try {
        const request = await db.maintenanceRequest.findUnique({ where: { id: req.params.id }, __allow_unscoped: true });

        if (request) {
            if (req.user.branchId && request.branchId !== req.user.branchId) {
                return res.status(403).json({ error: 'Access denied' });
            }

            await db.maintenanceRequest.delete({ where: { id: req.params.id } });

            await logAction({
                entityType: 'REQUEST',
                entityId: request.id,
                action: 'DELETE',
                details: `Deleted request for customer ${request.customerId}`,
                userId: req.user?.id,
                performedBy: req.user?.displayName || 'Admin',
                branchId: req.user?.branchId
            });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Failed to delete request:', error);
        res.status(500).json({ error: 'Failed to delete request' });
    }
});

// GET technicians
router.get('/technicians', authenticateToken, async (req, res) => {
    try {
        const where = {
            OR: [
                { role: 'Technician' },
                { canDoMaintenance: true }
            ]
        };

        if (req.user.branchId) {
            where.branchId = req.user.branchId;
        } else if (req.query.branchId) {
            where.branchId = req.query.branchId;
        }

        const techs = await db.user.findMany({
            where,
            orderBy: { displayName: 'asc' }
        });
        res.json(techs);
    } catch (error) {
        console.error('Failed to fetch technicians:', error);
        res.status(500).json({ error: 'Failed to fetch technicians' });
    }
});

module.exports = router;
