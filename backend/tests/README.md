# Backend Testing Strategy & Guide

## Overview

This directory contains the Jest test suite for the CS-Dept backend. Tests are organized to isolate database dependencies using Prisma client mocks, transaction mocking, and shared helper utilities.

## Test Structure

```
backend/
├── tests/
│   ├── helpers/
│   │   ├── mockPrismaClient.js      # Shared Prisma client mock factory
│   │   └── setupTests.js            # Jest setup file (runs before all tests)
│   ├── transferService.test.js      # Main transfer order service tests
│   ├── transferService.smoke2.test.js
│   └── ...
└── __tests__/
    ├── authService.test.js
    ├── warehouseService.test.js
    └── ...
```

## Key Concepts

### 1. Shared Mock Prisma Client

All tests use a shared mock factory (`mockPrismaClient.js`) to avoid duplication and ensure consistent mocking across test suites.

**Usage Pattern:**

```javascript
// Import the factory
const { createMockPrismaClient } = require('./helpers/mockPrismaClient');

// Create and customize the mock
const mockDb = createMockPrismaClient();
mockDb.someModel.customMethod = jest.fn().mockResolvedValue({...});

// Mock the db module BEFORE requiring services that import it
jest.doMock('../db', () => mockDb);

// Now require the service - it will use our mocked db
const service = require('../services/yourService');
```

### 2. Transaction Mocking

The service layer heavily uses `db.$transaction()` for atomic operations. The shared mock provides a default implementation:

```javascript
$transaction: jest.fn(async (callback) => {
  // Calls the callback with the mock itself as the transaction context (tx)
  return await callback(mock);
})
```

**For tests that need custom transaction behavior:**

```javascript
let txUsed;
db.$transaction.mockImplementationOnce(async (callback) => {
  const tx = {
    ...mockDb,
    // Override specific methods for transaction context
    transferOrder: {
      ...mockDb.transferOrder,
      update: jest.fn().mockResolvedValue({ status: 'RECEIVED' })
    }
  };
  txUsed = tx;
  return await callback(tx);
});

const result = await serviceFunction(...);
expect(txUsed.transferOrder.update).toHaveBeenCalled();
```

### 3. Automatic Test Setup

The `setupTests.js` file runs automatically before all Jest tests via `jest.config.js`. It ensures:
- `JWT_SECRET` environment variable is set (prevents middleware from aborting)
- Any other global test configuration

**No need to manually set `process.env.JWT_SECRET` in individual test files anymore.**

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (requires custom script in package.json)
npm test -- --watch

# Run a specific test file
npm test -- transferService.test.js

# Run with coverage
npm test -- --coverage

# With verbose output
npm test -- --verbose
```

Or directly with PowerShell:

```powershell
npx jest --runInBand --verbose
```

## Example Test

```javascript
// backend/tests/myService.test.js
const { createMockPrismaClient } = require('./helpers/mockPrismaClient');

// Create shared mock
const mockDb = createMockPrismaClient();

// Mock before requiring service
jest.doMock('../db', () => mockDb);

// Now import service
const myService = require('../services/myService');

describe('myService', () => {
  afterEach(() => jest.clearAllMocks());

  test('creates an item', async () => {
    const mockItem = { id: '1', name: 'Test' };
    mockDb.someModel.create.mockResolvedValue(mockItem);

    const result = await myService.createItem({ name: 'Test' });

    expect(mockDb.someModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { name: 'Test' } })
    );
    expect(result).toEqual(mockItem);
  });
});
```

## Best Practices

1. **Always use `jest.doMock()` before requiring modules**
   - This ensures runtime mocking works correctly
   - Use `jest.mock()` for static mocking (careful with scope)

2. **Clear mocks between tests**
   - Include `jest.clearAllMocks()` in `afterEach()`
   - Or use `clearAllMocks()` if not resetting mocks per test

3. **Test transaction behavior**
   - For critical flows (create/receive/reject/cancel), verify both global and transaction-level (tx.*) mocks are called
   - Use `mockImplementationOnce()` to inject custom tx mocks for specific tests

4. **Keep mocks simple**
   - Use the shared mock factory as a starting point
   - Only override methods you need to test
   - Avoid deeply nested mock implementations

5. **Verify test setup**
   - Run `npm test` (or `npx jest`) to ensure tests pass
   - If a test fails due to missing mocks, check that `jest.doMock()` is called before service require

## Common Issues & Solutions

### Issue: "Cannot read properties of undefined (reading 'someMethod')"
**Solution:** Ensure the mock has that method defined. Check `mockPrismaClient.js` and add it if missing:
```javascript
mockDb.someModel = {
  ...mockDb.someModel,
  someMethod: jest.fn().mockResolvedValue(null)
};
```

### Issue: "JWT_SECRET is not set"
**Solution:** The setup file now handles this automatically. If you see this error, ensure `jest.config.js` points to `setupFilesAfterEnv`.

### Issue: Service imports real db instead of mock
**Solution:** Use `jest.doMock('../db', () => mockDb)` **before** requiring the service:
```javascript
jest.doMock('../db', () => mockDb);
const service = require('../services/myService');
```

## Code Changes Summary

### Files Added
- `backend/tests/helpers/mockPrismaClient.js` — Shared Prisma client mock factory
- `backend/tests/helpers/setupTests.js` — Jest setup file
- `jest.config.js` — Jest configuration with setupFiles

### Files Modified
- `backend/tests/transferService.test.js` — Refactored to use shared mock
- `backend/tests/transferService.smoke2.test.js` — Refactored to use shared mock
- `backend/__tests__/authService.test.js` — Updated to use shared mock and Jest.doMock
- `backend/__tests__/transferService.test.js` — Updated for consistent mocking
- `backend/__tests__/warehouseService.test.js` — Updated for consistent mocking

### Service Changes
- `backend/services/transferService.js` — Transactionalized critical flows (create/receive/reject/cancel)
- Movement logging and notification dispatch now occur post-transaction
- Admin access checks use `__allow_unscoped` for unfiltered queries when appropriate

## Next Steps

1. **Expand coverage** — Consider adding tests for other services (inventoryService, requestService)
2. **Edge case testing** — Add more tests for error paths and boundary conditions
3. **Integration tests** — Once backend is stable, add e2e tests that exercise full flows
4. **CI/CD integration** — Integrate Jest tests into GitHub Actions or similar

## References

- [Jest Mock Documentation](https://jestjs.io/docs/manual-mocks)
- [Jest doMock](https://jestjs.io/docs/jest-object#jestdomockmodulename-factory-options)
- [Prisma Testing](https://www.prisma.io/docs/guides/testing)
