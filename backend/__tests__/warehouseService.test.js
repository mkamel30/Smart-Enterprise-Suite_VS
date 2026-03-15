// Mock db before importing the service
const mockDb = {
  warehouseMachine: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
  posMachine: { findUnique: jest.fn(), findFirst: jest.fn() },
  machineMovementLog: { create: jest.fn() },
  machineParameter: { findMany: jest.fn().mockResolvedValue([]) }
};

jest.doMock('../db', () => mockDb);

// Ensure permissions don't block
jest.doMock('../middleware/permissions', () => ({
  canAccessBranch: jest.fn().mockResolvedValue(true)
}));

// Provide basic movementService mock
jest.doMock('../services/movementService', () => ({
  logMachineMovement: jest.fn().mockResolvedValue(true)
}));

const warehouseService = require('../services/warehouseService');
const db = require('../db');

describe('warehouseService', () => {
  afterEach(() => jest.clearAllMocks());

  test('createMachine creates machine when not exists', async () => {
    db.posMachine.findFirst.mockResolvedValue(null);
    db.warehouseMachine.findFirst.mockResolvedValue(null);
    db.machineParameter.findMany.mockResolvedValue([]);
    db.warehouseMachine.create.mockResolvedValue({ id: 'm1', serialNumber: 's1' });

    const machine = await warehouseService.createMachine({ serialNumber: 's1', status: 'NEW' }, { branchId: 'b1', displayName: 'U' });
    expect(machine).toHaveProperty('id', 'm1');
  });
});
