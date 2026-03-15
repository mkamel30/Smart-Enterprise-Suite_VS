const { createMockPrismaClient } = require('../helpers/mockPrismaClient');

// Mock dependencies
const mockDb = createMockPrismaClient();

// Add missing mocks for maintenance service
mockDb.serviceAssignment = {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn()
};
mockDb.serviceAssignmentLog = {
    create: jest.fn()
};
mockDb.maintenanceApprovalRequest = {
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn()
};
mockDb.warehouseMachine = {
    findFirst: jest.fn(),
    updateMany: jest.fn(),
    findMany: jest.fn()
};
mockDb.inventoryItem = {
    findFirst: jest.fn(),
    updateMany: jest.fn()
};
mockDb.stockMovement = {
    create: jest.fn()
};
mockDb.branchDebt = {
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn()
};
mockDb.transferOrder = {
    findMany: jest.fn()
};

// Mock transaction
mockDb.$transaction = jest.fn((callback) => callback(mockDb));

jest.doMock('../../db', () => mockDb);
jest.doMock('../../utils/logger', () => ({
    http: jest.fn(),
    db: jest.fn(),
    info: jest.fn(),
    error: jest.fn()
}));

const maintenanceService = require('../../services/maintenanceService');
const db = require('../../db');

describe('MaintenanceService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('createAssignment', () => {
        const data = {
            machineId: 'machine-1',
            technicianId: 'tech-1',
            technicianName: 'John Doe',
            centerBranchId: 'center-1',
            originBranchId: 'branch-1',
            serialNumber: 'SN123',
            customerId: 'cust-1',
            customerName: 'Customer A'
        };
        const user = { id: 'user-1', displayName: 'Admin' };

        test('should create assignment successfully', async () => {
            // Mock machine check
            db.warehouseMachine.findFirst.mockResolvedValueOnce({ id: 'machine-1', branchId: 'center-1' });
            // Mock existing assignment check
            db.serviceAssignment.findFirst.mockResolvedValueOnce(null);

            // Mock creation with implementation to ensure return value
            db.serviceAssignment.create.mockImplementation((args) => Promise.resolve({ id: 'assign-1', ...args.data }));

            // Mock implicit calls
            db.serviceAssignmentLog.create.mockResolvedValue({});
            db.warehouseMachine.updateMany.mockResolvedValue({ count: 1 });

            const result = await maintenanceService.createAssignment(data, user);

            expect(result).toHaveProperty('id', 'assign-1');
            expect(db.serviceAssignment.create).toHaveBeenCalled();
            expect(db.warehouseMachine.updateMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({ id: 'machine-1' }),
                    data: expect.objectContaining({ status: 'UNDER_MAINTENANCE' })
                })
            );
        });

        test('should throw error if machine not found', async () => {
            db.warehouseMachine.findFirst.mockResolvedValueOnce(null);

            await expect(maintenanceService.createAssignment(data, user))
                .rejects.toThrow('Machine not found');
        });

        test('should throw error if machine already assigned', async () => {
            db.warehouseMachine.findFirst.mockResolvedValueOnce({ id: 'machine-1' });
            db.serviceAssignment.findFirst.mockResolvedValueOnce({ id: 'existing-1' });

            await expect(maintenanceService.createAssignment(data, user))
                .rejects.toThrow('Machine already has an active assignment');
        });
    });

    describe('completeDirect', () => {
        const data = {
            assignmentId: 'assign-1',
            usedParts: [
                { partId: 'part-1', name: 'Part A', quantity: 1, total: 100, isPaid: true }
            ],
            actionTaken: 'Replaced part',
            resolution: 'Fixed',
        };
        const user = { id: 'user-1', branchId: 'center-1', role: 'TECHNICIAN' };

        test('should complete direct maintenance successfully', async () => {
            // Mock validateAssignmentAccess
            db.serviceAssignment.findFirst.mockResolvedValueOnce({
                id: 'assign-1',
                status: 'UNDER_MAINTENANCE',
                centerBranchId: 'center-1',
                originBranchId: 'branch-1',
                serialNumber: 'SN123',
                customerId: 'cust-1'
            });

            // Mock updates
            db.serviceAssignment.updateMany.mockResolvedValue({ count: 1 });
            db.inventoryItem.updateMany.mockResolvedValue({ count: 1 });
            db.branchDebt.create.mockResolvedValue({ id: 'debt-1' });
            db.stockMovement.create.mockResolvedValue({ id: 'move-1' });

            // Mock inventory check
            // We use mockImplementation to handle multiple calls if needed, or ensuring it returns for "findFirst"
            db.inventoryItem.findFirst.mockResolvedValue({
                id: 'item-1',
                quantity: 10,
                part: { name: 'Part A' }
            });

            // The issue before might be that `inventoryItem.findFirst` returning default (undefined) caused checkPartsAvailability or deductInventory to crash?
            // AND ensure final assignment fetch returns something

            // Re-queue mocks for findFirst
            // But since validateAssignmentAccess consumed one, we need to be careful.
            // If I use mockResolvedValue, it applies to ALL subsequent calls provided no "Once" are remaining.

            // Strategy: Use mockImplementation to differentiate based on args, or just return valid assignment if validation passed.
            // Since validation passed above (using Once), subsequent calls will use the default implementation or the non-Once value.

            db.serviceAssignment.findFirst.mockResolvedValue({ id: 'assign-1', status: 'COMPLETED' });

            const result = await maintenanceService.completeDirect(data, user);

            expect(result.assignment).toBeDefined();
            expect(db.inventoryItem.updateMany).toHaveBeenCalled();
            expect(db.branchDebt.create).toHaveBeenCalled();
            expect(db.serviceAssignment.updateMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ status: 'COMPLETED' })
                })
            );
        });

        test('should throw error if insufficient stock', async () => {
            // Validate access mock
            db.serviceAssignment.findFirst.mockResolvedValueOnce({
                id: 'assign-1',
                status: 'UNDER_MAINTENANCE',
                centerBranchId: 'center-1',
                originBranchId: 'branch-1'
            });

            // Insufficient stock mock
            db.inventoryItem.findFirst.mockResolvedValue({
                id: 'item-1',
                quantity: 0,
                part: { name: 'Part A' }
            });

            await expect(maintenanceService.completeDirect(data, user))
                .rejects.toThrow(/Insufficient stock/);
        });
    });
});
