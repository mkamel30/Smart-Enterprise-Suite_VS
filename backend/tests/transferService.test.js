// We'll require the service after setting up doMock/jest mocks so the mocked Prisma client is used.

// Use shared mock helper
const { createMockPrismaClient } = require('./helpers/mockPrismaClient');
const mockPrismaClient = createMockPrismaClient();

// Mock PrismaClient to return our shared mock
// Mock @prisma/client to return our shared mock at runtime
jest.doMock('@prisma/client', () => ({
    PrismaClient: jest.fn(() => mockPrismaClient),
}));

// Mock db (the instance of PrismaClient) to the same shared mock
// Use doMock so the mock is registered at runtime (not hoisted) and can reference `mockPrismaClient`
jest.doMock('../db', () => mockPrismaClient);

jest.doMock('../middleware/auth', () => {
    const authFn = (req, res, next) => next();
    authFn.generateAccessToken = jest.fn(() => 'mockAccessToken');
    authFn.requireAdmin = jest.fn((req, res, next) => next());
    return authFn;
});

// Mock notifications helper so tests don't call real notification implementation
jest.doMock('../routes/notifications', () => {
    const db = require('../db');
    return {
        createNotification: jest.fn(async (opts) => {
            // forward to mocked Prisma notification.create so tests can assert on it
            try {
                if (db && db.notification && db.notification.create) {
                    await db.notification.create(opts);
                }
            } catch (e) {
                // swallow for tests
            }
            return {};
        }),
    };
});
// Now require the service under test so it picks up our mocks
// Require the mocked db and then the service so imports use the mocks
const db = require('../db');
const { createTransferOrder, receiveTransferOrder, rejectOrder, cancelOrder } = require('../services/transferService');

describe('transferService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset the mock PrismaClient's methods before each test
        mockPrismaClient.$transaction.mockImplementation(async (callback) => await callback(mockPrismaClient));
        mockPrismaClient.transferOrder.create.mockReset();
        mockPrismaClient.transferOrder.update.mockReset();
        mockPrismaClient.transferOrder.findUnique.mockReset();
        mockPrismaClient.transferOrder.findMany.mockReset();
        mockPrismaClient.warehouseItem.updateMany.mockReset();
        mockPrismaClient.warehouseItem.findMany.mockReset();
        mockPrismaClient.maintenanceRequest.update.mockReset();
        mockPrismaClient.notification.create.mockReset();
        mockPrismaClient.notification.create.mockReset();
        mockPrismaClient.transferOrder.updateMany.mockReset();
        mockPrismaClient.warehouseMachine.findFirst.mockReset();
        mockPrismaClient.warehouseSim.findMany.mockReset();
        mockPrismaClient.transferOrderItem.findMany.mockResolvedValue([]);
        mockPrismaClient.maintenanceRequest.findMany.mockResolvedValue([]);
        // Also reset the directly imported db mock
        db.$transaction.mockImplementation(async (callback) => await callback(mockPrismaClient));
        db.transferOrder.create.mockReset();
        db.transferOrder.update.mockReset();
        db.transferOrder.findUnique.mockReset();
        db.transferOrder.findMany.mockReset();
        db.warehouseItem.updateMany.mockReset();
        db.warehouseItem.findMany.mockReset();
        db.maintenanceRequest.update.mockReset();
        db.maintenanceRequest.update.mockReset();
        db.notification.create.mockReset();
        db.branch.findUnique.mockReset();

        // Default behavior: Active branches to pass standard validation
        const activeBranchMock = { isActive: true, type: 'BRANCH' };
        mockPrismaClient.branch.findUnique.mockImplementation(async ({ where }) => ({ id: where.id, name: 'Branch ' + where.id, ...activeBranchMock }));
        db.branch.findUnique.mockImplementation(async ({ where }) => ({ id: where.id, name: 'Branch ' + where.id, ...activeBranchMock }));
    });

    describe('createTransferOrder', () => {
        it('should create a transfer order within a transaction', async () => {
            const mockUser = { id: 'user1', branchId: 'branchA', role: 'MANAGEMENT' };
            const mockOrderData = {
                toBranchId: 'branchB',
                type: 'SIM',
                items: [{ id: 'item1', quantity: 1, serialNumber: 'S1' }],
                description: 'Test transfer',
            };
            const mockTransferOrder = {
                id: 'transfer1',
                fromBranchId: 'branchA',
                toBranchId: 'branchB',
                status: 'PENDING',
                // ... other fields
            };



            // Validation requires active branches
            db.branch.findUnique.mockResolvedValue({ id: 'branchA', isActive: true, type: 'BRANCH' });
            // Mock items validation lookups if needed (warehouseMachine/Sim)
            db.warehouseSim.findUnique.mockResolvedValue({ id: 'item1', quantity: 1, status: 'ACTIVE' });
            db.warehouseMachine.findUnique.mockResolvedValue({ id: 'item1', status: 'NEW' });

            // Mock items validation lookups if needed (warehouseMachine/Sim)
            db.warehouseSim.findUnique.mockResolvedValue({ id: 'item1', quantity: 1, status: 'ACTIVE' });
            // Validator uses findMany for SIMs
            db.warehouseSim.findMany.mockResolvedValue([{ id: 'item1', quantity: 1, status: 'ACTIVE', branchId: 'branchA', serialNumber: 'S1' }]);
            db.warehouseMachine.findUnique.mockResolvedValue({ id: 'item1', status: 'NEW' });

            db.transferOrder.create.mockResolvedValue(mockTransferOrder);
            db.warehouseSim.updateMany.mockResolvedValue({ count: 1 });
            db.maintenanceRequest.update.mockResolvedValue({});
            db.notification.create.mockResolvedValue({});

            const result = await createTransferOrder(mockOrderData, mockUser);

            // Service calls $transaction once for createTransferOrder
            expect(db.$transaction).toHaveBeenCalledTimes(1);
            expect(db.transferOrder.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        fromBranchId: 'branchA',
                        toBranchId: 'branchB',
                        createdByUserId: 'user1',
                        type: 'SIM',
                        items: expect.objectContaining({ create: expect.any(Array) }),
                    }),
                })
            );
            expect(db.maintenanceRequest.update).toHaveBeenCalledTimes(0); // No maintenance request in this mock
            expect(db.notification.create).toHaveBeenCalledTimes(1);
            expect(result).toEqual(mockTransferOrder);
        });

        it('should rollback if an error occurs during creation', async () => {
            const mockUser = { id: 'user1', branchId: 'branchA', role: 'MANAGEMENT' };
            const mockOrderData = {
                toBranchId: 'branchB',
                type: 'SIM',
                items: [{ id: 'item1', quantity: 1, serialNumber: 'S1' }],
                description: 'Test transfer',
            };
            const error = new Error('Database error');



            // Validation must pass first
            db.branch.findUnique.mockResolvedValue({ id: 'branchA', isActive: true, type: 'BRANCH' });
            // Validation must pass first
            db.branch.findUnique.mockResolvedValue({ id: 'branchA', isActive: true, type: 'BRANCH' });
            db.warehouseSim.findUnique.mockResolvedValue({ id: 'item1', quantity: 1, status: 'ACTIVE' });
            db.warehouseSim.findMany.mockResolvedValue([{ id: 'item1', quantity: 1, status: 'ACTIVE', branchId: 'branchA', serialNumber: 'S1' }]);

            db.transferOrder.create.mockRejectedValue(error);

            await expect(createTransferOrder(mockOrderData, mockUser)).rejects.toThrow('Database error');
            // Service calls $transaction once for createTransferOrder rollback
            expect(db.$transaction).toHaveBeenCalledTimes(1);
            expect(db.transferOrder.create).toHaveBeenCalledTimes(1);
            // Ensure no other operations were called if the first one failed
            expect(db.warehouseItem.updateMany).not.toHaveBeenCalled();
            expect(db.notification.create).not.toHaveBeenCalled();
        });
    });

    describe('receiveTransferOrder', () => {
        it('should receive a transfer order within a transaction', async () => {
            db.maintenanceRequest.updateMany = jest.fn().mockResolvedValue({ count: 1 });
            db.warehouseMachine.updateMany = jest.fn().mockResolvedValue({ count: 1 });
            db.warehouseMachine.update = jest.fn().mockResolvedValue({});
            db.warehouseMachine.update = jest.fn().mockResolvedValue({});
            db.warehouseMachine.update = jest.fn().mockResolvedValue({});
            const mockUser = { id: 'user2', branchId: 'branchB', role: 'SUPER_ADMIN' };
            const transferOrderId = 'transfer1';
            const mockTransferOrder = {
                id: transferOrderId,
                fromBranchId: 'branchA',
                branchId: 'branchA',
                toBranchId: 'branchB',
                status: 'PENDING',
                type: 'MACHINE',
                items: [{ id: 'tItem1', warehouseItemId: 'item1', quantity: 1, status: 'IN_TRANSIT', serialNumber: 'SN123' }],
            };

            // initial findUnique should return the pending order, then after transaction return RECEIVED
            db.transferOrder.findFirst.mockResolvedValueOnce(mockTransferOrder);
            db.transferOrder.update.mockResolvedValue({ ...mockTransferOrder, status: 'RECEIVED' });
            db.warehouseItem.updateMany.mockResolvedValue({ count: 1 });
            db.warehouseMachine.updateMany.mockResolvedValue({ count: 1 });
            db.warehouseSim.updateMany.mockResolvedValue({ count: 1 });
            db.notification.create.mockResolvedValue({});

            // Add required args: receivedBy, receivedByName, receivedItems, user
            // Use only the transaction context for all mocks and assertions
            let txUsed;
            db.$transaction.mockImplementationOnce(async (callback) => {
                const tx = {
                    ...mockPrismaClient,
                    warehouseMachine: {
                        ...mockPrismaClient.warehouseMachine,
                        update: jest.fn().mockResolvedValue({}),
                        findFirst: jest.fn(({ where }) => {
                            if (where && where.serialNumber) {
                                return { id: 'machine-' + where.serialNumber, branchId: 'branchA', status: 'IN_TRANSIT' };
                            }
                            return null;
                        }),
                    },
                    transferOrder: {
                        ...mockPrismaClient.transferOrder,
                        update: jest.fn().mockResolvedValue({ ...mockTransferOrder, status: 'RECEIVED' }),
                        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
                    },
                    maintenanceRequest: {
                        ...mockPrismaClient.maintenanceRequest,
                        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
                    },
                };
                txUsed = tx;
                return await callback(tx);
            });
            // Ensure the final read after transaction returns the updated status
            db.transferOrder.findFirst.mockResolvedValueOnce({ ...mockTransferOrder, status: 'RECEIVED' });
            const result = await receiveTransferOrder(transferOrderId, {}, mockUser);
            expect(txUsed.warehouseMachine.updateMany).toHaveBeenCalled();
            expect(result.status).toBe('RECEIVED');
        });

        it('should throw if order not found', async () => {
            const mockUser = { id: 'user2', branchId: 'branchB', role: 'MANAGEMENT' };
            const transferOrderId = 'transfer1';

            db.transferOrder.findFirst.mockResolvedValue(null);

            await expect(receiveTransferOrder(transferOrderId, {}, mockUser)).rejects.toThrow('الإذن غير موجود');
            expect(db.$transaction).toHaveBeenCalledTimes(0); // No transaction should start if order not found
        });

        it('should rollback if an error occurs during reception', async () => {
            const mockUser = { id: 'user2', branchId: 'branchB', role: 'MANAGEMENT' };
            const transferOrderId = 'transfer1';
            const mockTransferOrder = {
                id: transferOrderId,
                fromBranchId: 'branchA',
                toBranchId: 'branchB',
                status: 'PENDING',
                items: [{ id: 'tItem1', warehouseItemId: 'item1', quantity: 1, status: 'PENDING' }],
                warehouseItems: [{ id: 'item1', branchId: 'branchA', status: 'PENDER_TRANSFER' }],
            };
            const error = new Error('DB update error');

            db.transferOrder.findFirst.mockResolvedValue(mockTransferOrder);
            db.transferOrder.updateMany.mockRejectedValue(error);

            await expect(receiveTransferOrder(transferOrderId, {}, mockUser)).rejects.toThrow('DB update error');
            expect(db.$transaction).toHaveBeenCalledTimes(1);
            expect(db.transferOrder.findFirst).toHaveBeenCalledTimes(1);
            expect(db.transferOrder.updateMany).toHaveBeenCalledTimes(1);
            expect(db.warehouseItem.updateMany).not.toHaveBeenCalled(); // Should not have been called if update fails
            expect(db.notification.create).not.toHaveBeenCalled();
        });
    });

    describe('rejectOrder', () => {
        it('should reject a transfer order within a transaction', async () => {
            db.maintenanceRequest.updateMany = jest.fn().mockResolvedValue({ count: 1 });
            db.warehouseMachine.updateMany = jest.fn().mockResolvedValue({ count: 1 });
            db.warehouseMachine.findUnique.mockResolvedValue({ id: 'machine1', branchId: 'branchA', status: 'IN_TRANSIT' });
            db.warehouseMachine.update = jest.fn().mockResolvedValue({});
            db.warehouseMachine.update = jest.fn().mockResolvedValue({});
            const mockUser = { id: 'user2', branchId: 'branchB', role: 'MANAGEMENT' };
            const transferOrderId = 'transfer1';
            const mockTransferOrder = {
                id: transferOrderId,
                fromBranchId: 'branchA',
                branchId: 'branchA',
                toBranchId: 'branchB',
                status: 'PENDING',
                type: 'MACHINE',
                items: [{ id: 'tItem1', warehouseItemId: 'item1', quantity: 1, status: 'IN_TRANSIT', serialNumber: 'SN123' }],
            };



            db.warehouseMachine.findFirst.mockResolvedValue({ id: 'machine1', branchId: 'branchA', status: 'IN_TRANSIT' });
            db.transferOrder.findFirst
                .mockResolvedValueOnce(mockTransferOrder)
                .mockResolvedValueOnce(mockTransferOrder)
                .mockResolvedValueOnce({ ...mockTransferOrder, status: 'REJECTED' });
            // In rejectOrder, findFirst is called at start (if admin) or with where clause. Service uses findFirst.

            db.transferOrder.update.mockResolvedValue({ ...mockTransferOrder, status: 'REJECTED' });
            db.warehouseItem.updateMany.mockResolvedValue({ count: 1 });
            db.notification.create.mockResolvedValue({});

            const result = await rejectOrder(transferOrderId, {}, mockUser);

            expect(db.$transaction).toHaveBeenCalledTimes(2);
            expect(db.transferOrder.findFirst).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({ id: transferOrderId }),
                })
            );
            expect(db.transferOrder.updateMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({ id: transferOrderId }),
                    data: expect.objectContaining({ status: 'REJECTED' })
                })
            );
            // Accept any call to update or updateMany for warehouseItem or warehouseMachine
            const rejectUpdateCalls = (db.warehouseItem.updateMany.mock.calls.length || 0)
                + (db.warehouseItem.update?.mock?.calls.length || 0)
                + (db.warehouseMachine.updateMany?.mock?.calls.length || 0)
                + (db.warehouseMachine.update?.mock?.calls.length || 0);
            expect(rejectUpdateCalls).toBeGreaterThan(0);
            expect(result.status).toBe('REJECTED');
        });

        it('should throw if order not found for rejection', async () => {
            const mockUser = { id: 'user2', branchId: 'branchB', role: 'MANAGEMENT' };
            const transferOrderId = 'transfer1';

            db.transferOrder.findFirst.mockResolvedValue(null);

            await expect(rejectOrder(transferOrderId, {}, mockUser)).rejects.toThrow('الإذن غير موجود');
            expect(db.$transaction).toHaveBeenCalledTimes(0);
        });

        it('should rollback if an error occurs during rejection', async () => {
            db.maintenanceRequest.updateMany = jest.fn().mockResolvedValue({ count: 1 });
            db.warehouseMachine.updateMany = jest.fn().mockResolvedValue({ count: 1 });
            db.warehouseMachine.findUnique.mockResolvedValue({ id: 'machine1', branchId: 'branchA', status: 'IN_TRANSIT' });
            db.warehouseMachine.update = jest.fn().mockResolvedValue({});
            const mockUser = { id: 'user2', branchId: 'branchB', role: 'MANAGEMENT' };
            const transferOrderId = 'transfer1';
            const mockTransferOrder = {
                id: transferOrderId,
                fromBranchId: 'branchA',
                branchId: 'branchA',
                toBranchId: 'branchB',
                status: 'PENDING',
                type: 'MACHINE',
                items: [{ id: 'tItem1', warehouseItemId: 'item1', quantity: 1, status: 'IN_TRANSIT', serialNumber: 'SN123' }],
            };
            const error = new Error('Rejection DB error');

            db.transferOrder.findFirst.mockResolvedValue(mockTransferOrder);
            db.transferOrder.findFirst.mockResolvedValue(mockTransferOrder);
            db.transferOrder.findFirst.mockResolvedValue(mockTransferOrder);
            db.transferOrder.updateMany.mockRejectedValue(error);

            await expect(rejectOrder(transferOrderId, {}, mockUser)).rejects.toThrow('Rejection DB error');
            // Service calls $transaction twice for rejectOrder
            db.warehouseMachine.update = jest.fn().mockResolvedValue({});
            expect(db.$transaction).toHaveBeenCalledTimes(2);
            // Service may call findUnique in both transaction contexts
            expect(db.transferOrder.findFirst).toHaveBeenCalledTimes(2);
            expect(db.transferOrder.updateMany).toHaveBeenCalledTimes(1);
            expect(db.warehouseItem.updateMany).not.toHaveBeenCalled();
            expect(db.notification.create).not.toHaveBeenCalled();
        });
    });

    describe('cancelOrder', () => {
        it('should cancel a transfer order within a transaction', async () => {
            db.maintenanceRequest.updateMany = jest.fn().mockResolvedValue({ count: 1 });
            db.warehouseMachine.updateMany = jest.fn().mockResolvedValue({ count: 1 });
            const mockUser = { id: 'user1', branchId: 'branchA', role: 'ADMIN_AFFAIRS' };
            const transferOrderId = 'transfer1';
            const mockTransferOrder = {
                id: transferOrderId,
                fromBranchId: 'branchA',
                branchId: 'branchA',
                toBranchId: 'branchB',
                status: 'PENDING',
                type: 'MACHINE',
                items: [{ id: 'tItem1', warehouseItemId: 'item1', quantity: 1, status: 'IN_TRANSIT', serialNumber: 'SN123' }],
            };



            db.transferOrder.findFirst.mockResolvedValue(mockTransferOrder);
            db.transferOrder.update.mockResolvedValue({ ...mockTransferOrder, status: 'CANCELLED' });
            db.warehouseMachine.updateMany.mockResolvedValue({ count: 1 });
            db.notification.create.mockResolvedValue({});

            // result already declared above, just call the function
            await cancelOrder(transferOrderId, mockUser);

            // Service calls $transaction once for cancelOrder
            expect(db.$transaction).toHaveBeenCalledTimes(1);
            expect(db.transferOrder.findFirst).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({ id: transferOrderId }),
                })
            );
            expect(db.transferOrder.updateMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({ id: transferOrderId }),
                    data: expect.objectContaining({ status: 'CANCELLED', rejectionReason: expect.any(String), receivedBy: expect.any(String) }),
                })
            );
            // Use only the transaction context for all mocks and assertions
            let txUsed;
            db.$transaction.mockImplementationOnce(async (callback) => {
                const tx = {
                    ...mockPrismaClient,
                    warehouseMachine: {
                        ...mockPrismaClient.warehouseMachine,
                        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
                        findUnique: jest.fn(({ where }) => {
                            if (where && where.serialNumber) {
                                return { id: 'machine-' + where.serialNumber, branchId: 'branchA', status: 'IN_TRANSIT' };
                            }
                            return null;
                        }),
                    },
                    transferOrder: {
                        ...mockPrismaClient.transferOrder,
                        update: jest.fn().mockResolvedValue({ ...mockTransferOrder, status: 'CANCELLED' }),
                    },
                    maintenanceRequest: {
                        ...mockPrismaClient.maintenanceRequest,
                        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
                    },
                };
                txUsed = tx;
                return await callback(tx);
            });
            const result = await cancelOrder(transferOrderId, mockUser);
            expect(txUsed.warehouseMachine.updateMany).toHaveBeenCalled();
            // cancelOrder returns a success message, not the updated order
            expect(result.message).toBe('تم إلغاء الإذن بنجاح');
        });

        it('should throw if order not found for cancellation', async () => {
            const mockUser = { id: 'user1', branchId: 'branchA', role: 'ADMIN_AFFAIRS' };
            const transferOrderId = 'transfer1';

            db.transferOrder.findFirst.mockResolvedValue(null);

            await expect(cancelOrder(transferOrderId, mockUser)).rejects.toThrow('الإذن غير موجود');
            expect(db.$transaction).toHaveBeenCalledTimes(0);
        });

        it('should rollback if an error occurs during cancellation', async () => {
            const mockUser = { id: 'user1', branchId: 'branchA', role: 'ADMIN_AFFAIRS' };
            const transferOrderId = 'transfer1';
            const mockTransferOrder = {
                id: transferOrderId,
                fromBranchId: 'branchA',
                toBranchId: 'branchB',
                status: 'PENDING',
                items: [{ id: 'tItem1', warehouseItemId: 'item1', quantity: 1, status: 'PENDING' }],
                warehouseItems: [{ id: 'item1', branchId: 'branchA', status: 'PENDER_TRANSFER' }],
            };
            const error = new Error('Cancellation DB error');

            db.transferOrder.findFirst.mockResolvedValue(mockTransferOrder);
            db.transferOrder.updateMany.mockRejectedValue(error);

            await expect(cancelOrder(transferOrderId, mockUser)).rejects.toThrow('Cancellation DB error');
            // Service calls $transaction once for cancelOrder
            expect(db.$transaction).toHaveBeenCalledTimes(1);
            expect(db.transferOrder.findFirst).toHaveBeenCalledTimes(1);
            expect(db.transferOrder.updateMany).toHaveBeenCalledTimes(1);
            expect(db.warehouseItem.updateMany).not.toHaveBeenCalled();
            expect(db.notification.create).not.toHaveBeenCalled();
        });
    });
});
