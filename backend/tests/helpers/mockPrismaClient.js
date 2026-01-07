// Shared mock Prisma client for tests
// Usage: const { createMockPrismaClient } = require('./helpers/mockPrismaClient');
// Then call jest.doMock('../db', () => mock) before requiring modules that import db.

function createMockPrismaClient() {
    const mock = {
        $transaction: jest.fn(async (callback) => {
            // default: call callback with the mock itself
            return await callback(mock);
        }),
        transferOrder: {
            create: jest.fn(),
            update: jest.fn(),
            findUnique: jest.fn(),
            findMany: jest.fn(),
            findFirst: jest.fn(),
        },
        transferOrderItem: {
            findMany: jest.fn(),
            updateMany: jest.fn(),
            update: jest.fn(),
        },
        warehouseItem: {
            updateMany: jest.fn(),
            findMany: jest.fn(),
        },
        warehouseMachine: {
            updateMany: jest.fn(),
            findUnique: jest.fn(),
            update: jest.fn(),
            create: jest.fn(),
        },
        warehouseSim: {
            updateMany: jest.fn(),
            update: jest.fn(),
            findUnique: jest.fn(),
            create: jest.fn(),
        },
        maintenanceRequest: {
            findMany: jest.fn(),
            update: jest.fn(),
            updateMany: jest.fn(),
            findFirst: jest.fn(),
        },
        machineMovementLog: {
            create: jest.fn(),
        },
        notification: {
            create: jest.fn(),
        },
        branch: {
            findUnique: jest.fn(async ({ where }) => (where && where.id ? { id: where.id, name: 'Branch ' + where.id } : null))
        },
        machineParameter: {
            findMany: jest.fn(async () => [])
        }
    };

    return mock;
}

module.exports = { createMockPrismaClient };
