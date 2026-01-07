/**
 * Integration Tests for Routes with Validation & Error Handling
 * 
 * This file shows patterns for testing:
 * - Input validation
 * - Error scenarios
 * - Error handler middleware
 * - Async handler patterns
 */

const request = require('supertest');
const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const errorHandler = require('../utils/errorHandler');
const validate = require('../utils/validation/middleware');
const { NotFoundError, ValidationError, ForbiddenError } = require('../utils/errors');
const schemas = require('../utils/validation/schemas');

describe('Error Handler & Validation Middleware Integration', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    // Test route: Create item with validation
    app.post('/items', 
      validate('body', schemas.customer.create),
      asyncHandler(async (req, res) => {
        // Validation passed, req.body is now validated data
        res.status(201).json({ id: 'item-1', ...req.body });
      })
    );

    // Test route: Get single item
    app.get('/items/:id', asyncHandler(async (req, res) => {
      if (!req.params.id) {
        throw new ValidationError('Item ID is required');
      }
      if (req.params.id === 'forbidden') {
        throw new ForbiddenError('You cannot access this item');
      }
      if (req.params.id === 'notfound') {
        throw new NotFoundError('Item');
      }
      res.json({ id: req.params.id, name: 'Sample Item' });
    }));

    // Error handler MUST be last
    app.use(errorHandler);
  });

  describe('Validation Middleware', () => {
    it('should accept valid input', async () => {
      const res = await request(app)
        .post('/items')
        .send({
          bkcode: 'TEST001',
          client_name: 'Test Client'
        });

      expect(res.status).toBe(201);
      expect(res.body.bkcode).toBe('TEST001');
      expect(res.body.client_name).toBe('Test Client');
    });

    it('should reject missing required fields', async () => {
      const res = await request(app)
        .post('/items')
        .send({
          bkcode: 'TEST001'
          // Missing client_name
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.details).toBeDefined();
      expect(res.body.details['client_name']).toBeDefined();
    });

    it('should trim whitespace from strings', async () => {
      const res = await request(app)
        .post('/items')
        .send({
          bkcode: '  TEST001  ',
          client_name: '  Test Client  '
        });

      expect(res.status).toBe(201);
      expect(res.body.bkcode).toBe('TEST001');
      expect(res.body.client_name).toBe('Test Client');
    });

    it('should reject invalid email format', async () => {
      const res = await request(app)
        .post('/items')
        .send({
          bkcode: 'TEST001',
          client_name: 'Test Client',
          email: 'not-an-email'
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.details.email).toContain('Invalid email');
    });
  });

  describe('Error Handler Middleware', () => {
    it('should format NotFoundError correctly', async () => {
      const res = await request(app)
        .get('/items/notfound');

      expect(res.status).toBe(404);
      expect(res.body).toEqual({
        error: 'Item not found',
        code: 'NOT_FOUND',
        timestamp: expect.any(String)
      });
    });

    it('should format ForbiddenError correctly', async () => {
      const res = await request(app)
        .get('/items/forbidden');

      expect(res.status).toBe(403);
      expect(res.body).toEqual({
        error: 'You cannot access this item',
        code: 'FORBIDDEN',
        timestamp: expect.any(String)
      });
    });

    it('should format ValidationError with details', async () => {
      const res = await request(app)
        .post('/items')
        .send({
          bkcode: '',
          client_name: ''
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.details).toBeDefined();
      expect(Object.keys(res.body.details).length).toBeGreaterThan(0);
    });

    it('should include timestamp in all error responses', async () => {
      const res = await request(app)
        .get('/items/notfound');

      expect(res.body.timestamp).toBeDefined();
      expect(new Date(res.body.timestamp).getTime()).toBeGreaterThan(0);
    });
  });

  describe('Async Handler', () => {
    it('should catch and pass errors to handler', async () => {
      // If asyncHandler didn't work, this would return 500 with unhandled error
      const res = await request(app)
        .get('/items/notfound');

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
    });

    it('should handle ValidationError thrown from route', async () => {
      const res = await request(app)
        .get('/items');

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });
});

/**
 * ROUTE-SPECIFIC TEST EXAMPLES
 * 
 * Pattern: Test happy path, validation errors, and permission errors
 */

describe('Customer Routes with Enhanced Error Handling', () => {
  let mockDb;
  let app;
  const authenticateToken = (req, res, next) => {
    req.user = { id: 'user-1', branchId: 'branch-1' };
    next();
  };

  beforeEach(() => {
    app = express();
    app.use(express.json());
    mockDb = {
      customer: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn()
      }
    };

    // Mock route
    app.post('/customers',
      authenticateToken,
      validate('body', schemas.customer.create),
      asyncHandler(async (req, res) => {
        const customer = await mockDb.customer.create({
          data: { branchId: req.user.branchId, ...req.body }
        });
        res.status(201).json(customer);
      })
    );

    app.use(errorHandler);
  });

  it('should create customer with valid data', async () => {
    mockDb.customer.create.mockResolvedValue({
      bkcode: 'CUST001',
      client_name: 'Ahmed Store'
    });

    const res = await request(app)
      .post('/customers')
      .send({
        bkcode: 'CUST001',
        client_name: 'Ahmed Store'
      });

    expect(res.status).toBe(201);
    expect(res.body.bkcode).toBe('CUST001');
  });

  it('should reject duplicate customer with proper error', async () => {
    const err = new Error('Unique constraint failed');
    err.code = 'P2002';
    mockDb.customer.create.mockRejectedValue(err);

    const res = await request(app)
      .post('/customers')
      .send({
        bkcode: 'DUPLICATE',
        client_name: 'Duplicate Store'
      });

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('INTERNAL_ERROR');
  });

  it('should validate required fields', async () => {
    const res = await request(app)
      .post('/customers')
      .send({
        bkcode: 'CUST001'
        // Missing client_name
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.details.client_name).toBeDefined();
  });
});

/**
 * PATTERNS TO USE IN YOUR TESTS:
 * 
 * 1. Always test validation:
 *    - Missing required fields → 400 VALIDATION_ERROR
 *    - Invalid types → 400 VALIDATION_ERROR with details
 *    - Invalid email/format → 400 VALIDATION_ERROR
 * 
 * 2. Always test permission errors:
 *    - Access denied → 403 FORBIDDEN
 *    - Not authenticated → 401 UNAUTHORIZED
 * 
 * 3. Always test not found:
 *    - Resource doesn't exist → 404 NOT_FOUND
 * 
 * 4. Always test success:
 *    - Valid request → 200/201 with correct response
 * 
 * 5. Test error handler integration:
 *    - Errors are caught by asyncHandler
 *    - Errors are formatted by errorHandler
 *    - Response includes code, error, timestamp
 */
