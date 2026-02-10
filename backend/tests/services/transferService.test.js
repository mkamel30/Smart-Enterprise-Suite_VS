/**
 * Comprehensive Test Suite for Transfer Service
 * Tests: Create transfer order, Validate transfer rules, Receive transfer, Reject transfer
 * Features: Mock Prisma, Test Factories, Validation testing, Error Case Testing
 */

const { createMockPrismaClient } = require('../helpers/mockPrismaClient');

// Mock dependencies
const mockDb = createMockPrismaClient();

// Extend mock with transfer-specific models
mockDb.branch = {
  findUnique: jest.fn(),
  findFirst: jest.fn()
};

mockDb.warehouseMachine = {
  findMany: jest.fn(),
  findFirst: jest.fn(),
  findUnique: jest.fn(),
  updateMany: jest.fn(),
  update: jest.fn(),
  create: jest.fn()
};

mockDb.warehouseSim = {
  findMany: jest.fn(),
  findFirst: jest.fn(),
  findUnique: jest.fn(),
  updateMany: jest.fn(),
  update: jest.fn(),
  create: jest.fn()
};

mockDb.machineParameter = {
  findMany: jest.fn()
};

mockDb.machineMovementLog = {
  create: jest.fn()
};

// Mock utils
const mockValidators = {
  validateTransferOrder: jest.fn(),
  validateItemsForTransfer: jest.fn(),
  validateBranches: jest.fn(),
  validateUserPermission: jest.fn()
};

// Mock movement service
const mockMovementService = {
  logMachineMovement: jest.fn(),
  logSimMovement: jest.fn()
};

// Mock notifications
const mockCreateNotification = jest.fn();

// Mock ExcelJS
const mockWorkbook = {
  xlsx: {
    load: jest.fn()
  }
};

// Setup mocks before importing modules
jest.doMock('../../db', () => mockDb);
jest.doMock('../../utils/transfer-validators', () => mockValidators);
jest.doMock('../../services/movementService', () => mockMovementService);
jest.doMock('../../routes/notifications', () => ({
  createNotification: mockCreateNotification
}));
jest.doMock('exceljs', () => ({
  Workbook: jest.fn(() => mockWorkbook)
}));

const transferService = require('../../services/transferService');
const db = require('../../db');

describe('TransferService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ==========================================
  // Test Data Factories
  // ==========================================
  const factories = {
    user: (overrides = {}) => ({
      id: 'user-123',
      displayName: 'Test User',
      name: 'Test User',
      role: 'USER',
      branchId: 'branch-1',
      ...overrides
    }),

    superAdmin: (overrides = {}) => factories.user({
      role: 'SUPER_ADMIN',
      branchId: null,
      ...overrides
    }),

    branch: (overrides = {}) => ({
      id: 'branch-1',
      name: 'Test Branch',
      type: 'BRANCH',
      isActive: true,
      ...overrides
    }),

    maintenanceCenter: (overrides = {}) => factories.branch({
      id: 'center-1',
      name: 'Maintenance Center',
      type: 'MAINTENANCE_CENTER',
      ...overrides
    }),

    transferOrder: (overrides = {}) => ({
      id: 'order-123',
      orderNumber: 'TO-20240115-001',
      fromBranchId: 'branch-1',
      toBranchId: 'branch-2',
      branchId: 'branch-2',
      type: 'MACHINE',
      status: 'PENDING',
      createdBy: 'Test User',
      createdByName: 'Test User',
      createdByUserId: 'user-123',
      notes: 'Test transfer',
      items: [],
      fromBranch: { id: 'branch-1', name: 'Source Branch' },
      toBranch: { id: 'branch-2', name: 'Destination Branch' },
      ...overrides
    }),

    transferItem: (overrides = {}) => ({
      id: 'item-123',
      serialNumber: 'SN123456',
      type: 'MACHINE',
      model: 'POS-X200',
      manufacturer: 'Ingenico',
      isReceived: false,
      ...overrides
    }),

    warehouseMachine: (overrides = {}) => ({
      id: 'wh-123',
      serialNumber: 'SN123456',
      model: 'POS-X200',
      manufacturer: 'Ingenico',
      status: 'NEW',
      branchId: 'branch-1',
      ...overrides
    }),

    warehouseSim: (overrides = {}) => ({
      id: 'sim-123',
      serialNumber: 'SIM001',
      type: 'DATA',
      status: 'ACTIVE',
      branchId: 'branch-1',
      ...overrides
    }),

    maintenanceRequest: (overrides = {}) => ({
      id: 'req-123',
      serialNumber: 'SN123456',
      status: 'Open',
      branchId: 'branch-1',
      ...overrides
    })
  };

  // ==========================================
  // Create Transfer Order Tests
  // ==========================================
  describe('createTransferOrder', () => {
    test('should create machine transfer order successfully', async () => {
      const user = factories.user();
      const orderData = {
        fromBranchId: 'branch-1',
        toBranchId: 'branch-2',
        type: 'MACHINE',
        items: [
          { serialNumber: 'SN123456', type: 'POS-X200', manufacturer: 'Ingenico' }
        ],
        notes: 'Test transfer'
      };
      const createdOrder = factories.transferOrder();

      mockValidators.validateTransferOrder.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: []
      });
      db.transferOrder.findFirst.mockResolvedValue(null);
      db.machineParameter.findMany.mockResolvedValue([]);
      db.transferOrder.create.mockResolvedValue(createdOrder);
      db.warehouseMachine.findMany.mockResolvedValue([factories.warehouseMachine()]);
      db.warehouseMachine.updateMany.mockResolvedValue({ count: 1 });
      db.maintenanceRequest.findMany.mockResolvedValue([]);
      mockCreateNotification.mockResolvedValue();

      const result = await transferService.createTransferOrder(orderData, user);

      expect(result).toEqual(createdOrder);
      expect(db.transferOrder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'MACHINE',
            fromBranchId: 'branch-1',
            toBranchId: 'branch-2'
          })
        })
      );
    });

    test('should create SIM transfer order successfully', async () => {
      const user = factories.user();
      const orderData = {
        fromBranchId: 'branch-1',
        toBranchId: 'branch-2',
        type: 'SIM',
        items: [{ serialNumber: 'SIM001', type: 'DATA' }],
        notes: 'SIM transfer'
      };
      const createdOrder = factories.transferOrder({ type: 'SIM' });

      mockValidators.validateTransferOrder.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: []
      });
      db.transferOrder.findFirst.mockResolvedValue(null);
      db.transferOrder.create.mockResolvedValue(createdOrder);
      db.warehouseSim.updateMany.mockResolvedValue({ count: 1 });
      db.maintenanceRequest.findMany.mockResolvedValue([]);
      mockCreateNotification.mockResolvedValue();

      const result = await transferService.createTransferOrder(orderData, user);

      expect(result).toEqual(createdOrder);
    });

    test('should create maintenance transfer order successfully', async () => {
      const user = factories.user();
      const orderData = {
        fromBranchId: 'branch-1',
        toBranchId: 'center-1',
        type: 'MAINTENANCE',
        items: [{ serialNumber: 'SN123456', type: 'MACHINE' }],
        notes: 'Maintenance transfer'
      };
      const createdOrder = factories.transferOrder({
        type: 'MAINTENANCE',
        toBranchId: 'center-1'
      });

      mockValidators.validateTransferOrder.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: []
      });
      db.transferOrder.findFirst.mockResolvedValue(null);
      db.machineParameter.findMany.mockResolvedValue([]);
      db.transferOrder.create.mockResolvedValue(createdOrder);
      db.warehouseMachine.findMany.mockResolvedValue([factories.warehouseMachine()]);
      db.warehouseMachine.updateMany.mockResolvedValue({ count: 1 });
      db.maintenanceRequest.findMany.mockResolvedValue([]);
      mockCreateNotification.mockResolvedValue();

      const result = await transferService.createTransferOrder(orderData, user);

      expect(result).toEqual(createdOrder);
    });

    test('should throw error when validation fails', async () => {
      const user = factories.user();
      const orderData = {
        fromBranchId: 'branch-1',
        toBranchId: 'branch-2',
        type: 'MACHINE',
        items: []
      };

      mockValidators.validateTransferOrder.mockResolvedValue({
        valid: false,
        errors: ['No items to transfer', 'Invalid branch'],
        warnings: []
      });

      await expect(transferService.createTransferOrder(orderData, user))
        .rejects.toThrow(/No items to transfer/);
    });

    test('should generate order number correctly', async () => {
      const user = factories.user();
      const orderData = {
        fromBranchId: 'branch-1',
        toBranchId: 'branch-2',
        type: 'MACHINE',
        items: [{ serialNumber: 'SN123456' }]
      };
      const lastOrder = { orderNumber: 'TO-20240115-005' };

      mockValidators.validateTransferOrder.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: []
      });
      db.transferOrder.findFirst.mockResolvedValue(lastOrder);
      db.machineParameter.findMany.mockResolvedValue([]);
      db.transferOrder.create.mockImplementation(({ data }) =>
        Promise.resolve(factories.transferOrder({ orderNumber: data.orderNumber }))
      );
      db.warehouseMachine.findMany.mockResolvedValue([factories.warehouseMachine()]);
      db.warehouseMachine.updateMany.mockResolvedValue({ count: 1 });
      db.maintenanceRequest.findMany.mockResolvedValue([]);
      mockCreateNotification.mockResolvedValue();

      const result = await transferService.createTransferOrder(orderData, user);

      expect(result.orderNumber).toMatch(/^TO-\d{8}-\d{3}$/);
    });

    test('should set machine status to IN_TRANSIT when creating order', async () => {
      const user = factories.user();
      const orderData = {
        fromBranchId: 'branch-1',
        toBranchId: 'branch-2',
        type: 'MACHINE',
        items: [{ serialNumber: 'SN123456' }]
      };
      const machine = factories.warehouseMachine();

      mockValidators.validateTransferOrder.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: []
      });
      db.transferOrder.findFirst.mockResolvedValue(null);
      db.machineParameter.findMany.mockResolvedValue([]);
      db.transferOrder.create.mockResolvedValue(factories.transferOrder());
      db.warehouseMachine.findMany.mockResolvedValue([machine]);
      db.warehouseMachine.updateMany.mockResolvedValue({ count: 1 });
      db.maintenanceRequest.findMany.mockResolvedValue([]);
      mockCreateNotification.mockResolvedValue();

      await transferService.createTransferOrder(orderData, user);

      expect(db.warehouseMachine.updateMany).toHaveBeenCalledWith({
        where: {
          serialNumber: { in: ['SN123456'] },
          branchId: 'branch-1'
        },
        data: { status: 'IN_TRANSIT' }
      });
    });

    test('should log machine movement when creating order', async () => {
      const user = factories.user();
      const orderData = {
        fromBranchId: 'branch-1',
        toBranchId: 'branch-2',
        type: 'MACHINE',
        items: [{ serialNumber: 'SN123456' }]
      };
      const machine = factories.warehouseMachine();

      mockValidators.validateTransferOrder.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: []
      });
      db.transferOrder.findFirst.mockResolvedValue(null);
      db.machineParameter.findMany.mockResolvedValue([]);
      db.transferOrder.create.mockResolvedValue(factories.transferOrder());
      db.warehouseMachine.findMany.mockResolvedValue([machine]);
      db.warehouseMachine.updateMany.mockResolvedValue({ count: 1 });
      db.maintenanceRequest.findMany.mockResolvedValue([]);
      mockMovementService.logMachineMovement.mockResolvedValue();
      mockCreateNotification.mockResolvedValue();

      await transferService.createTransferOrder(orderData, user);

      expect(mockMovementService.logMachineMovement).toHaveBeenCalled();
    });

    test('should update maintenance request status to PENDING_TRANSFER', async () => {
      const user = factories.user();
      const orderData = {
        fromBranchId: 'branch-1',
        toBranchId: 'center-1',
        type: 'MAINTENANCE',
        items: [{ serialNumber: 'SN123456' }]
      };
      const activeRequest = factories.maintenanceRequest();

      mockValidators.validateTransferOrder.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: []
      });
      db.transferOrder.findFirst.mockResolvedValue(null);
      db.machineParameter.findMany.mockResolvedValue([]);
      db.transferOrder.create.mockResolvedValue(factories.transferOrder({ type: 'MAINTENANCE' }));
      db.warehouseMachine.findMany.mockResolvedValue([factories.warehouseMachine()]);
      db.warehouseMachine.updateMany.mockResolvedValue({ count: 1 });
      db.maintenanceRequest.findMany.mockResolvedValue([activeRequest]);
      db.maintenanceRequest.updateMany.mockResolvedValue({ count: 1 });
      mockCreateNotification.mockResolvedValue();

      await transferService.createTransferOrder(orderData, user);

      expect(db.maintenanceRequest.updateMany).toHaveBeenCalledWith({
        where: { id: activeRequest.id, branchId: 'branch-1' },
        data: { status: 'PENDING_TRANSFER' }
      });
    });

    test('should create notification for destination branch', async () => {
      const user = factories.user();
      const orderData = {
        fromBranchId: 'branch-1',
        toBranchId: 'branch-2',
        type: 'MACHINE',
        items: [{ serialNumber: 'SN123456' }]
      };

      mockValidators.validateTransferOrder.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: []
      });
      db.transferOrder.findFirst.mockResolvedValue(null);
      db.machineParameter.findMany.mockResolvedValue([]);
      db.transferOrder.create.mockResolvedValue(factories.transferOrder());
      db.warehouseMachine.findMany.mockResolvedValue([factories.warehouseMachine()]);
      db.warehouseMachine.updateMany.mockResolvedValue({ count: 1 });
      db.maintenanceRequest.findMany.mockResolvedValue([]);
      mockCreateNotification.mockResolvedValue();

      await transferService.createTransferOrder(orderData, user);

      expect(mockCreateNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          branchId: 'branch-2',
          type: 'TRANSFER_ORDER'
        })
      );
    });
  });

  // ==========================================
  // Create Bulk Transfer Tests
  // ==========================================
  describe('createBulkTransfer', () => {
    test('should create bulk maintenance transfer successfully', async () => {
      const user = factories.user();
      const bulkData = {
        serialNumbers: ['SN123456', 'SN789012'],
        toBranchId: 'center-1',
        waybillNumber: 'WB-001',
        notes: 'Bulk maintenance'
      };
      const machines = [
        factories.warehouseMachine({ serialNumber: 'SN123456' }),
        factories.warehouseMachine({ serialNumber: 'SN789012' })
      ];
      const activeRequests = [
        factories.maintenanceRequest({ serialNumber: 'SN123456' }),
        factories.maintenanceRequest({ serialNumber: 'SN789012' })
      ];

      mockValidators.validateBranches.mockResolvedValue({
        valid: true,
        errors: [],
        fromBranch: factories.branch(),
        toBranch: factories.maintenanceCenter()
      });
      mockValidators.validateItemsForTransfer.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: []
      });
      db.warehouseMachine.findMany.mockResolvedValue(machines);
      db.transferOrder.create.mockResolvedValue(factories.transferOrder({ type: 'MAINTENANCE' }));
      db.maintenanceRequest.findMany.mockResolvedValue(activeRequests);
      db.maintenanceRequest.updateMany.mockResolvedValue({ count: 2 });
      db.warehouseMachine.updateMany.mockResolvedValue({ count: 2 });
      db.machineMovementLog.create.mockResolvedValue({});
      mockCreateNotification.mockResolvedValue();

      const result = await transferService.createBulkTransfer(bulkData, user);

      expect(result).toBeDefined();
      expect(db.transferOrder.create).toHaveBeenCalled();
    });

    test('should throw error when no serial numbers provided', async () => {
      const user = factories.user();
      const bulkData = {
        serialNumbers: [],
        toBranchId: 'center-1',
        waybillNumber: 'WB-001'
      };

      await expect(transferService.createBulkTransfer(bulkData, user))
        .rejects.toThrow('Serial numbers and destination branch are required');
    });

    test('should throw error when destination branch missing', async () => {
      const user = factories.user();
      const bulkData = {
        serialNumbers: ['SN123456'],
        toBranchId: null,
        waybillNumber: 'WB-001'
      };

      await expect(transferService.createBulkTransfer(bulkData, user))
        .rejects.toThrow('Serial numbers and destination branch are required');
    });

    test('should update machine status and notes for bulk transfer', async () => {
      const user = factories.user();
      const bulkData = {
        serialNumbers: ['SN123456'],
        toBranchId: 'center-1',
        waybillNumber: 'WB-001',
        notes: 'Bulk maintenance'
      };
      const machines = [factories.warehouseMachine({ serialNumber: 'SN123456' })];

      mockValidators.validateBranches.mockResolvedValue({
        valid: true,
        errors: [],
        fromBranch: factories.branch(),
        toBranch: factories.maintenanceCenter()
      });
      mockValidators.validateItemsForTransfer.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: []
      });
      db.warehouseMachine.findMany.mockResolvedValue(machines);
      db.transferOrder.create.mockResolvedValue(factories.transferOrder({ type: 'MAINTENANCE', orderNumber: 'TO-MT-123' }));
      db.maintenanceRequest.findMany.mockResolvedValue([]);
      db.warehouseMachine.updateMany.mockResolvedValue({ count: 1 });
      db.machineMovementLog.create.mockResolvedValue({});
      mockCreateNotification.mockResolvedValue();

      await transferService.createBulkTransfer(bulkData, user);

      expect(db.warehouseMachine.updateMany).toHaveBeenCalledWith({
        where: { serialNumber: 'SN123456', branchId: user.branchId },
        data: expect.objectContaining({
          status: 'IN_TRANSIT',
          notes: expect.stringContaining('WB-001'),
          originBranchId: user.branchId
        })
      });
    });
  });

  // ==========================================
  // Receive Transfer Tests
  // ==========================================
  describe('receiveTransferOrder', () => {
    test('should receive transfer order successfully', async () => {
      const user = factories.user({ branchId: 'branch-2' });
      const order = factories.transferOrder({
        toBranchId: 'branch-2',
        items: [factories.transferItem()]
      });

      db.transferOrder.findFirst.mockResolvedValue(order);
      db.transferOrderItem.update.mockResolvedValue({});
      db.transferOrder.updateMany.mockResolvedValue({ count: 1 });
      db.warehouseMachine.findFirst.mockResolvedValue(null);
      db.warehouseMachine.create.mockResolvedValue({ id: 'wh-456' });
      mockMovementService.logMachineMovement.mockResolvedValue();

      const result = await transferService.receiveTransferOrder(order.id, {
        receivedBy: user.id,
        receivedByName: user.displayName,
        receivedItems: [order.items[0].id]
      }, user);

      expect(result.status).toBe('RECEIVED');
      expect(db.transferOrderItem.update).toHaveBeenCalled();
    });

    test('should partially receive transfer order', async () => {
      const user = factories.user({ branchId: 'branch-2' });
      const order = factories.transferOrder({
        toBranchId: 'branch-2',
        items: [
          factories.transferItem({ id: 'item-1' }),
          factories.transferItem({ id: 'item-2' })
        ]
      });

      db.transferOrder.findFirst.mockResolvedValue(order);
      db.transferOrderItem.update.mockResolvedValue({});
      db.transferOrder.updateMany.mockResolvedValue({ count: 1 });

      const result = await transferService.receiveTransferOrder(order.id, {
        receivedBy: user.id,
        receivedByName: user.displayName,
        receivedItems: ['item-1']
      }, user);

      expect(result.status).toBe('PARTIAL');
    });

    test('should throw error when order not found', async () => {
      const user = factories.user();

      db.transferOrder.findFirst.mockResolvedValue(null);

      await expect(transferService.receiveTransferOrder('invalid-id', {}, user))
        .rejects.toThrow('الإذن غير موجود');
    });

    test('should throw error when order not in PENDING status', async () => {
      const user = factories.user({ branchId: 'branch-2' });
      const order = factories.transferOrder({
        status: 'RECEIVED',
        toBranchId: 'branch-2'
      });

      db.transferOrder.findFirst.mockResolvedValue(order);

      await expect(transferService.receiveTransferOrder(order.id, {}, user))
        .rejects.toThrow('الإذن ليس في حالة انتظار');
    });

    test('should deny access for regular user from different branch', async () => {
      const user = factories.user({ branchId: 'branch-3' });
      const order = factories.transferOrder({
        toBranchId: 'branch-2',
        fromBranchId: 'branch-1'
      });

      db.transferOrder.findFirst.mockResolvedValue(null);

      await expect(transferService.receiveTransferOrder(order.id, {}, user))
        .rejects.toThrow('الإذن غير موجود');
    });

    test('should allow SUPER_ADMIN to receive any order', async () => {
      const superAdmin = factories.superAdmin();
      const order = factories.transferOrder({
        toBranchId: 'branch-2',
        items: [factories.transferItem()]
      });

      db.transferOrder.findFirst.mockResolvedValue(order);
      db.transferOrderItem.update.mockResolvedValue({});
      db.transferOrder.updateMany.mockResolvedValue({ count: 1 });
      db.warehouseMachine.findFirst.mockResolvedValue(null);
      db.warehouseMachine.create.mockResolvedValue({ id: 'wh-456' });
      mockMovementService.logMachineMovement.mockResolvedValue();

      const result = await transferService.receiveTransferOrder(order.id, {
        receivedBy: superAdmin.id,
        receivedByName: superAdmin.displayName
      }, superAdmin);

      expect(result).toBeDefined();
    });

    test('should set machine status to NEW when receiving', async () => {
      const user = factories.user({ branchId: 'branch-2' });
      const order = factories.transferOrder({
        type: 'MACHINE',
        toBranchId: 'branch-2',
        items: [factories.transferItem()]
      });
      const existingMachine = factories.warehouseMachine();

      db.transferOrder.findFirst.mockResolvedValue(order);
      db.transferOrderItem.update.mockResolvedValue({});
      db.transferOrder.updateMany.mockResolvedValue({ count: 1 });
      db.warehouseMachine.findFirst.mockResolvedValue(existingMachine);
      db.warehouseMachine.updateMany.mockResolvedValue({ count: 1 });
      mockMovementService.logMachineMovement.mockResolvedValue();

      await transferService.receiveTransferOrder(order.id, {
        receivedBy: user.id,
        receivedByName: user.displayName
      }, user);

      expect(db.warehouseMachine.updateMany).toHaveBeenCalledWith({
        where: { id: existingMachine.id, branchId: { not: null } },
        data: { branchId: order.branchId, status: 'NEW' }
      });
    });

    test('should set machine status to RECEIVED_AT_CENTER when receiving at maintenance center', async () => {
      const user = factories.user({ branchId: 'center-1' });
      const order = factories.transferOrder({
        type: 'MAINTENANCE',
        toBranchId: 'center-1',
        toBranch: { type: 'MAINTENANCE_CENTER' },
        fromBranchId: 'branch-1',
        items: [factories.transferItem()]
      });
      const existingMachine = factories.warehouseMachine();
      const activeRequest = factories.maintenanceRequest({ status: 'PENDING_TRANSFER' });

      db.transferOrder.findFirst.mockResolvedValue(order);
      db.transferOrderItem.update.mockResolvedValue({});
      db.transferOrder.updateMany.mockResolvedValue({ count: 1 });
      db.warehouseMachine.findFirst.mockResolvedValue(existingMachine);
      db.warehouseMachine.updateMany.mockResolvedValue({ count: 1 });
      db.maintenanceRequest.findFirst.mockResolvedValue(activeRequest);
      db.maintenanceRequest.updateMany.mockResolvedValue({ count: 1 });
      mockMovementService.logMachineMovement.mockResolvedValue();

      await transferService.receiveTransferOrder(order.id, {
        receivedBy: user.id,
        receivedByName: user.displayName
      }, user);

      expect(db.warehouseMachine.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'RECEIVED_AT_CENTER',
            originBranchId: 'branch-1'
          })
        })
      );
    });

    test('should update maintenance request status when receiving at center', async () => {
      const user = factories.user({ branchId: 'center-1' });
      const order = factories.transferOrder({
        type: 'MAINTENANCE',
        toBranchId: 'center-1',
        toBranch: { type: 'MAINTENANCE_CENTER' },
        fromBranchId: 'branch-1',
        items: [factories.transferItem({ serialNumber: 'SN123456' })]
      });
      const activeRequest = factories.maintenanceRequest({
        serialNumber: 'SN123456',
        status: 'PENDING_TRANSFER'
      });

      db.transferOrder.findFirst.mockResolvedValue(order);
      db.transferOrderItem.update.mockResolvedValue({});
      db.transferOrder.updateMany.mockResolvedValue({ count: 1 });
      db.warehouseMachine.findFirst.mockResolvedValue(null);
      db.warehouseMachine.create.mockResolvedValue({ id: 'wh-456' });
      db.maintenanceRequest.findFirst.mockResolvedValue(activeRequest);
      db.maintenanceRequest.updateMany.mockResolvedValue({ count: 1 });
      mockMovementService.logMachineMovement.mockResolvedValue();

      await transferService.receiveTransferOrder(order.id, {
        receivedBy: user.id,
        receivedByName: user.displayName
      }, user);

      expect(db.maintenanceRequest.updateMany).toHaveBeenCalledWith({
        where: { id: activeRequest.id, branchId: 'branch-1' },
        data: { status: 'Open', servicedByBranchId: 'center-1' }
      });
    });

    test('should handle SIM transfers correctly', async () => {
      const user = factories.user({ branchId: 'branch-2' });
      const order = factories.transferOrder({
        type: 'SIM',
        toBranchId: 'branch-2',
        items: [factories.transferItem({ type: 'SIM', serialNumber: 'SIM001' })]
      });

      db.transferOrder.findFirst.mockResolvedValue(order);
      db.transferOrderItem.update.mockResolvedValue({});
      db.transferOrder.updateMany.mockResolvedValue({ count: 1 });
      db.warehouseSim.findFirst.mockResolvedValue(null);
      db.warehouseSim.create.mockResolvedValue({ id: 'sim-456' });
      mockMovementService.logSimMovement.mockResolvedValue();

      const result = await transferService.receiveTransferOrder(order.id, {
        receivedBy: user.id,
        receivedByName: user.displayName
      }, user);

      expect(db.warehouseSim.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          serialNumber: 'SIM001',
          branchId: order.branchId,
          status: 'ACTIVE'
        })
      });
    });
  });

  // ==========================================
  // Reject Transfer Tests
  // ==========================================
  describe('rejectOrder', () => {
    test('should reject pending transfer order', async () => {
      const user = factories.user({ branchId: 'branch-2' });
      const order = factories.transferOrder({
        toBranchId: 'branch-2',
        items: [factories.transferItem()]
      });

      db.transferOrder.findFirst.mockResolvedValue(order);
      db.transferOrder.findFirst.mockResolvedValue({
        ...order,
        items: [factories.transferItem()]
      });
      db.warehouseMachine.findFirst.mockResolvedValue(factories.warehouseMachine({ status: 'IN_TRANSIT' }));
      db.warehouseMachine.updateMany.mockResolvedValue({ count: 1 });
      db.maintenanceRequest.updateMany.mockResolvedValue({ count: 1 });
      db.transferOrder.updateMany.mockResolvedValue({ count: 1 });
      mockCreateNotification.mockResolvedValue();

      const result = await transferService.rejectOrder(order.id, {
        rejectionReason: 'Items damaged',
        receivedBy: user.id,
        receivedByName: user.displayName
      }, user);

      expect(result.status).toBe('REJECTED');
      expect(db.transferOrder.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'REJECTED',
            rejectionReason: 'Items damaged'
          })
        })
      );
    });

    test('should restore machine status when rejecting', async () => {
      const user = factories.user({ branchId: 'branch-2' });
      const order = factories.transferOrder({
        type: 'MACHINE',
        toBranchId: 'branch-2',
        fromBranchId: 'branch-1',
        items: [factories.transferItem()]
      });
      const machine = factories.warehouseMachine({
        status: 'IN_TRANSIT',
        branchId: 'branch-1'
      });

      db.transferOrder.findFirst.mockResolvedValueOnce(order);
      db.transferOrder.findFirst.mockResolvedValueOnce({
        ...order,
        items: [factories.transferItem()]
      });
      db.warehouseMachine.findFirst.mockResolvedValue(machine);
      db.warehouseMachine.updateMany.mockResolvedValue({ count: 1 });
      db.transferOrder.updateMany.mockResolvedValue({ count: 1 });
      mockCreateNotification.mockResolvedValue();

      await transferService.rejectOrder(order.id, {
        rejectionReason: 'Wrong items',
        receivedBy: user.id,
        receivedByName: user.displayName
      }, user);

      expect(db.warehouseMachine.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'NEW'
          })
        })
      );
    });

    test('should restore maintenance machine status to DEFECTIVE when rejecting MAINTENANCE order', async () => {
      const user = factories.user({ branchId: 'branch-2' });
      const order = factories.transferOrder({
        type: 'MAINTENANCE',
        toBranchId: 'branch-2',
        fromBranchId: 'branch-1',
        items: [factories.transferItem()]
      });
      const machine = factories.warehouseMachine({
        status: 'IN_TRANSIT',
        branchId: 'branch-1',
        customerId: null
      });

      db.transferOrder.findFirst.mockResolvedValueOnce(order);
      db.transferOrder.findFirst.mockResolvedValueOnce({
        ...order,
        items: [factories.transferItem()]
      });
      db.warehouseMachine.findFirst.mockResolvedValue(machine);
      db.warehouseMachine.updateMany.mockResolvedValue({ count: 1 });
      db.maintenanceRequest.updateMany.mockResolvedValue({ count: 1 });
      db.transferOrder.updateMany.mockResolvedValue({ count: 1 });
      mockCreateNotification.mockResolvedValue();

      await transferService.rejectOrder(order.id, {
        rejectionReason: 'Cannot accept',
        receivedBy: user.id,
        receivedByName: user.displayName
      }, user);

      expect(db.warehouseMachine.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'DEFECTIVE'
          })
        })
      );
    });

    test('should throw error when order not found', async () => {
      const user = factories.user();

      db.transferOrder.findFirst.mockResolvedValue(null);

      await expect(transferService.rejectOrder('invalid-id', {}, user))
        .rejects.toThrow('الإذن غير موجود');
    });

    test('should throw error when order not in PENDING status', async () => {
      const user = factories.user({ branchId: 'branch-2' });
      const order = factories.transferOrder({
        status: 'RECEIVED',
        toBranchId: 'branch-2'
      });

      db.transferOrder.findFirst.mockResolvedValue(order);

      await expect(transferService.rejectOrder(order.id, {}, user))
        .rejects.toThrow('الإذن ليس في حالة انتظار');
    });

    test('should create notification to source branch when rejecting', async () => {
      const user = factories.user({ branchId: 'branch-2' });
      const order = factories.transferOrder({
        toBranchId: 'branch-2',
        fromBranchId: 'branch-1',
        items: [factories.transferItem()]
      });

      db.transferOrder.findFirst.mockResolvedValueOnce(order);
      db.transferOrder.findFirst.mockResolvedValueOnce({
        ...order,
        items: [factories.transferItem()]
      });
      db.warehouseMachine.findFirst.mockResolvedValue(factories.warehouseMachine());
      db.warehouseMachine.updateMany.mockResolvedValue({ count: 1 });
      db.transferOrder.updateMany.mockResolvedValue({ count: 1 });
      mockCreateNotification.mockResolvedValue();

      await transferService.rejectOrder(order.id, {
        rejectionReason: 'Damaged items',
        receivedBy: user.id,
        receivedByName: user.displayName
      }, user);

      expect(mockCreateNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          branchId: 'branch-1',
          type: 'TRANSFER_REJECTED'
        })
      );
    });
  });

  // ==========================================
  // Cancel Transfer Tests
  // ==========================================
  describe('cancelOrder', () => {
    test('should allow creator to cancel pending order', async () => {
      const user = factories.user({ id: 'creator-123' });
      const order = factories.transferOrder({
        createdByUserId: 'creator-123',
        fromBranchId: 'branch-1',
        items: [factories.transferItem()]
      });

      db.transferOrder.findFirst.mockResolvedValue(order);
      db.warehouseMachine.updateMany.mockResolvedValue({ count: 1 });
      db.transferOrder.updateMany.mockResolvedValue({ count: 1 });

      const result = await transferService.cancelOrder(order.id, user);

      expect(result.message).toContain('تم إلغاء الإذن');
    });

    test('should allow admin to cancel any pending order', async () => {
      const admin = factories.user({ id: 'admin-123', role: 'ADMIN' });
      const order = factories.transferOrder({
        createdByUserId: 'other-user',
        fromBranchId: 'branch-1',
        items: [factories.transferItem()]
      });

      db.transferOrder.findFirst.mockResolvedValue(order);
      db.warehouseMachine.updateMany.mockResolvedValue({ count: 1 });
      db.transferOrder.updateMany.mockResolvedValue({ count: 1 });

      const result = await transferService.cancelOrder(order.id, admin);

      expect(result.message).toContain('تم إلغاء الإذن');
    });

    test('should deny non-creator non-admin users', async () => {
      const user = factories.user({ id: 'user-123', role: 'USER' });
      const order = factories.transferOrder({
        createdByUserId: 'other-user',
        fromBranchId: 'branch-1'
      });

      db.transferOrder.findFirst.mockResolvedValue(order);

      await expect(transferService.cancelOrder(order.id, user))
        .rejects.toThrow('غير مصرح لك بإلغاء هذا الإذن');
    });

    test('should throw error when order not in PENDING status', async () => {
      const user = factories.user({ id: 'creator-123' });
      const order = factories.transferOrder({
        createdByUserId: 'creator-123',
        status: 'RECEIVED'
      });

      db.transferOrder.findFirst.mockResolvedValue(order);

      await expect(transferService.cancelOrder(order.id, user))
        .rejects.toThrow('لا يمكن إلغاء إذن غير معلق');
    });

    test('should restore machine status when cancelling', async () => {
      const user = factories.user({ id: 'creator-123' });
      const order = factories.transferOrder({
        type: 'MACHINE',
        createdByUserId: 'creator-123',
        fromBranchId: 'branch-1',
        items: [factories.transferItem()]
      });

      db.transferOrder.findFirst.mockResolvedValue(order);
      db.warehouseMachine.updateMany.mockResolvedValue({ count: 1 });
      db.transferOrder.updateMany.mockResolvedValue({ count: 1 });

      await transferService.cancelOrder(order.id, user);

      expect(db.warehouseMachine.updateMany).toHaveBeenCalledWith({
        where: {
          serialNumber: { in: [order.items[0].serialNumber] },
          branchId: 'branch-1',
          status: 'IN_TRANSIT'
        },
        data: { status: 'NEW' }
      });
    });

    test('should restore maintenance request status when cancelling MAINTENANCE order', async () => {
      const user = factories.user({ id: 'creator-123' });
      const order = factories.transferOrder({
        type: 'MAINTENANCE',
        createdByUserId: 'creator-123',
        fromBranchId: 'branch-1',
        items: [factories.transferItem({ serialNumber: 'SN123456' })]
      });

      db.transferOrder.findFirst.mockResolvedValue(order);
      db.warehouseMachine.updateMany.mockResolvedValue({ count: 1 });
      db.maintenanceRequest.updateMany.mockResolvedValue({ count: 1 });
      db.transferOrder.updateMany.mockResolvedValue({ count: 1 });

      await transferService.cancelOrder(order.id, user);

      expect(db.maintenanceRequest.updateMany).toHaveBeenCalledWith({
        where: {
          serialNumber: { in: ['SN123456'] },
          status: 'PENDING_TRANSFER',
          branchId: 'branch-1'
        },
        data: { status: 'Open' }
      });
    });
  });

  // ==========================================
  // List and Get Tests
  // ==========================================
  describe('listTransferOrders', () => {
    test('should list orders with filters', async () => {
      const user = factories.user();
      const orders = [factories.transferOrder(), factories.transferOrder({ id: 'order-456' })];

      db.transferOrder.findMany.mockResolvedValue(orders);

      const result = await transferService.listTransferOrders({
        status: 'PENDING',
        type: 'MACHINE'
      }, user);

      expect(result).toEqual(orders);
      expect(db.transferOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'PENDING',
            type: 'MACHINE'
          })
        })
      );
    });

    test('should enforce branch isolation for regular users', async () => {
      const user = factories.user({ branchId: 'branch-1' });

      db.transferOrder.findMany.mockResolvedValue([]);

      await transferService.listTransferOrders({}, user);

      expect(db.transferOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [{ fromBranchId: 'branch-1' }, { toBranchId: 'branch-1' }]
          })
        })
      );
    });

    test('should not enforce branch isolation for SUPER_ADMIN', async () => {
      const superAdmin = factories.superAdmin();

      db.transferOrder.findMany.mockResolvedValue([]);

      await transferService.listTransferOrders({}, superAdmin);

      expect(db.transferOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            branchId: { not: null }
          })
        })
      );
    });
  });

  describe('getTransferOrderById', () => {
    test('should get order by ID for authorized user', async () => {
      const user = factories.user({ branchId: 'branch-1' });
      const order = factories.transferOrder({
        fromBranchId: 'branch-1',
        toBranchId: 'branch-2'
      });

      db.transferOrder.findFirst.mockResolvedValue(order);

      const result = await transferService.getTransferOrderById(order.id, user);

      expect(result).toEqual(order);
    });

    test('should throw error when order not found', async () => {
      const user = factories.user();

      db.transferOrder.findFirst.mockResolvedValue(null);

      await expect(transferService.getTransferOrderById('invalid-id', user))
        .rejects.toThrow('الإذن غير موجود');
    });

    test('should deny access to order outside user branches', async () => {
      const user = factories.user({ branchId: 'branch-3' });

      db.transferOrder.findFirst.mockResolvedValue(null);

      await expect(transferService.getTransferOrderById('order-id', user))
        .rejects.toThrow('الإذن غير موجود');
    });
  });

  // ==========================================
  // Stats Tests
  // ==========================================
  describe('getStatsSummary', () => {
    test('should return transfer statistics', async () => {
      const user = factories.user();

      db.transferOrder.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(20)  // pending
        .mockResolvedValueOnce(50)  // received
        .mockResolvedValueOnce(10)  // partial
        .mockResolvedValueOnce(5);  // rejected
      db.transferOrderItem.groupBy.mockResolvedValue([
        { isReceived: true, _count: 60 },
        { isReceived: false, _count: 40 }
      ]);

      const result = await transferService.getStatsSummary({}, user);

      expect(result.orders).toEqual({
        total: 100,
        pending: 20,
        received: 50,
        partial: 10,
        rejected: 5
      });
      expect(result.items).toEqual({
        total: 100,
        received: 60,
        pending: 40
      });
    });

    test('should filter by date range', async () => {
      const user = factories.user();
      const fromDate = '2024-01-01';
      const toDate = '2024-01-31';

      db.transferOrder.count.mockResolvedValue(10);
      db.transferOrderItem.groupBy.mockResolvedValue([]);

      await transferService.getStatsSummary({ fromDate, toDate }, user);

      expect(db.transferOrder.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.objectContaining({
              gte: new Date(fromDate),
              lte: new Date(toDate)
            })
          })
        })
      );
    });
  });

  // ==========================================
  // Error Scenarios Tests
  // ==========================================
  describe('Error scenarios', () => {
    test('should handle database errors gracefully', async () => {
      const user = factories.user();
      const orderData = {
        fromBranchId: 'branch-1',
        toBranchId: 'branch-2',
        type: 'MACHINE',
        items: [{ serialNumber: 'SN123456' }]
      };

      mockValidators.validateTransferOrder.mockRejectedValue(new Error('Database connection failed'));

      await expect(transferService.createTransferOrder(orderData, user))
        .rejects.toThrow('Database connection failed');
    });

    test('should handle transaction failures', async () => {
      const user = factories.user({ branchId: 'branch-2' });
      const order = factories.transferOrder({
        toBranchId: 'branch-2',
        items: [factories.transferItem()]
      });

      db.transferOrder.findFirst.mockResolvedValue(order);
      db.$transaction.mockImplementation(async (callback) => {
        try {
          return await callback(db);
        } catch (error) {
          throw error;
        }
      });
      db.transferOrderItem.update.mockRejectedValue(new Error('Update failed'));

      await expect(transferService.receiveTransferOrder(order.id, {
        receivedBy: user.id,
        receivedByName: user.displayName
      }, user))
        .rejects.toThrow('Update failed');
    });

    test('should handle missing branch gracefully', async () => {
      const user = factories.user({ branchId: null });
      const order = factories.transferOrder();

      db.transferOrder.findFirst.mockResolvedValue(null);

      await expect(transferService.getTransferOrderById(order.id, user))
        .rejects.toThrow('الإذن غير موجود');
    });
  });
});
