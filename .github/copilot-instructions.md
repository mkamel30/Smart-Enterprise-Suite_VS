# Smart Enterprise Suite - AI Coding Agent Guide

## Project Architecture

**Full-stack POS maintenance & branch management system** (SQLite + Express + React + Prisma ORM)

- **Backend**: `backend/` - Express.js with service-oriented architecture, 12-phase security enhancement complete
- **Frontend**: `frontend/` - React 18 + Vite + TypeScript + TailwindCSS + Radix UI primitives
- **Database**: Prisma ORM managing SQLite (`prisma/dev.db`) with WAL mode for concurrency
- **Key Feature**: Multi-branch soft isolation via `branchId` column with automated enforcement

## Critical Dev Workflows

### Local Development
```bash
# Start both servers (creates 2 terminal windows)
start_dev.bat
# Backend: http://localhost:5000/api
# Frontend: http://localhost:5173
# Swagger Docs: http://localhost:5000/api-docs
```

### Database Management
```bash
cd backend
npx prisma migrate dev        # Create/apply migrations
npx prisma studio             # GUI database browser
npx prisma generate           # Regenerate client after schema changes
```

**Critical**: After any `schema.prisma` change, run `npx prisma generate` before server restart.

## Data Isolation Architecture (The Most Critical Pattern)

### Branch Enforcement System
**Every query on protected models MUST filter by `branchId`** - enforced by Prisma middleware in `backend/prisma/branchEnforcer.js`.

Protected models: `Customer`, `InventoryItem`, `MaintenanceRequest`, `TransferOrder`, `StockMovement`, `Payment`

**Escape hatch**: Use `__allow_unscoped: true` in query args ONLY for admin operations:
```javascript
const allCustomers = await db.customer.findMany({ 
  where: { /* filters */ },
  __allow_unscoped: true  // Bypasses branch enforcement
});
```

**Authentication flow**: `authenticateToken` middleware → `req.user = { id, branchId, role }` → services inherit user context.

**Role hierarchy**:
- `SUPER_ADMIN`, `MANAGEMENT` → bypass branch filtering (global access)
- Other roles → auto-scoped to `req.user.branchId`

## Prisma Data Access Rules (Ideal Usage)

Always respect branch isolation at the service layer, but never try to encode it inside Prisma's unique operations.

There are two clear categories of Prisma calls:

1. **Collection queries**: `findMany`, `count`, `aggregate` → can include `branchId` filters and complex where objects (AND / OR, etc.).

2. **Unique record queries**: `findUnique`, `findUniqueOrThrow`, `update`, `updateMany`, `delete`, `deleteMany` → must follow stricter patterns.

### 1. Unique record operations
**Rule**: For `findUnique`, `update`, `delete` and their `*OrThrow` variants, the where object must use one unique field only, with no AND, OR or extra filters.

```javascript
// ✅ CORRECT: use a single unique field
const notification = await db.notification.update({
  where: { id }, // id is unique
  data: { isRead: true },
});

// ❌ WRONG: mixing branchId with unique field in AND
const notification = await db.notification.update({
  where: {
    AND: [
      { id },        // unique
      { branchId },  // extra filter → breaks Prisma unique input
    ],
  },
  data: { isRead: true },
});
```

**Pattern**:
- Fetch/update by unique field only.
- Do authorization / branch checks in code after the record is loaded:

```javascript
const machine = await db.warehouseMachine.findUnique({
  where: { serialNumber }, // or { id }
});

if (!machine) {
  throw new NotFoundError('Machine not found');
}

if (machine.branchId !== user.branchId && !userHasGlobalRole(user)) {
  throw new ForbiddenError('Cross-branch access is not allowed');
}
```

### 2. Collection operations with branch scoping
For `findMany`, `count`, `aggregate`, always include branch-aware filters unless you intentionally use the escape hatch.

```javascript
// ✅ CORRECT: branch-scoped list
const shipments = await db.transferOrder.findMany({
  where: {
    branchId: user.branchId,
    status: { in: ['PENDING', 'ACCEPTED', 'RECEIVED'] },
  },
  orderBy: { createdAt: 'desc' },
  include: {
    fromBranch: { select: { name: true, code: true } },
    items: { select: { serialNumber: true, model: true, manufacturer: true, type: true } },
  },
});

// If a user has a global role, branch scoping can be relaxed by the middleware/escape hatch (see next section).
```

### 3. CRITICAL: Query Helper Functions

**NEVER use `ensureBranchWhere` (or similar helpers that wrap `where`) with unique operations.**

This codebase has `backend/prisma/branchHelpers.js` with `ensureBranchWhere()` helper. It wraps `where` in `AND` which **breaks Prisma's unique input requirements**.

```javascript
// ❌ WRONG - causes "NotificationWhereUniqueInput needs id" error
const notification = await db.notification.findUnique(
  ensureBranchWhere({ where: { id } }, req)
);

// ❌ WRONG - causes "WarehouseMachineWhereUniqueInput" error
await db.warehouseMachine.update(
  ensureBranchWhere({
    where: { serialNumber },
    data: { status: 'NEW' }
  }, req)
);
```

**Safe usage**: `ensureBranchWhere` is ONLY safe for collection operations:
- ✅ `findMany`, `findFirst`, `count`, `aggregate`, `groupBy`
- ❌ `findUnique`, `update`, `delete`, `findUniqueOrThrow`

## Branch Isolation Middleware & Escape Hatch (Ideal Behavior)

The branch enforcement layer is responsible for guaranteeing that protected models are always scoped to the correct `branchId`, except in explicitly approved admin flows.

### 1. Branch middleware responsibilities
The middleware should:

- Identify protected models (e.g. `Customer`, `InventoryItem`, `MaintenanceRequest`, `TransferOrder`, `StockMovement`, `Payment`).

- For authenticated users without global roles, automatically inject `branchId = req.user.branchId` into where for collection queries (`findMany`, `count`, etc.) when no branch filter is present.

- For users with global roles (`SUPER_ADMIN`, `MANAGEMENT`), allow cross-branch access without forcing a `branchId` filter.

### 2. Escape hatch: __allow_unscoped
The escape hatch is a custom flag consumed by the middleware, not a real Prisma argument.

It must be named consistently (e.g. `__allow_unscoped`) and removed by the middleware before calling Prisma.

```javascript
// ✅ CORRECT: using escape hatch at service level
const allTransfers = await db.transferOrder.findMany({
  where: {
    status: { in: ['PENDING', 'ACCEPTED', 'RECEIVED'] },
    // optional explicit branch filters if desired
  },
  __allow_unscoped: true, // middleware reads and strips this
});

// ❌ WRONG: passing random flags directly to Prisma (will throw "Unknown argument")
const shipments = await db.transferOrder.findMany({
  where: {
    type: { in: ['SEND_TO_CENTER', 'MAINTENANCE'] },
  },
  allowunscoped: false, // breaks Prisma, not recognized as a valid argument
});
```

### 3. Ideal agent rules for using the escape hatch
Any AI / Copilot agent should follow these rules:

- **Never add `__allow_unscoped` by default.**

- **Only use `__allow_unscoped: true` when:**
  - Implementing global admin reporting or exports.
  - Running maintenance scripts that must see all branches.

- **When `__allow_unscoped` is present:**
  - The service must still enforce business-level rules (permissions, roles) before returning data to the client.

## Service Layer Refactoring Strategy

### 1. Core Business Logic Rules
**All business logic MUST live in `backend/services/`**. Routes should be thin layers that:
- Accept input + user context
- Call service functions
- Return formatted responses

**Prisma operations fall into two categories**:

1. **Unique operations**: `findUnique`, `update`, `delete` → use ONLY one unique field in `where` (no `AND`/`OR`/`branchId`)
2. **Collection operations**: `findMany`, `count`, `aggregate` → can use `branchId`, `AND`, `OR`, and complex filters

### 2. Standard Pattern for Unique Operations

For every protected model (Notifications, WarehouseMachine, TransferOrder, etc.), follow this pattern:

```javascript
// In service layer
async function markNotificationAsRead(notificationId, user) {
  // Step 1: Fetch by unique field ONLY
  const notification = await db.notification.findUnique({
    where: { id: notificationId },  // NO branchId, NO AND
  });

  // Step 2: Validate existence
  if (!notification) {
    throw new NotFoundError('Notification not found');
  }

  // Step 3: Authorization check in code
  if (
    notification.branchId !== user.branchId &&
    !userHasGlobalRole(user) &&
    notification.userId !== user.id
  ) {
    throw new ForbiddenError('Not allowed to access this notification');
  }

  // Step 4: Update by unique field ONLY
  return await db.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });
}
```

**This pattern fixes the common error**:  
`Argument where of type NotificationWhereUniqueInput needs at least one of id arguments`  
Caused by: `where: { AND: [{ id }, { branchId }] }` ❌

**Apply to all models**:
- `warehouseMachine.update` in transitions → use `where: { serialNumber }` only + authorization after fetch
- Any `update`/`delete` currently mixing unique fields with `branchId` in `where`

### 3. BranchId Management via Middleware Only

**NEVER put `branchId` inside `where` for unique operations** - let `branchEnforcer` middleware handle collection queries only.

For services fetching lists (e.g., `getShipmentsForMaintenanceCenter`):

```javascript
const shipments = await db.transferOrder.findMany({
  where: {
    type: { in: ['SEND_TO_CENTER', 'MAINTENANCE'] },
    status: { in: ['PENDING', 'ACCEPTED', 'RECEIVED'] },
    // Don't add branchId here if middleware auto-injects it
  },
  orderBy: { createdAt: 'desc' },
  include: {
    fromBranch: { select: { name: true, code: true } },
    items: { select: { serialNumber: true, model: true, manufacturer: true, type: true } },
  },
});
```

If you need multi-branch queries (e.g., `fromBranchId` OR `toBranchId`), handle it in service logic and let `branchEnforcer` inject the base `branchId` filter when no explicit filter exists.

### 4. Correct Escape Hatch Usage

**The correct flag is `__allow_unscoped`** (not `allowunscoped`). This is a custom flag consumed by middleware, NOT a real Prisma argument.

**❌ WRONG - causes "Unknown argument" error**:
```javascript
const shipments = await db.transferOrder.findMany({
  where: { type: { in: ['SEND_TO_CENTER'] } },
  allowunscoped: false,  // Breaks Prisma!
});
```

**✅ CORRECT**:
```javascript
// Use __allow_unscoped ONLY for:
// - Global admin reports/exports
// - Maintenance scripts
// - Global uniqueness checks (receipts, serials)

const existing = await db.payment.findFirst({
  where: { receiptNumber },
  __allow_unscoped: true,  // Middleware reads and strips this
});
```

**Remove all instances of `allowunscoped: false` immediately** - they cause runtime errors.

### 5. Service Layer Unified Pattern

For each domain (customers, inventory, transfers, maintenance):

**Function signature**:
```javascript
async function serviceName(inputDto, user) { /* ... */ }
// or
async function listItems(user) { /* ... */ }
```

**Function body structure**:
```javascript
async function transitionMachine(serialNumber, nextStatus, user) {
  // 1. Validate input (Zod/validators)
  if (!['INSPECT', 'REPAIR', 'SCRAP'].includes(nextStatus)) {
    throw new ValidationError('Invalid status');
  }

  // 2. Fetch by unique field
  const machine = await db.warehouseMachine.findUnique({
    where: { serialNumber },  // NO AND, NO branchId
  });

  if (!machine) {
    throw new NotFoundError('Machine not found');
  }

  // 3. Authorization + branch rules
  if (machine.branchId !== user.branchId && !userHasGlobalRole(user)) {
    throw new ForbiddenError('Cross-branch access not allowed');
  }

  // 4. Business rules (state machine)
  validateStatusTransition(machine.status, nextStatus);

  // 5. Execute update
  return db.warehouseMachine.update({
    where: { serialNumber },
    data: { status: nextStatus },
  });
}
```

**Custom error classes to use**:
- `ValidationError` (400) - Bad input
- `NotFoundError` (404) - Resource not found
- `ForbiddenError` (403) - Authorization failure
- `ConflictError` (409) - State conflict (duplicate, locked status)

### 6. Transactions & Domain Constraints

**All complex operations** (Transfer, Sale, Maintenance transition) MUST use `db.$transaction`:

```javascript
async function createMachineSale(saleData, user) {
  // Pre-transaction validation
  const validation = await validateSaleData(saleData, user);
  if (!validation.valid) {
    throw new ValidationError(validation.errors.join('\n'));
  }

  return db.$transaction(async (tx) => {
    // 1. Create sale record
    const sale = await tx.machineSale.create({ data: saleData });

    // 2. Update machine status
    await tx.warehouseMachine.update({
      where: { serialNumber: saleData.serialNumber },
      data: { status: 'SOLD', customerId: saleData.customerId }
    });

    // 3. Create payment if applicable
    if (saleData.paidAmount > 0) {
      await tx.payment.create({ data: paymentData });
    }

    // 4. Generate installments
    if (saleData.installments > 0) {
      await createInstallments(tx, sale);
    }

    return sale;
  });
}
```

**Before any transfer or sale**:
- Call `validateTransferOrder()` or `checkMachineConflicts()` validators
- **NEVER manually set status to `IN_TRANSIT`** - only transfer system can do this
- Ensure items are not already SOLD, ASSIGNED, or UNDER_MAINTENANCE

## Backend Conventions

### Service Layer Pattern (Mandatory)
**Routes handle HTTP, Services handle business logic**. Routes in `backend/routes/` use services from `backend/services/`.

```javascript
// ✅ CORRECT: Route delegates to service
router.post('/', authenticateToken, asyncHandler(async (req, res) => {
  const result = await transferService.createTransferOrder(req.body, req.user);
  res.json(result);
}));

// ❌ WRONG: Business logic in route
router.post('/', async (req, res) => {
  const order = await db.transferOrder.create({ data: {...} }); // Don't do this
});
```

### Error Handling Stack
**Use custom error classes** from `backend/utils/errors.js`:
- `ValidationError` (400) - Bad input
- `NotFoundError` (404) - Resource missing
- `ForbiddenError` (403) - Insufficient permissions
- `ConflictError` (409) - State conflict (e.g., item already in transfer)
- `UnauthorizedError` (401) - Auth failure
- `AppError` - Generic with custom status

**Wrap async routes** with `asyncHandler` from `backend/utils/asyncHandler.js` (no try/catch needed):
```javascript
const asyncHandler = require('../utils/asyncHandler');

router.get('/', authenticateToken, asyncHandler(async (req, res) => {
  // Errors auto-caught and sent to global error handler
  const items = await inventoryService.getItems(req.user);
  res.json(items);
}));
```

### Validation with Zod
**Input schemas** live in `backend/validation/schemas/`. Use validation middleware:
```javascript
const { validateRequest } = require('../validation/middleware');
const { createCustomerSchema } = require('../validation/schemas/customer');

router.post('/', authenticateToken, validateRequest(createCustomerSchema), asyncHandler(async (req, res) => {
  // req.body is validated and typed
}));
```

### Structured Logging
**Use pino logger** from `backend/utils/logger.js` with semantic methods:
```javascript
const logger = require('../utils/logger');

logger.http({ path: req.path }, 'Request received');
logger.db({ query: 'findMany', model: 'Customer' }, 'Database query');
logger.security({ ip: req.ip, user: req.user.id }, 'Unauthorized access attempt');
logger.error({ err, context: 'transferService' }, 'Failed to create order');
```

**Never** use `console.log` in production code.

### Transaction Integrity
**Critical multi-step operations** MUST use Prisma transactions:
```javascript
const result = await db.$transaction(async (tx) => {
  const order = await tx.transferOrder.create({ data: orderData });
  await tx.inventoryItem.updateMany({ 
    where: { serialNumber: { in: serials } },
    data: { status: 'IN_TRANSIT' }
  });
  return order;
});
```

## Transfer System Critical Rules

**Most complex domain** - see `documentation/TRANSFER_SYSTEM.md` and `documentation/TRANSFER_PROTECTION_REPORT.md` (Arabic).

### Validators MUST Be Used
**Before any transfer operation**, call validators from `backend/utils/transfer-validators.js`:
```javascript
const { validateTransferOrder } = require('../utils/transfer-validators');

const validation = await validateTransferOrder({ fromBranchId, toBranchId, type, items }, user);
if (!validation.valid) {
  throw new ValidationError(validation.errors.join('\n'));
}
```

### Status Locking Rules
**Cannot transfer items with status**: `IN_TRANSIT`, `SOLD`, `ASSIGNED`, `UNDER_MAINTENANCE`  
**Cannot manually set**: `IN_TRANSIT` (auto-set by transfer system)

### Item Freeze During Pending Transfers
Items in pending transfers are **frozen** - blocked from new transfers until received. Check with:
```javascript
const pending = await transferService.getPendingSerials(branchId);
// Filter out pending serials before creating new transfer
```

## Frontend Conventions

### Component Architecture
**Radix UI primitives MUST be used** for UI components (already installed). Don't build modals/dialogs/dropdowns from scratch.

**Data-UI separation**: Extract state/fetching into custom hooks (`frontend/src/hooks/`), keep page components lean.

```typescript
// ✅ CORRECT: Custom hook + lean component
const useCustomerData = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: () => apiClient.getCustomers()
  });
  return { customers: data, loading: isLoading };
};

// In component:
function Customers() {
  const { customers, loading } = useCustomerData();
  return <CustomerTable data={customers} loading={loading} />;
}
```

### API Client Pattern
**ALL backend calls** go through `frontend/src/api/client.ts` singleton instance. Never use raw `fetch` in components.

```typescript
import { apiClient } from '@/api/client';

// Set token after login
apiClient.setToken(token);

// Make requests
const customers = await apiClient.getCustomers();
```

### TanStack Query (React Query)
**Standard for all data fetching**. Cache key naming: `['entity', filters]`
```typescript
const { data, isLoading, error } = useQuery({
  queryKey: ['maintenance-requests', branchId],
  queryFn: () => apiClient.getRequests(branchId)
});
```

## Documentation Navigation

**Start here**: `documentation/_START_HERE.md` routes by role (frontend/backend/history)

**Architecture deep-dive**: `documentation/ARCHITECTURE.md` - design patterns, tech stack, philosophy  
**System blueprint**: `documentation/SYSTEM_BLUEPRINT.md` - 5-screen architecture, data model  
**API reference**: `documentation/API_SPEC.md` + Swagger at `/api-docs`  
**Transfer system**: `documentation/TRANSFER_SYSTEM.md` - comprehensive transfer flow docs  
**Design system**: `documentation/DESIGN_SYSTEM.md` - UI philosophy (intentional minimalism)  
**Coding standards**: `documentation/THE_RULES.md` - agent behavioral protocol

## Testing

**Backend tests**: Jest with `--runInBand` flag (SQLite concurrency safety)
```bash
cd backend
npm test
```

**Integration test pattern**: See `backend/tests/` - always clean DB state before tests.

## Configuration & Secrets

**Backend env**: `backend/.env` (JWT_SECRET, DATABASE_URL)  
**Frontend env**: `frontend/.env` (VITE_API_URL)  
**Centralized config**: `backend/config/index.js` - all env vars parsed here

**JWT_SECRET is MANDATORY** - server exits if not set (see `backend/middleware/auth.js`).

## Common Pitfalls

1. **Forgot `npx prisma generate`** after schema change → stale types → runtime errors
2. **Missing `branchId` filter** on protected models → middleware throws
3. **Business logic in routes** instead of services → untestable code
4. **Manual `IN_TRANSIT` status** → rejected by API (use transfer system)
5. **Skipping transfer validators** → allows invalid transfers → data corruption
6. **Using `console.log`** → unstructured logs in production (use `logger.*` methods)
7. **Building custom UI primitives** → reinventing Radix components
8. **Missing asyncHandler wrapper** → unhandled promise rejections

## API Endpoints Reference

### Endpoint Documentation Format
Each endpoint follows this pattern for AI agent understanding:
- **HTTP Method + Path**: The route definition
- **Input**: Params, query, body, headers required
- **Output**: Response structure with key fields
- **Scenario**: Real-world usage context
- **Branch Isolation**: Yes/No + enforcement method
- **Auth**: Required role or public
- **Validation**: Zod schemas or custom validators used

### Critical Endpoint Categories

#### 1. Authentication & User Management
```
POST /api/auth/login - Public login endpoint
GET /api/auth/profile - Load user context (branchId, role)
PUT /api/user/preferences - Update UI settings (theme, fontSize, notifications)
```

#### 2. Customers (Branch-Scoped)
```
GET /api/customers - List with auto branchId filter
GET /api/customers/lite - Dropdown-optimized list
POST /api/customers - Create with user.branchId
PUT /api/customers/:id - Validate branch before update
POST /api/customers/import - Excel bulk import
```
**Pattern**: All customer operations validate `customer.branchId === user.branchId` unless admin.

#### 3. Inventory & Warehouse
```
GET /api/inventory - Branch-scoped stock levels
POST /api/inventory/stock-in - Add parts to branch
POST /api/inventory/stock-out - Deduct + create payment
GET /api/warehouse-machines - Filter by status (NEW, STANDBY, SOLD)
POST /api/warehouse-machines/bulk-transfer - Multi-machine transfer
```
**Critical**: `status: IN_TRANSIT` cannot be set manually (use transfer system).

#### 4. Transfer Orders (Most Complex)
```
POST /api/transfer-orders - Create with validateTransferOrder()
GET /api/transfer-orders/pending-serials - Check frozen items
POST /api/transfer-orders/:id/receive - Confirm receipt + update statuses
POST /api/transfer-orders/:id/reject - Reject + revert statuses
```
**Validators**: ALWAYS call `validateTransferOrder()` before creation. Items must not be IN_TRANSIT, SOLD, or in pending transfers.

#### 5. Maintenance Workflows
```
GET /api/maintenance/shipments - Center views incoming transfers
POST /api/maintenance/shipments/:id/receive - Accept shipment
POST /api/maintenance/machine/:serial/transition - State machine (INSPECT → REPAIR → SCRAP)
POST /api/approvals - Center requests repair cost approval
PUT /api/approvals/:id/respond - Branch approves/rejects
```
**Flow**: Branch sends → Center receives → Inspects → Requests approval → Branch responds → Center repairs/scraps → Returns.

#### 6. Notifications
```
GET /api/notifications - User's notifications (unread first)
PUT /api/notifications/:id/read - Mark as read (validates branchId OR same user)
PUT /api/notifications/read-all - Bulk mark read
```
**Authorization**: Manual check allows cross-branch if same userId or admin.

#### 7. Payments & Sales
```
GET /api/payments/check-receipt - Global uniqueness check (__allow_unscoped)
POST /api/payments - Create with receipt validation
POST /api/sales - Sell machine → create payment → generate installments
GET /api/sales/installments - View payment schedule (overdue alerts)
```
**Transaction**: Sales use `db.$transaction` for atomicity.

#### 8. Reports & Dashboard
```
GET /api/dashboard - KPIs, charts, alerts (branch-scoped)
GET /api/reports/movements - Parts usage for accounting
GET /api/stats/dashboard - Lightweight stats version
```

#### 9. Admin & System
```
GET /api/branches - Global branch list
POST /api/backup/create - Manual database backup
GET /api/db-health/health - System health check (public)
GET /api/admin/audit-logs - View system logs
```

#### 10. AI Assistant (Experimental)
```
POST /api/ai/query - Natural language → SQL query
```
**Safety**: Only SELECT queries allowed, auto-adds branchId filter for non-admins.

### Endpoints Using `__allow_unscoped`
These bypass branch enforcement (admin-only operations):
- `GET /api/payments/check-receipt` - Global receipt lookup
- Transfer order number generation (`generateOrderNumber`)
- Admin audit logs (global system view)
- AI query execution (controlled by role-based filter injection)

### Common Validation Patterns
```javascript
// Transfer validators (MANDATORY before transfer creation)
const validation = await validateTransferOrder({ fromBranchId, toBranchId, type, items }, user);
if (!validation.valid) throw new ValidationError(validation.errors.join('\n'));

// Receipt uniqueness check (payments/sales)
const existing = await db.payment.findFirst({ 
  where: { receiptNumber }, 
  __allow_unscoped: true 
});
if (existing) throw new ConflictError('Receipt number already used');

// Machine availability check (sales)
const duplicates = await checkMachineConflicts([serialNumber], branchId);
if (duplicates.length) throw new ConflictError('Machine already sold or assigned');
```

### Transaction Usage
**Critical multi-step operations** MUST use transactions:
```javascript
const result = await db.$transaction(async (tx) => {
  const sale = await tx.machineSale.create({ data: saleData });
  await tx.warehouseMachine.update({ 
    where: { serialNumber }, 
    data: { status: 'SOLD' } 
  });
  if (paidAmount > 0) {
    await tx.payment.create({ data: paymentData });
  }
  return sale;
});
```

## Key Files to Reference

- `backend/server.js` - Middleware stack, security setup
- `backend/services/transferService.js` - Transfer orchestration example
- `backend/utils/transfer-validators.js` - Validation pattern reference
- `backend/middleware/auth.js` - Auth flow
- `backend/prisma/branchEnforcer.js` - Data isolation enforcement
- `frontend/src/api/client.ts` - API client singleton
- `prisma/schema.prisma` - Complete data model
- `backend/routes/` - All 36 route files with Swagger JSDoc annotations
