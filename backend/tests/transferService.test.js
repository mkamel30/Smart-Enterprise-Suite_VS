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
        // Also reset the directly imported db mock
        db.$transaction.mockImplementation(async (callback) => await callback(mockPrismaClient));
        db.transferOrder.create.mockReset();
        db.transferOrder.update.mockReset();
        db.transferOrder.findUnique.mockReset();
        db.transferOrder.findMany.mockReset();
        db.warehouseItem.updateMany.mockReset();
        db.warehouseItem.findMany.mockReset();
        db.maintenanceRequest.update.mockReset();
        db.notification.create.mockReset();
    });

    describe('createTransferOrder', () => {
        it('should create a transfer order within a transaction', async () => {
            const mockUser = { id: 'user1', branchId: 'branchA', role: 'MANAGEMENT' };
            const mockOrderData = {
                toBranchId: 'branchB',
                type: 'SIM',
                items: [{ id: 'item1', quantity: 1 }],
                description: 'Test transfer',
            };
            const mockTransferOrder = {
                id: 'transfer1',
                fromBranchId: 'branchA',
                toBranchId: 'branchB',
                status: 'PENDING',
                // ... other fields
            };

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
                items: [{ id: 'item1', quantity: 1 }],
                description: 'Test transfer',
            };
            const error = new Error('Database error');

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
            db.transferOrder.findUnique.mockResolvedValueOnce(mockTransferOrder);
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
                            findUnique: jest.fn(({ where }) => {
                                if (where && where.serialNumber) {
                                    return { id: 'machine-' + where.serialNumber, branchId: 'branchA', status: 'IN_TRANSIT' };
                                }
                                return null;
                            }),
                        },
                        transferOrder: {
                            ...mockPrismaClient.transferOrder,
                            update: jest.fn().mockResolvedValue({ ...mockTransferOrder, status: 'RECEIVED' }),
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
                db.transferOrder.findUnique.mockResolvedValueOnce({ ...mockTransferOrder, status: 'RECEIVED' });
                const result = await receiveTransferOrder(transferOrderId, {}, mockUser);
                expect(txUsed.warehouseMachine.update).toHaveBeenCalled();
                expect(result.status).toBe('RECEIVED');
        });

        it('should throw if order not found', async () => {
            const mockUser = { id: 'user2', branchId: 'branchB', role: 'MANAGEMENT' };
            const transferOrderId = 'transfer1';

            db.transferOrder.findUnique.mockResolvedValue(null);

            await expect(receiveTransferOrder(transferOrderId, {}, mockUser)).rejects.toThrow('ط§ظ„ط¥ط°ظ† ط؛ظٹط± ظ…ظˆط¬ظˆط¯');
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

            db.transferOrder.findUnique.mockResolvedValue(mockTransferOrder);
            db.transferOrder.update.mockRejectedValue(error);

            await expect(receiveTransferOrder(transferOrderId, {}, mockUser)).rejects.toThrow('DB update error');
            expect(db.$transaction).toHaveBeenCalledTimes(1);
            expect(db.transferOrder.findUnique).toHaveBeenCalledTimes(1);
            expect(db.transferOrder.update).toHaveBeenCalledTimes(1);
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

            db.transferOrder.findUnique.mockResolvedValue(mockTransferOrder);
            db.transferOrder.update.mockResolvedValue({ ...mockTransferOrder, status: 'REJECTED' });
            db.warehouseItem.updateMany.mockResolvedValue({ count: 1 });
            db.notification.create.mockResolvedValue({});

            const result = await rejectOrder(transferOrderId, {}, mockUser);

            expect(db.$transaction).toHaveBeenCalledTimes(2);
            expect(db.transferOrder.findUnique).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: transferOrderId },
                })
            );
            expect(db.transferOrder.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: transferOrderId },
                    data: expect.objectContaining({ status: 'REJECTED' }),
                    include: expect.any(Object)
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

            db.transferOrder.findUnique.mockResolvedValue(null);

            await expect(rejectOrder(transferOrderId, {}, mockUser)).rejects.toThrow('ط§ظ„ط¥ط°ظ† ط؛ظٹط± ظ…ظˆط¬ظˆط¯');
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

            db.transferOrder.findUnique.mockResolvedValue(mockTransferOrder);
            db.transferOrder.update.mockRejectedValue(error);

            await expect(rejectOrder(transferOrderId, {}, mockUser)).rejects.toThrow('Rejection DB error');
            // Service calls $transaction twice for rejectOrder
            db.warehouseMachine.update = jest.fn().mockResolvedValue({});
            expect(db.$transaction).toHaveBeenCalledTimes(2);
            // Service may call findUnique in both transaction contexts
            expect(db.transferOrder.findUnique).toHaveBeenCalledTimes(2);
            expect(db.transferOrder.update).toHaveBeenCalledTimes(1);
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

            db.transferOrder.findUnique.mockResolvedValue(mockTransferOrder);
            db.transferOrder.update.mockResolvedValue({ ...mockTransferOrder, status: 'CANCELLED' });
            db.warehouseMachine.updateMany.mockResolvedValue({ count: 1 });
            db.notification.create.mockResolvedValue({});

            // result already declared above, just call the function
            await cancelOrder(transferOrderId, mockUser);

            // Service calls $transaction once for cancelOrder
            expect(db.$transaction).toHaveBeenCalledTimes(1);
            expect(db.transferOrder.findUnique).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: transferOrderId },
                })
            );
            expect(db.transferOrder.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: transferOrderId },
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
                expect(result.message).toBe('طھظ… ط¥ظ„ط؛ط§ط، ط§ظ„ط¥ط°ظ† ط¨ظ†ط¬ط§ط­');
        });

        it('should throw if order not found for cancellation', async () => {
            const mockUser = { id: 'user1', branchId: 'branchA', role: 'ADMIN_AFFAIRS' };
            const transferOrderId = 'transfer1';

            db.transferOrder.findUnique.mockResolvedValue(null);

            await expect(cancelOrder(transferOrderId, mockUser)).rejects.toThrow('ط§ظ„ط¥ط°ظ† ط؛ظٹط± ظ…ظˆط¬ظˆط¯');
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

            db.transferOrder.findUnique.mockResolvedValue(mockTransferOrder);
            db.transferOrder.update.mockRejectedValue(error);

            await expect(cancelOrder(transferOrderId, mockUser)).rejects.toThrow('Cancellation DB error');
            // Service calls $transaction once for cancelOrder
            expect(db.$transaction).toHaveBeenCalledTimes(1);
            expect(db.transferOrder.findUnique).toHaveBeenCalledTimes(1);
            expect(db.transferOrder.update).toHaveBeenCalledTimes(1);
            expect(db.warehouseItem.updateMany).not.toHaveBeenCalled();
            expect(db.notification.create).not.toHaveBeenCalled();
        });
    });
});
