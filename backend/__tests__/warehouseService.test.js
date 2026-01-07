// Mock db before importing the service
const mockDb = {
  warehouseMachine: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  posMachine: { findUnique: jest.fn() },
  machineMovementLog: { create: jest.fn() }
};

jest.doMock('../db', () => mockDb);

const warehouseService = require('../services/warehouseService');
const db = require('../db');

describe('warehouseService', () => {
  afterEach(() => jest.clearAllMocks());

  test('createMachine creates machine when not exists', async () => {
    db.posMachine.findUnique.mockResolvedValue(null);
    db.warehouseMachine.findUnique.mockResolvedValue(null);
    db.warehouseMachine.create.mockResolvedValue({ id: 'm1', serialNumber: 's1' });

    const machine = await warehouseService.createMachine({ serialNumber: 's1', status: 'NEW' }, { branchId: 'b1', displayName: 'U' });
    expect(machine).toHaveProperty('id', 'm1');
  });
});