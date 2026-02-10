const { createMockPrismaClient } = require('../helpers/mockPrismaClient');

// Mock dependencies
const mockDb = createMockPrismaClient();

mockDb.inventoryItem = {
    findFirst: jest.fn(),
    updateMany: jest.fn(),
    create: jest.fn()
};

mockDb.stockMovement = {
    create: jest.fn()
};

jest.doMock('../../db', () => mockDb);

const inventoryService = require('../../services/inventoryService');
const db = require('../../db');

describe('InventoryService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('deductParts', () => {
        const parts = [
            { partId: 'part-1', name: 'Part 1', quantity: 2, cost: 50 },
            { partId: 'part-2', name: 'Part 2', quantity: 1, cost: 100 }
        ];
        const requestId = 'req-123';
        const user = 'Test User';
        const branchId = 'branch-1';

        test('should deduct parts successfully', async () => {
            db.inventoryItem.findFirst
                .mockResolvedValueOnce({ id: 'item-1', quantity: 10, part: { name: 'Part 1' } })
                .mockResolvedValueOnce({ id: 'item-2', quantity: 5, part: { name: 'Part 2' } });

            db.inventoryItem.updateMany.mockResolvedValue({ count: 1 });
            db.stockMovement.create.mockResolvedValue({ id: 'move-1' });

            const result = await inventoryService.deductParts(parts, requestId, user, branchId);

            expect(result).toHaveLength(2);
            expect(db.inventoryItem.updateMany).toHaveBeenCalledTimes(2);
            expect(db.stockMovement.create).toHaveBeenCalledTimes(2);
        });

        test('should throw error if part not found in branch', async () => {
            db.inventoryItem.findFirst.mockResolvedValue(null);

            await expect(inventoryService.deductParts(parts, requestId, user, branchId))
                .rejects.toThrow('القطعة "Part 1" غير موجودة في المخزن');
        });

        test('should throw error if insufficient stock', async () => {
            db.inventoryItem.findFirst.mockResolvedValue({ id: 'item-1', quantity: 1, part: { name: 'Part 1' } });

            await expect(inventoryService.deductParts(parts, requestId, user, branchId))
                .rejects.toThrow('الكمية المتاحة من "Part 1" غير كافية');
        });

        test('should require branchId', async () => {
            await expect(inventoryService.deductParts(parts, requestId, user, null))
                .rejects.toThrow('Branch ID is required for deducting parts');
        });
    });
});
