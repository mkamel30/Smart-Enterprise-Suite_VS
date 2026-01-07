// Mock notifications and movementService
jest.mock('../routes/notifications', () => ({ createNotification: jest.fn(async () => ({ /*noop*/ })) }));
jest.mock('../services/movementService', () => ({ logSimMovement: jest.fn(async () => ({})), logMachineMovement: jest.fn(async () => ({})) }));

// Use shared mock helper
const { createMockPrismaClient } = require('./helpers/mockPrismaClient');
const mockDb = createMockPrismaClient();

// Provide defaults used by these smoke tests
mockDb.transferOrder.create.mockImplementation(async ({ data }) => ({ id: 't1', ...data, status: 'PENDING' }));
mockDb.warehouseMachine.updateMany.mockResolvedValue({ count: 0 });
mockDb.warehouseSim.updateMany.mockResolvedValue({ count: 0 });
mockDb.maintenanceRequest.findMany.mockResolvedValue([]);
mockDb.transferOrderItem.findMany.mockResolvedValue([]);

jest.doMock('../db', () => mockDb);

const { createTransferOrder, receiveTransferOrder, rejectOrder, cancelOrder } = require('../services/transferService');

describe('transferService smoke flows', () => {
    it('creates a SIM transfer order', async () => {
        const user = { id: 'u1', branchId: 'branchA', role: 'USER', displayName: 'U1' };
        const payload = { toBranchId: 'branchB', type: 'SIM', items: [{ serialNumber: 'S1' }], notes: 'note' };
        const order = await createTransferOrder(payload, user);
        expect(order).toBeDefined();
        expect(order.status).toBe('PENDING');
        expect(order.toBranchId).toBe('branchB');
    });

    it('imports from excel requires buffer', async () => {
        const user = { id: 'u1', branchId: 'branchA', role: 'USER' };
        await expect(require('../services/transferService').importTransferFromExcel(null, { branchId: 'b', type: 'SIM' }, user)).rejects.toThrow('File required');
    });
});
