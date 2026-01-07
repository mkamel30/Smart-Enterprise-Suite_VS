// Mock db before importing the service
const mockDb = {
  transferOrder: { create: jest.fn(), findUnique: jest.fn() },
  warehouseMachine: { findMany: jest.fn(), updateMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  $transaction: jest.fn(async (fn) => await fn(mockDb)),
  maintenanceRequest: { findMany: jest.fn(), update: jest.fn(), findFirst: jest.fn(), updateMany: jest.fn() },
  notification: { create: jest.fn() }
};

// Ensure env variables used by middleware don't abort tests
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';

jest.doMock('../db', () => mockDb);

const transferService = require('../services/transferService');
const db = require('../db');

describe('transferService', () => {
  afterEach(() => jest.clearAllMocks());

  test('createBulkTransfer creates order', async () => {
    db.warehouseMachine.findMany.mockResolvedValue([{ serialNumber: 's1', model: 'M', manufacturer: 'X' }]);
    db.transferOrder.create.mockResolvedValue({ id: 'o1', orderNumber: 'TO-1' });
    db.warehouseMachine.updateMany.mockResolvedValue(true);

    const order = await transferService.createBulkTransfer({ serialNumbers: ['s1'], toBranchId: 'b2', waybillNumber: 'w1', notes: 'n' }, { id: 'u1', branchId: 'b1', displayName: 'U' });
    expect(order).toHaveProperty('id');
  });
});
