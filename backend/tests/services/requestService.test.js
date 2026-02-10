/**
 * Comprehensive Test Suite for Request Service
 * Tests: Create request, Update status, Close request with parts, Error scenarios
 * Features: Mock Prisma, Test Factories, Transaction testing, Error Case Testing
 */

const { createMockPrismaClient } = require('../helpers/mockPrismaClient');

// Mock dependencies
const mockDb = createMockPrismaClient();

// Extend mock with request-specific models
mockDb.customer = {
  findFirst: jest.fn(),
  findUnique: jest.fn()
};

mockDb.posMachine = {
  findFirst: jest.fn(),
  findUnique: jest.fn(),
  findMany: jest.fn()
};

mockDb.maintenanceRequest = {
  create: jest.fn(),
  findFirst: jest.fn(),
  findMany: jest.fn(),
  update: jest.fn(),
  updateMany: jest.fn()
};

mockDb.systemLog = {
  create: jest.fn()
};

mockDb.warehouseMachine = {
  findFirst: jest.fn(),
  findMany: jest.fn(),
  updateMany: jest.fn(),
  create: jest.fn(),
  update: jest.fn()
};

mockDb.repairVoucher = {
  create: jest.fn()
};

// Mock inventory service
const mockInventoryService = {
  deductParts: jest.fn()
};

// Mock payment service
const mockPaymentService = {
  createMaintenancePayment: jest.fn()
};

// Mock movement service
const mockMovementService = {
  logMachineMovement: jest.fn()
};

// Setup mocks before importing modules
jest.doMock('../../db', () => mockDb);
jest.doMock('../../services/inventoryService', () => mockInventoryService);
jest.doMock('../../services/paymentService', () => mockPaymentService);
jest.doMock('../../services/movementService', () => mockMovementService);

const requestService = require('../../services/requestService');
const db = require('../../db');

describe('RequestService', () => {
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
      name: 'Test User',
      displayName: 'Test User',
      role: 'TECHNICIAN',
      branchId: 'branch-1',
      ...overrides
    }),

    customer: (overrides = {}) => ({
      id: 'cust-123',
      bkcode: 'CUST001',
      client_name: 'Test Customer',
      branchId: 'branch-1',
      ...overrides
    }),

    posMachine: (overrides = {}) => ({
      id: 'machine-123',
      serialNumber: 'SN123456',
      model: 'POS-X200',
      manufacturer: 'Ingenico',
      branchId: 'branch-1',
      status: 'NEW',
      ...overrides
    }),

    request: (overrides = {}) => ({
      id: 'req-123',
      customerId: 'cust-123',
      posMachineId: 'machine-123',
      customerName: 'Test Customer',
      machineModel: 'POS-X200',
      machineManufacturer: 'Ingenico',
      serialNumber: 'SN123456',
      complaint: 'Machine not working',
      status: 'Pending',
      branchId: 'branch-1',
      createdAt: new Date(),
      customer: { client_name: 'Test Customer' },
      ...overrides
    }),

    createRequestData: (overrides = {}) => ({
      customerId: 'CUST001',
      posMachineId: 'machine-123',
      machineModel: 'POS-X200',
      machineManufacturer: 'Ingenico',
      serialNumber: 'SN123456',
      complaint: 'Machine not working',
      takeMachine: false,
      branchId: 'branch-1',
      ...overrides
    }),

    usedPart: (overrides = {}) => ({
      partId: 'part-123',
      name: 'Power Supply',
      quantity: 1,
      cost: 150.00,
      isPaid: true,
      reason: 'Power issue',
      ...overrides
    })
  };

  // ==========================================
  // Create Request Tests
  // ==========================================
  describe('createRequest', () => {
    test('should create maintenance request successfully', async () => {
      const user = factories.user();
      const customer = factories.customer();
      const machine = factories.posMachine();
      const requestData = factories.createRequestData();
      const createdRequest = factories.request();

      db.customer.findFirst.mockResolvedValue(customer);
      db.posMachine.findFirst.mockResolvedValue(machine);
      db.maintenanceRequest.create.mockResolvedValue(createdRequest);
      db.systemLog.create.mockResolvedValue({});

      const result = await requestService.createRequest(requestData, user);

      expect(result).toEqual(createdRequest);
      expect(db.maintenanceRequest.create).toHaveBeenCalledWith({
        data: {
          customerId: customer.id,
          posMachineId: machine.id,
          customerName: customer.client_name,
          machineModel: requestData.machineModel,
          machineManufacturer: requestData.machineManufacturer,
          serialNumber: requestData.serialNumber,
          complaint: requestData.complaint,
          status: 'Pending',
          branchId: user.branchId
        }
      });
    });

    test('should create request without machine', async () => {
      const user = factories.user();
      const customer = factories.customer();
      const requestData = factories.createRequestData({ posMachineId: null });
      const createdRequest = factories.request({ posMachineId: null });

      db.customer.findFirst.mockResolvedValue(customer);
      db.maintenanceRequest.create.mockResolvedValue(createdRequest);
      db.systemLog.create.mockResolvedValue({});

      const result = await requestService.createRequest(requestData, user);

      expect(result).toEqual(createdRequest);
      expect(db.posMachine.findFirst).not.toHaveBeenCalled();
    });

    test('should throw error when customer not found', async () => {
      const user = factories.user();
      const requestData = factories.createRequestData();

      db.customer.findFirst.mockResolvedValue(null);

      await expect(requestService.createRequest(requestData, user))
        .rejects.toThrow('العميل غير موجود');
    });

    test('should throw error when machine not found', async () => {
      const user = factories.user();
      const customer = factories.customer();
      const requestData = factories.createRequestData();

      db.customer.findFirst.mockResolvedValue(customer);
      db.posMachine.findFirst.mockResolvedValue(null);

      await expect(requestService.createRequest(requestData, user))
        .rejects.toThrow('الماكينة غير موجودة');
    });

    test('should handle machine receipt to warehouse when takeMachine is true', async () => {
      const user = factories.user();
      const customer = factories.customer();
      const machine = factories.posMachine();
      const requestData = factories.createRequestData({ takeMachine: true });
      const createdRequest = factories.request();
      const warehouseMachine = { id: 'wh-123', serialNumber: machine.serialNumber };

      db.customer.findFirst.mockResolvedValue(customer);
      db.posMachine.findFirst
        .mockResolvedValueOnce(machine)
        .mockResolvedValueOnce(machine);
      db.maintenanceRequest.create.mockResolvedValue(createdRequest);
      db.systemLog.create.mockResolvedValue({});
      db.warehouseMachine.findFirst.mockResolvedValue(null);
      db.warehouseMachine.create.mockResolvedValue(warehouseMachine);

      await requestService.createRequest(requestData, user);

      expect(db.warehouseMachine.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          serialNumber: machine.serialNumber,
          status: 'EXTERNAL_REPAIR',
          customerId: customer.id,
          requestId: createdRequest.id,
          branchId: user.branchId
        })
      });
    });

    test('should update existing warehouse machine when takeMachine is true', async () => {
      const user = factories.user();
      const customer = factories.customer();
      const machine = factories.posMachine();
      const requestData = factories.createRequestData({ takeMachine: true });
      const createdRequest = factories.request();
      const existingWarehouse = { id: 'wh-123', serialNumber: machine.serialNumber };

      db.customer.findFirst.mockResolvedValue(customer);
      db.posMachine.findFirst
        .mockResolvedValueOnce(machine)
        .mockResolvedValueOnce(machine);
      db.maintenanceRequest.create.mockResolvedValue(createdRequest);
      db.systemLog.create.mockResolvedValue({});
      db.warehouseMachine.findFirst.mockResolvedValue(existingWarehouse);
      db.warehouseMachine.updateMany.mockResolvedValue({ count: 1 });

      await requestService.createRequest(requestData, user);

      expect(db.warehouseMachine.updateMany).toHaveBeenCalledWith({
        where: { id: existingWarehouse.id, branchId: user.branchId },
        data: expect.objectContaining({
          status: 'EXTERNAL_REPAIR',
          customerId: customer.id,
          requestId: createdRequest.id
        })
      });
    });

    test('should log creation action', async () => {
      const user = factories.user();
      const customer = factories.customer();
      const requestData = factories.createRequestData();
      const createdRequest = factories.request();

      db.customer.findFirst.mockResolvedValue(customer);
      db.posMachine.findFirst.mockResolvedValue(factories.posMachine());
      db.maintenanceRequest.create.mockResolvedValue(createdRequest);
      db.systemLog.create.mockResolvedValue({});

      await requestService.createRequest(requestData, user);

      expect(db.systemLog.create).toHaveBeenCalledWith({
        data: {
          entityType: 'REQUEST',
          entityId: createdRequest.id,
          action: 'CREATE',
          details: expect.stringContaining(customer.client_name),
          userId: user.id,
          performedBy: user.name,
          branchId: createdRequest.branchId
        }
      });
    });

    test('should use user branchId when creating request', async () => {
      const user = factories.user({ branchId: 'user-branch' });
      const customer = factories.customer();
      const requestData = factories.createRequestData({ branchId: 'data-branch' });
      const createdRequest = factories.request();

      db.customer.findFirst.mockResolvedValue(customer);
      db.posMachine.findFirst.mockResolvedValue(factories.posMachine());
      db.maintenanceRequest.create.mockResolvedValue(createdRequest);
      db.systemLog.create.mockResolvedValue({});

      await requestService.createRequest(requestData, user);

      expect(db.maintenanceRequest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          branchId: 'user-branch'
        })
      });
    });
  });

  // ==========================================
  // Update Status Tests
  // ==========================================
  describe('updateStatus', () => {
    test('should update request status successfully', async () => {
      const user = factories.user();
      const request = factories.request();
      const updatedRequest = { ...request, status: 'In Progress' };

      db.maintenanceRequest.updateMany.mockResolvedValue({ count: 1 });
      db.maintenanceRequest.findFirst.mockResolvedValue(updatedRequest);
      db.systemLog.create.mockResolvedValue({});

      const result = await requestService.updateStatus(request.id, 'In Progress', user);

      expect(result.status).toBe('In Progress');
      expect(db.maintenanceRequest.updateMany).toHaveBeenCalledWith({
        where: { id: request.id, branchId: user.branchId },
        data: { status: 'In Progress' }
      });
    });

    test('should log status change', async () => {
      const user = factories.user();
      const request = factories.request();
      const updatedRequest = { ...request, status: 'In Progress' };

      db.maintenanceRequest.updateMany.mockResolvedValue({ count: 1 });
      db.maintenanceRequest.findFirst.mockResolvedValue(updatedRequest);
      db.systemLog.create.mockResolvedValue({});

      await requestService.updateStatus(request.id, 'In Progress', user);

      expect(db.systemLog.create).toHaveBeenCalledWith({
        data: {
          entityType: 'REQUEST',
          entityId: request.id,
          action: 'UPDATE',
          details: 'Status changed to In Progress',
          userId: user.id,
          performedBy: user.name,
          branchId: updatedRequest.branchId
        }
      });
    });

    test('should enforce branchId filter', async () => {
      const user = factories.user();
      const request = factories.request();

      db.maintenanceRequest.updateMany.mockResolvedValue({ count: 1 });
      db.maintenanceRequest.findFirst.mockResolvedValue(request);
      db.systemLog.create.mockResolvedValue({});

      await requestService.updateStatus(request.id, 'Closed', user);

      expect(db.maintenanceRequest.updateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          branchId: user.branchId
        }),
        data: expect.any(Object)
      });
    });
  });

  // ==========================================
  // Close Request Tests
  // ==========================================
  describe('closeRequest', () => {
    test('should close request with paid parts successfully', async () => {
      const user = factories.user();
      const request = factories.request();
      const parts = [factories.usedPart()];
      const updatedRequest = { ...request, status: 'Closed' };
      const voucher = { id: 'voucher-123', code: 'VP-123', type: 'PAID' };

      db.maintenanceRequest.findFirst.mockResolvedValue(request);
      db.maintenanceRequest.updateMany.mockResolvedValue({ count: 1 });
      db.maintenanceRequest.findFirst
        .mockResolvedValueOnce(request)
        .mockResolvedValueOnce(updatedRequest);
      mockInventoryService.deductParts.mockResolvedValue();
      mockPaymentService.createMaintenancePayment.mockResolvedValue();
      db.repairVoucher.create.mockResolvedValue(voucher);
      db.systemLog.create.mockResolvedValue({});

      const result = await requestService.closeRequest(
        request.id,
        'Replaced power supply',
        parts,
        user,
        'RCP-001'
      );

      expect(result.status).toBe('Closed');
      expect(mockInventoryService.deductParts).toHaveBeenCalled();
      expect(mockPaymentService.createMaintenancePayment).toHaveBeenCalled();
      expect(db.repairVoucher.create).toHaveBeenCalled();
    });

    test('should close request with free parts successfully', async () => {
      const user = factories.user();
      const request = factories.request();
      const parts = [factories.usedPart({ isPaid: false, cost: 0 })];
      const updatedRequest = { ...request, status: 'Closed' };
      const voucher = { id: 'voucher-124', code: 'VF-124', type: 'FREE' };

      db.maintenanceRequest.findFirst.mockResolvedValue(request);
      db.maintenanceRequest.updateMany.mockResolvedValue({ count: 1 });
      db.maintenanceRequest.findFirst
        .mockResolvedValueOnce(request)
        .mockResolvedValueOnce(updatedRequest);
      mockInventoryService.deductParts.mockResolvedValue();
      db.repairVoucher.create.mockResolvedValue(voucher);
      db.systemLog.create.mockResolvedValue({});

      const result = await requestService.closeRequest(
        request.id,
        'Cleaned machine',
        parts,
        user
      );

      expect(result.status).toBe('Closed');
      expect(mockPaymentService.createMaintenancePayment).not.toHaveBeenCalled();
    });

    test('should close request without parts', async () => {
      const user = factories.user();
      const request = factories.request();
      const updatedRequest = { ...request, status: 'Closed' };

      db.maintenanceRequest.findFirst.mockResolvedValue(request);
      db.maintenanceRequest.updateMany.mockResolvedValue({ count: 1 });
      db.maintenanceRequest.findFirst
        .mockResolvedValueOnce(request)
        .mockResolvedValueOnce(updatedRequest);
      db.systemLog.create.mockResolvedValue({});

      const result = await requestService.closeRequest(
        request.id,
        'Software reset',
        [],
        user
      );

      expect(result.status).toBe('Closed');
      expect(mockInventoryService.deductParts).not.toHaveBeenCalled();
      expect(mockPaymentService.createMaintenancePayment).not.toHaveBeenCalled();
    });

    test('should throw error when request not found', async () => {
      const user = factories.user();

      db.maintenanceRequest.findFirst.mockResolvedValue(null);

      await expect(requestService.closeRequest('invalid-id', 'action', [], user))
        .rejects.toThrow('طلب الصيانة غير موجود');
    });

    test('should throw error when request is already closed', async () => {
      const user = factories.user();
      const request = factories.request({ status: 'Closed' });

      db.maintenanceRequest.findFirst.mockResolvedValue(request);

      await expect(requestService.closeRequest(request.id, 'action', [], user))
        .rejects.toThrow('الطلب مغلق بالفعل');
    });

    test('should calculate total cost correctly', async () => {
      const user = factories.user();
      const request = factories.request();
      const parts = [
        factories.usedPart({ partId: 'part-1', cost: 100, quantity: 2, isPaid: true }),
        factories.usedPart({ partId: 'part-2', cost: 50, quantity: 1, isPaid: true }),
        factories.usedPart({ partId: 'part-3', cost: 75, quantity: 1, isPaid: false })
      ];
      const updatedRequest = { ...request, status: 'Closed' };

      db.maintenanceRequest.findFirst.mockResolvedValue(request);
      db.maintenanceRequest.updateMany.mockResolvedValue({ count: 1 });
      db.maintenanceRequest.findFirst
        .mockResolvedValueOnce(request)
        .mockResolvedValueOnce(updatedRequest);
      mockInventoryService.deductParts.mockResolvedValue();
      mockPaymentService.createMaintenancePayment.mockResolvedValue();
      db.repairVoucher.create.mockResolvedValue({ id: 'voucher-123' });
      db.systemLog.create.mockResolvedValue({});

      await requestService.closeRequest(request.id, 'Multiple repairs', parts, user);

      // Total paid cost should be (100 * 2) + (50 * 1) = 250
      expect(db.maintenanceRequest.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            usedParts: expect.stringContaining('250')
          })
        })
      );
    });

    test('should create both paid and free vouchers when applicable', async () => {
      const user = factories.user();
      const request = factories.request();
      const parts = [
        factories.usedPart({ partId: 'paid-1', cost: 100, isPaid: true }),
        factories.usedPart({ partId: 'free-1', cost: 0, isPaid: false })
      ];
      const updatedRequest = { ...request, status: 'Closed' };

      db.maintenanceRequest.findFirst.mockResolvedValue(request);
      db.maintenanceRequest.updateMany.mockResolvedValue({ count: 1 });
      db.maintenanceRequest.findFirst
        .mockResolvedValueOnce(request)
        .mockResolvedValueOnce(updatedRequest);
      mockInventoryService.deductParts.mockResolvedValue();
      mockPaymentService.createMaintenancePayment.mockResolvedValue();
      db.repairVoucher.create
        .mockResolvedValueOnce({ id: 'vp-123', type: 'PAID' })
        .mockResolvedValueOnce({ id: 'vf-124', type: 'FREE' });
      db.systemLog.create.mockResolvedValue({});

      const result = await requestService.closeRequest(request.id, 'Mixed parts', parts, user);

      expect(db.repairVoucher.create).toHaveBeenCalledTimes(2);
      expect(result.vouchers).toHaveLength(2);
    });

    test('should include receipt number when provided', async () => {
      const user = factories.user();
      const request = factories.request();
      const parts = [factories.usedPart()];
      const updatedRequest = { ...request, status: 'Closed' };

      db.maintenanceRequest.findFirst.mockResolvedValue(request);
      db.maintenanceRequest.updateMany.mockResolvedValue({ count: 1 });
      db.maintenanceRequest.findFirst
        .mockResolvedValueOnce(request)
        .mockResolvedValueOnce(updatedRequest);
      mockInventoryService.deductParts.mockResolvedValue();
      mockPaymentService.createMaintenancePayment.mockResolvedValue();
      db.repairVoucher.create.mockResolvedValue({ id: 'voucher-123' });
      db.systemLog.create.mockResolvedValue({});

      await requestService.closeRequest(request.id, 'Repair', parts, user, 'RCP-001');

      expect(db.maintenanceRequest.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            receiptNumber: 'RCP-001'
          })
        })
      );
    });

    test('should log closing action', async () => {
      const user = factories.user();
      const request = factories.request();
      const parts = [factories.usedPart()];
      const updatedRequest = { ...request, status: 'Closed' };

      db.maintenanceRequest.findFirst.mockResolvedValue(request);
      db.maintenanceRequest.updateMany.mockResolvedValue({ count: 1 });
      db.maintenanceRequest.findFirst
        .mockResolvedValueOnce(request)
        .mockResolvedValueOnce(updatedRequest);
      mockInventoryService.deductParts.mockResolvedValue();
      mockPaymentService.createMaintenancePayment.mockResolvedValue();
      db.repairVoucher.create.mockResolvedValue({ id: 'voucher-123' });
      db.systemLog.create.mockResolvedValue({});

      await requestService.closeRequest(request.id, 'Repair', parts, user);

      expect(db.systemLog.create).toHaveBeenCalledWith({
        data: {
          entityType: 'REQUEST',
          entityId: request.id,
          action: 'CLOSE',
          details: expect.stringContaining('Closed with'),
          userId: user.id,
          performedBy: user.name,
          branchId: request.branchId
        }
      });
    });

    test('should use transaction for atomic operations', async () => {
      const user = factories.user();
      const request = factories.request();

      db.maintenanceRequest.findFirst.mockResolvedValue(request);

      await requestService.closeRequest(request.id, 'action', [], user);

      expect(db.$transaction).toHaveBeenCalled();
    });
  });

  // ==========================================
  // Receive Machine to Warehouse Tests
  // ==========================================
  describe('receiveMachineToWarehouse', () => {
    test('should create new warehouse entry when machine not exists', async () => {
      const user = factories.user();
      const machine = factories.posMachine();
      const data = {
        serialNumber: machine.serialNumber,
        customerId: 'cust-123',
        customerName: 'Test Customer',
        requestId: 'req-123',
        branchId: user.branchId,
        performedBy: user.name
      };

      db.warehouseMachine.findFirst.mockResolvedValue(null);
      db.posMachine.findFirst.mockResolvedValue(machine);
      db.warehouseMachine.create.mockResolvedValue({ id: 'wh-123' });
      mockMovementService.logMachineMovement.mockResolvedValue();

      await requestService.receiveMachineToWarehouse(db, data);

      expect(db.warehouseMachine.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          serialNumber: data.serialNumber,
          status: 'EXTERNAL_REPAIR',
          customerId: data.customerId,
          customerName: data.customerName,
          requestId: data.requestId,
          branchId: data.branchId,
          model: machine.model,
          manufacturer: machine.manufacturer
        })
      });
    });

    test('should update existing warehouse entry', async () => {
      const user = factories.user();
      const machine = factories.posMachine();
      const existingWarehouse = {
        id: 'wh-123',
        serialNumber: machine.serialNumber,
        model: 'Old Model',
        manufacturer: 'Old Manufacturer'
      };
      const data = {
        serialNumber: machine.serialNumber,
        customerId: 'cust-123',
        customerName: 'Test Customer',
        requestId: 'req-123',
        branchId: user.branchId,
        performedBy: user.name
      };

      db.warehouseMachine.findFirst.mockResolvedValue(existingWarehouse);
      db.posMachine.findFirst.mockResolvedValue(machine);
      db.warehouseMachine.updateMany.mockResolvedValue({ count: 1 });
      mockMovementService.logMachineMovement.mockResolvedValue();

      await requestService.receiveMachineToWarehouse(db, data);

      expect(db.warehouseMachine.updateMany).toHaveBeenCalledWith({
        where: { id: existingWarehouse.id, branchId: data.branchId },
        data: expect.objectContaining({
          status: 'EXTERNAL_REPAIR',
          model: machine.model,
          manufacturer: machine.manufacturer
        })
      });
    });

    test('should log machine movement', async () => {
      const user = factories.user();
      const machine = factories.posMachine();
      const data = {
        serialNumber: machine.serialNumber,
        customerId: 'cust-123',
        customerName: 'Test Customer',
        requestId: 'req-123',
        branchId: user.branchId,
        performedBy: user.name
      };

      db.warehouseMachine.findFirst.mockResolvedValue(null);
      db.posMachine.findFirst.mockResolvedValue(machine);
      db.warehouseMachine.create.mockResolvedValue({ id: 'wh-123' });
      mockMovementService.logMachineMovement.mockResolvedValue();

      await requestService.receiveMachineToWarehouse(db, data);

      expect(mockMovementService.logMachineMovement).toHaveBeenCalledWith(
        db,
        expect.objectContaining({
          serialNumber: data.serialNumber,
          action: 'CLIENT_RECEIVED',
          performedBy: data.performedBy,
          branchId: data.branchId
        })
      );
    });
  });

  // ==========================================
  // Get Machine Monthly Request Count Tests
  // ==========================================
  describe('getMachineMonthlyRequestCount', () => {
    test('should return request count and trend', async () => {
      const serialNumber = 'SN123456';
      const requests = [
        { id: 'req-1', serialNumber, createdAt: new Date('2024-01-15') },
        { id: 'req-2', serialNumber, createdAt: new Date('2024-02-20') },
        { id: 'req-3', serialNumber, createdAt: new Date('2024-03-10') }
      ];

      db.maintenanceRequest.findMany.mockResolvedValue(requests);

      const result = await requestService.getMachineMonthlyRequestCount(serialNumber, 6);

      expect(result.count).toBe(3);
      expect(result.trend).toBeDefined();
      expect(result.trend.length).toBeGreaterThan(0);
    });

    test('should enforce branchId filter in query', async () => {
      const serialNumber = 'SN123456';

      db.maintenanceRequest.findMany.mockResolvedValue([]);

      await requestService.getMachineMonthlyRequestCount(serialNumber, 6);

      expect(db.maintenanceRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            branchId: { not: null }
          })
        })
      );
    });
  });

  // ==========================================
  // Branch Isolation Tests
  // ==========================================
  describe('Branch isolation', () => {
    test('createRequest should enforce customer branchId filter', async () => {
      const user = factories.user();
      const customer = factories.customer();
      const requestData = factories.createRequestData();

      db.customer.findFirst.mockResolvedValue(customer);
      db.posMachine.findFirst.mockResolvedValue(factories.posMachine());
      db.maintenanceRequest.create.mockResolvedValue(factories.request());
      db.systemLog.create.mockResolvedValue({});

      await requestService.createRequest(requestData, user);

      expect(db.customer.findFirst).toHaveBeenCalledWith({
        where: { bkcode: requestData.customerId, branchId: user.branchId }
      });
    });

    test('createRequest should enforce machine branchId filter', async () => {
      const user = factories.user();
      const customer = factories.customer();
      const machine = factories.posMachine();
      const requestData = factories.createRequestData();

      db.customer.findFirst.mockResolvedValue(customer);
      db.posMachine.findFirst.mockResolvedValue(machine);
      db.maintenanceRequest.create.mockResolvedValue(factories.request());
      db.systemLog.create.mockResolvedValue({});

      await requestService.createRequest(requestData, user);

      expect(db.posMachine.findFirst).toHaveBeenCalledWith({
        where: { id: requestData.posMachineId, branchId: user.branchId }
      });
    });

    test('closeRequest should enforce branchId filter', async () => {
      const user = factories.user();
      const request = factories.request();

      db.maintenanceRequest.findFirst.mockResolvedValue(request);

      await requestService.closeRequest(request.id, 'action', [], user);

      expect(db.maintenanceRequest.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            branchId: user.branchId
          })
        })
      );
    });

    test('updateStatus should enforce branchId filter', async () => {
      const user = factories.user();
      const request = factories.request();

      db.maintenanceRequest.updateMany.mockResolvedValue({ count: 1 });
      db.maintenanceRequest.findFirst.mockResolvedValue(request);
      db.systemLog.create.mockResolvedValue({});

      await requestService.updateStatus(request.id, 'Closed', user);

      expect(db.maintenanceRequest.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            branchId: user.branchId
          })
        })
      );
    });
  });

  // ==========================================
  // Error Scenario Tests
  // ==========================================
  describe('Error scenarios', () => {
    test('should handle database error during request creation', async () => {
      const user = factories.user();
      const requestData = factories.createRequestData();

      db.customer.findFirst.mockRejectedValue(new Error('Database connection failed'));

      await expect(requestService.createRequest(requestData, user))
        .rejects.toThrow('Database connection failed');
    });

    test('should handle transaction rollback on closeRequest failure', async () => {
      const user = factories.user();
      const request = factories.request();
      const parts = [factories.usedPart()];

      db.maintenanceRequest.findFirst.mockResolvedValue(request);
      db.$transaction.mockImplementation(async (callback) => {
        try {
          return await callback(db);
        } catch (error) {
          throw error;
        }
      });
      mockInventoryService.deductParts.mockRejectedValue(new Error('Insufficient inventory'));

      await expect(requestService.closeRequest(request.id, 'action', parts, user))
        .rejects.toThrow('Insufficient inventory');
    });

    test('should handle missing receipt number gracefully', async () => {
      const user = factories.user();
      const request = factories.request();
      const parts = [factories.usedPart()];
      const updatedRequest = { ...request, status: 'Closed' };

      db.maintenanceRequest.findFirst.mockResolvedValue(request);
      db.maintenanceRequest.updateMany.mockResolvedValue({ count: 1 });
      db.maintenanceRequest.findFirst
        .mockResolvedValueOnce(request)
        .mockResolvedValueOnce(updatedRequest);
      mockInventoryService.deductParts.mockResolvedValue();
      mockPaymentService.createMaintenancePayment.mockResolvedValue();
      db.repairVoucher.create.mockResolvedValue({ id: 'voucher-123' });
      db.systemLog.create.mockResolvedValue({});

      const result = await requestService.closeRequest(request.id, 'Repair', parts, user);

      expect(result).toBeDefined();
    });
  });
});
