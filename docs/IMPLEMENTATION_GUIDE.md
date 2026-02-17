# Implementation Guide: Backend Enhancements

**Last Updated**: January 1, 2026  
**Status**: All 12 phases complete including structured logging

This guide explains all the enhancements that have been implemented and how to use them in your routes.

## 📋 Table of Contents
1. [Quick Start](#quick-start)
2. [Error Handling](#error-handling)
3. [Input Validation](#input-validation)
4. [Async Routes](#async-routes)
5. [Configuration](#configuration)
6. [Structured Logging](#structured-logging)
7. [API Documentation](#api-documentation)
8. [Security Features](#security-features)
9. [Health Checks](#health-checks)
10. [Branch Hierarchy & Visibility](#branch-hierarchy--visibility)

---

## Quick Start

### In a New Route File

```javascript
const express = require('express');
const router = express.Router();
const db = require('../db');
const authenticateToken = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../utils/validation/middleware');
const schemas = require('../utils/validation/schemas');
const { NotFoundError, ForbiddenError, AppError } = require('../utils/errors');

/**
 * @route GET /api/items
 * @summary Get all items
 * @security bearerAuth
 * @returns {Array<Object>} List of items
 */
router.get('/items', authenticateToken, asyncHandler(async (req, res) => {
  const items = await db.item.findMany();
  res.json(items);
}));

/**
 * @route POST /api/items
 * @summary Create new item
 * @security bearerAuth
 * @param {Object} body - Item data
 * @returns {Object} Created item
 */
router.post('/items',
  authenticateToken,
  validate('body', schemas.customer.create), // Use existing schema or create custom
  asyncHandler(async (req, res) => {
    const item = await db.item.create({ data: req.body });
    res.status(201).json(item);
  })
);

module.exports = router;
```

---

## Error Handling

### Using AppError Classes

Instead of returning responses manually, throw errors:

```javascript
// ❌ OLD WAY
if (!resource) {
  return res.status(404).json({ error: 'Not found' });
}

// ✅ NEW WAY
const resource = await db.item.findUnique({ where: { id } });
if (!resource) {
  throw new NotFoundError('Item');
}
```

### Available Error Classes

```javascript
const {
  AppError,           // Base error - use for custom errors
  ValidationError,    // 400 - Input validation failed
  NotFoundError,      // 404 - Resource not found
  UnauthorizedError,  // 401 - Authentication failed
  ForbiddenError,     // 403 - Permission denied
  ConflictError       // 409 - Duplicate/conflict
} = require('../utils/errors');

// Examples:
throw new NotFoundError('Customer');                    // 404
throw new ForbiddenError('Access denied');              // 403
throw new ValidationError('Invalid data', { field: 'error message' }); // 400
throw new ConflictError('Customer code already exists');// 409
throw new AppError('Custom error', 500, 'CUSTOM_CODE'); // Generic
```

### Error Response Format

All errors are automatically formatted by the global error handler:

```json
{
  "error": "Customer not found",
  "code": "NOT_FOUND",
  "timestamp": "2024-01-01T12:00:00Z",
  "details": {} // Only for ValidationError
}
```

---

## Input Validation

### Using Existing Schemas

Validation schemas are in `backend/utils/validation/schemas.js`:

- `customer.create` - Create customer
- `customer.update` - Update customer (partial)
- `machine.create` - Create machine
- `machine.update` - Update machine
- `payment.create` - Create payment
- `transferOrder.create` - Create transfer
- `request.create` - Create request
- `pagination` - Query pagination
- `dateRange` - Date filtering

### Using Validation Middleware

```javascript
// Validate request body
router.post('/items',
  validate('body', schemas.customer.create),
  asyncHandler(async (req, res) => {
    // req.body is now validated and cleaned
    console.log(req.body); // trimmed strings, coerced types, etc.
    res.json(req.body);
  })
);

// Validate query parameters
router.get('/items',
  validate('query', schemas.pagination),
  asyncHandler(async (req, res) => {
    // req.query is validated: { skip: 0, take: 20 }
    const items = await db.item.findMany({
      skip: req.query.skip,
      take: req.query.take
    });
    res.json(items);
  })
);
```

### Creating Custom Schemas

Create new schemas in `backend/utils/validation/schemas.js`:

```javascript
const { z } = require('zod');

const createPaymentSchema = z.object({
  customerId: z.string().min(1, 'Customer required'),
  amount: z.number().positive('Amount must be > 0'),
  method: z.enum(['CASH', 'CHEQUE', 'BANK']),
  notes: z.string().optional().or(z.literal(''))
});

module.exports = {
  payment: { create: createPaymentSchema },
  // ... other schemas
};
```

---

## Async Routes

### Eliminating Try/Catch

The `asyncHandler` wrapper catches errors automatically:

```javascript
// ❌ OLD WAY (with try/catch boilerplate)
router.get('/items/:id', async (req, res) => {
  try {
    const item = await db.item.findUnique({ where: { id: req.params.id } });
    if (!item) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.json(item);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ✅ NEW WAY (with asyncHandler + error classes)
router.get('/items/:id', asyncHandler(async (req, res) => {
  const item = await db.item.findUnique({ where: { id: req.params.id } });
  if (!item) throw new NotFoundError('Item');
  res.json(item);
}));
```

### How It Works

```javascript
// asyncHandler converts errors to Express format
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// next(error) calls global error handler which formats response
```

---

## Configuration

### Accessing Config

```javascript
const config = require('../config');

console.log(config.port);                    // 3000
console.log(config.nodeEnv);                 // 'development'
console.log(config.jwt.secret);              // from JWT_SECRET env var
console.log(config.cors.origin);             // array of allowed origins
console.log(config.rateLimiting.maxRequests);// 100
```

### Environment Variables

Create `.env` file in backend root:

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://user:pass@localhost:5432/cs-dept
JWT_SECRET=your-secret-key-here
CORS_ORIGIN=http://localhost:3000,http://localhost:3001
LOG_LEVEL=info
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
OPENAI_API_KEY=your-api-key
MAX_FILE_SIZE=52428800
ENABLE_AI=true
ENABLE_BACKUP=true
```

---

## Structured Logging

### Using the Logger

The logger is automatically imported and available globally:

```javascript
const logger = require('../utils/logger');

// Basic logging
logger.info('User logged in', { userId: '123', branchId: '456' });
logger.warn('Rate limit exceeded', { ip: req.ip });
logger.error({ err: error }, 'Database connection failed');
logger.debug('Cache hit', { key: 'user:123' });
```

### Custom Logging Methods

```javascript
// HTTP Request/Response (already handled by pino-http middleware)
logger.http(req, res, 45); // 45ms response time

// Database queries
logger.db('SELECT', 'Customer', 12, { count: 50 });
// Output: { operation: 'SELECT', model: 'Customer', duration: '12ms', count: 50 }

// Business events
logger.event('customer.created', { customerId: '123', branchId: '456' });
logger.event('payment.received', { amount: 1000, customerId: '789' });

// Security events
logger.security('failed.login', { username: 'admin', ip: '192.168.1.1' });
logger.security('unauthorized.access', { userId: '123', resource: '/admin' });

// Performance metrics
logger.metric('response.time', 45, 'ms');
logger.metric('queue.size', 100, 'items');
```

### Database Audit Logging (Backward Compatible)

The legacy `logAction` function is still available:

```javascript
const { logAction } = require('../utils/logger');

await logAction({
  entityType: 'CUSTOMER',
  entityId: customer.id,
  action: 'CREATE',
  details: `Created customer: ${customer.client_name}`,
  userId: req.user.id,
  performedBy: req.user.displayName,
  branchId: req.user.branchId
});
```

### Log Levels

- **trace**: Very detailed debugging
- **debug**: Debugging information (default in development)
- **info**: General informational messages (default in production)
- **warn**: Warning messages for recoverable issues
- **error**: Error messages for failures
- **fatal**: Application-level failures

### Configuration

Set log level via environment variable:

```env
# .env
LOG_LEVEL=debug  # For development
LOG_LEVEL=info   # For production
```

### Benefits

- ✅ Structured JSON logs for easy parsing and searching
- ✅ Pretty-printed logs in development for readability
- ✅ Auto-redacts sensitive data (passwords, tokens, auth headers)
- ✅ HTTP requests automatically logged with full context
- ✅ Errors include stack traces and contextual data
- ✅ Performance-optimized (Pino is the fastest Node.js logger)
- ✅ Compatible with log aggregation tools (ELK, Datadog, CloudWatch)

---

## API Documentation

### Adding Swagger Docs to Routes

Add JSDoc comments above route handlers:

```javascript
/**
 * @route GET /api/customers
 * @group Customers
 * @summary Get all customers
 * @security bearerAuth
 * @param {number} skip.query - Records to skip (default: 0)
 * @param {number} take.query - Records to return (default: 20)
 * @returns {Array<Object>} 200 - List of customers
 * @returns {Object} 401 - Unauthorized
 * @returns {Object} 500 - Server error
 * @example
 * GET /api/customers?skip=0&take=20
 */
router.get('/customers', authenticateToken, asyncHandler(async (req, res) => {
  // ...
}));
```

### View Documentation

- **Swagger UI**: http://localhost:5000/api-docs
- **API Base**: http://localhost:5000/api

### Swagger Tags

Organize routes by group:

```javascript
/**
 * @route POST /api/customers
 * @group Customers                 // Groups related endpoints
 * @summary Create a customer
 * ...
 */
```

Common groups:
- Customers
- Machines
- Transfer Orders
- Payments
- Requests
- Reports
- Admin

---

## Security Features

### Rate Limiting

Automatically enabled on all `/api` routes. Limits per IP:

```
- Window: 15 minutes (900 seconds)
- Max: 100 requests per IP
```

Customize in `config/index.js`:

```javascript
rateLimiting: {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100
}
```

### Security Headers

Helmet middleware adds security headers automatically:

```
- X-Frame-Options: DENY (prevent clickjacking)
- X-Content-Type-Options: nosniff
- X-XSS-Protection: 1; mode=block
- Content-Security-Policy: default-src 'self'
- Strict-Transport-Security (HTTPS only)
```

### CORS

Configured in `config/index.js`:

```javascript
cors: {
  origin: ['http://localhost:3000', 'https://yourdomain.com'],
  credentials: true
}
```

---

## Health Checks

### Simple Health Check

```bash
GET http://localhost:5000/health

# Response
{
  "status": "up",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "uptime": 3600,
  "environment": "development"
}
```

### Detailed Health Check (with DB)

```bash
GET http://localhost:5000/api/health

# Response (healthy)
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "database": "connected",
  "uptime": 3600,
  "environment": "development",
  "version": "1.0.0"
}

# Response (unhealthy)
{
  "status": "unhealthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "database": "disconnected",
  "error": "Connection timeout"
}
```

---

## Testing with New Features

### Example: Testing Validation

```javascript
describe('POST /customers with validation', () => {
  it('should reject missing required fields', async () => {
    const res = await request(app)
      .post('/api/customers')
      .send({ bkcode: 'CUST001' }); // Missing client_name

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.details.client_name).toBeDefined();
  });

  it('should accept valid data', async () => {
    const res = await request(app)
      .post('/api/customers')
      .send({
        bkcode: 'CUST001',
        client_name: 'Test Store'
      });

    expect(res.status).toBe(201);
    expect(res.body.bkcode).toBe('CUST001');
  });
});
```

### Example: Testing Errors

```javascript
describe('Error handling', () => {
  it('should throw NotFoundError for missing resource', async () => {
    mockDb.customer.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/customers/NOTFOUND');

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
    expect(res.body.timestamp).toBeDefined();
  });
});
```

---

## Migration Checklist

### Step 1: Update Existing Routes ✅
- [x] customers.js - refactored
- [ ] machines.js
- [ ] requests.js
- [ ] payments.js
- [ ] transfer-orders.js
- [ ] (and so on...)

### Step 2: Add Swagger Docs
- Add JSDoc comments to all endpoints
- Test at http://localhost:5000/api-docs

### Step 3: Test Error Scenarios
- Missing required fields → 400 VALIDATION_ERROR
- Non-existent resource → 404 NOT_FOUND
- Permission denied → 403 FORBIDDEN
- Successful operation → 200/201 with correct response

### Step 4: Update Frontend
- Use new error response format with `error` and `code` fields
- Handle rate limiting (HTTP 429)
- Use Bearer token for Authorization header

---

## Troubleshooting

### Error Handler Not Working
- Make sure `errorHandler` middleware is registered LAST in server.js
- Check that all routes use `asyncHandler` wrapper

### Validation Not Working
- Verify schema is imported correctly
- Check that `validate` middleware is in correct order (before asyncHandler)
- Test with invalid data to see validation errors

### Documentation Not Showing
- Verify JSDoc comments are above route handlers
- Check comment format matches Swagger syntax
- Visit http://localhost:5000/api-docs

### Rate Limit Too Restrictive
- Adjust `RATE_LIMIT_MAX_REQUESTS` in .env
- For testing: set to 1000 temporarily
- For production: consider IP whitelisting

---

## Next Steps

### Recommended Priority Order

1. **Update remaining routes** with validation & asyncHandler
2. **Add integration tests** for each route with validation
3. **Complete Swagger documentation** for all endpoints
4. **Add rate limiting exceptions** for non-API endpoints
5. **Implement structured logging** (pino) throughout

### Resources

- [Zod Validation Library](https://zod.dev)
- [Swagger/OpenAPI Spec](https://swagger.io)
- [Express Error Handling](https://expressjs.com/en/guide/error-handling.html)
- [Jest Testing](https://jestjs.io)

---

## Branch Hierarchy & Visibility

### Concept
The system supports a tree-like hierarchy for branches. User visibility is **hierarchical (one-way)**:
- **Parent Branch** users can see their own data + all descendants (child branches).
- **Child Branch** users can only see their own data.

### Implementation in Prisma
Use the `ensureBranchWhere` helper in `backend/prisma/branchHelpers.js`. 
For users with a branch, it automatically fetches family IDs (self + direct children) and filters results.

```javascript
const { ensureBranchWhere } = require('../prisma/branchHelpers');

router.get('/items', authenticateToken, asyncHandler(async (req, res) => {
    // ❌ OLD WAY
    // const items = await db.item.findMany({ where: { branchId: req.user.branchId } });
    
    // ✅ NEW WAY (Hierarchical-aware)
    const args = ensureBranchWhere({
        where: { status: 'ACTIVE' },
        include: { details: true }
    }, req);
    
    const items = await db.item.findMany(args);
    res.json(items);
}));
```

### Authorization Helpers
Use updated helpers in `backend/utils/auth-helpers.js`:

- `getBranchFilter(req)`: Returns `{ branchId: { in: authorizedIds } }` or `{ branchId: id }`.
- `canAccessBranch(req, targetId)`: Returns `true` if `targetId` is user's branch OR a child branch.

### Transfer Permission Logic
Transfers between related branches (Parent to Child or vice-versa) are allowed without Super Admin roles. 

Validation is handled in `backend/utils/transfer-validators.js` via `validateUserPermission(user, fromBranchId)`. It checks if `fromBranchId` is in the user's `authorizedBranchIds` list (populated by `authenticateToken` middleware).

---

