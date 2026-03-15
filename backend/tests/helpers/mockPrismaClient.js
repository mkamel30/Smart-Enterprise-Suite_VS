// Shared mock Prisma client for tests
// Usage: const { createMockPrismaClient } = require('./helpers/mockPrismaClient');

function createMockPrismaClient() {
    const createModelMock = (overrides = {}) => ({
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(async () => ({ count: 1 })),
        delete: jest.fn(),
        deleteMany: jest.fn(async () => ({ count: 1 })),
        findUnique: jest.fn(),
        findMany: jest.fn(async () => []),
        findFirst: jest.fn(),
        count: jest.fn(async () => 0),
        aggregate: jest.fn(async () => ({ _sum: {}, _count: {}, _avg: {}, _min: {}, _max: {} })),
        groupBy: jest.fn(async () => []),
        upsert: jest.fn(),
        ...overrides
    });

    const mock = {
        $transaction: jest.fn(async (callback) => {
            return await callback(mock);
        }),
        $connect: jest.fn(),
        $disconnect: jest.fn(),
        $queryRaw: jest.fn(async () => []),
        $executeRaw: jest.fn(async () => 0),

        user: createModelMock(),
        refreshToken: createModelMock(),
        transferOrder: createModelMock(),
        transferOrderItem: createModelMock(),
        warehouseItem: createModelMock(),
        warehouseMachine: createModelMock(),
        warehouseSim: createModelMock(),
        maintenanceRequest: createModelMock(),
        machineMovementLog: createModelMock(),
        usedPartLog: createModelMock(),
        notification: createModelMock(),
        branch: createModelMock({
            findUnique: jest.fn(async ({ where }) => (where && where.id ? { id: where.id, name: 'Branch ' + where.id } : null))
        }),
        payment: createModelMock(),
        branchDebt: createModelMock(),
        inventoryItem: createModelMock(),
        maintenanceApprovalRequest: createModelMock(),
        posMachine: createModelMock(),
        adminStoreAsset: createModelMock(),
        customer: createModelMock(),
        machineParameter: createModelMock({
            findMany: jest.fn(async () => [])
        }),
        systemLog: createModelMock(),
        stockMovement: createModelMock(),
        dashboardMetric: createModelMock()
    };

    return mock;
}

/**
 * Creates a robust mock for exceljs Workbook
 */
function createMockExcelJS() {
    const mockWorksheet = {
        eachRow: jest.fn(),
        getCell: jest.fn(() => ({ text: '', value: '' })),
        addRow: jest.fn(),
        columns: []
    };

    const mockWorkbook = {
        xlsx: {
            load: jest.fn(async () => { }),
            writeBuffer: jest.fn(async () => Buffer.from([])),
            readFile: jest.fn(async () => { })
        },
        getWorksheet: jest.fn(() => mockWorksheet),
        addWorksheet: jest.fn(() => mockWorksheet)
    };

    return {
        Workbook: jest.fn(() => mockWorkbook)
    };
}

module.exports = { createMockPrismaClient, createMockExcelJS };
