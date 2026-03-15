# Database Query Patterns Guide

## Overview

Smart Enterprise Suite implements sophisticated database query patterns to ensure data integrity, security, and performance across a multi-tenant branch-based architecture. This guide documents all complex query patterns found in the codebase.

**Key Architecture Principles:**
- **Rule 1**: Every query MUST include branchId filter for protected models
- **Transaction Safety**: All multi-step operations use atomic transactions
- **Branch Isolation**: Strict data separation between branches using middleware and helpers
- **Prisma ORM**: All database operations use Prisma with custom middleware

---

## 1. Branch Isolation Patterns

### 1.1 ensureBranchWhere Helper

**Purpose**: Programmatically adds branch filter to Prisma query arguments for non-admin users while allowing global admin users to bypass filtering.

**File**: `backend/prisma/branchHelpers.js:45-95`

```javascript
function ensureBranchWhere(args = {}, req) {
  if (!req || !req.user) return args;

  const userRole = req.user.role;
  const isAdmin = ['SUPER_ADMIN', 'MANAGEMENT', 'ADMIN_AFFAIRS', 'CS_SUPERVISOR', 'CENTER_MANAGER'].includes(userRole);

  // Check for the special marker to skip branch enforcement
  const hasMarker = args._skipBranchEnforcer === true || (args.where && args.where._skipBranchEnforcer === true);

  if (hasMarker) {
    // Strip the marker to avoid Prisma initialization errors
    if (args.where) delete args.where._skipBranchEnforcer;
    delete args._skipBranchEnforcer;

    // For admin/management roles, we truly skip
    if (['SUPER_ADMIN', 'MANAGEMENT'].includes(req.user.role)) {
      return args;
    }
  }
  
  // Resolve branchId from various sources
  const rawBranchId = req.user.branchId || req.body?.branchId || req.query?.branchId;
  const branchId = (rawBranchId && rawBranchId.trim() !== '') ? rawBranchId : null;

  // If no branchId is found and user is Admin, add _skipBranchEnforcer marker
  if (!branchId && isAdmin) {
    if (!args.where) {
      return { ...args, where: { _skipBranchEnforcer: true } };
    }
    return { ...args, where: { ...args.where, _skipBranchEnforcer: true } };
  }

  // If still no branchId and NOT admin, return as is
  if (!branchId) return args;

  // If no where provided, set simple branch filter
  if (!args.where) {
    return { ...args, where: { branchId } };
  }

  // If where exists but doesn't include branchId, wrap with AND
  const where = { ...args.where };
  if (typeof where === 'object' && !Object.prototype.hasOwnProperty.call(where, 'branchId')) {
    return { ...args, where: { AND: [{ branchId }, where] } };
  }

  return args;
}
```

**Best Practices:**
- ✅ Use with `findMany()`, `findFirst()`, `count()`, `aggregate()`, `groupBy()`
- ❌ **NEVER** use with `findUnique()`, `update()`, `delete()` when using unique constraints
- Always check for `_skipBranchEnforcer` marker for admin users
- Wrap filters with `AND` operator to combine branch filter with existing filters

**Common Pitfalls:**
```javascript
// ❌ WRONG: breaks Prisma's unique input requirements
const notif = await db.notification.findUnique(
  ensureBranchWhere({ where: { id } }, req)
);

// ✅ CORRECT: Fetch by unique field, authorize in code
const notif = await db.notification.findUnique({ where: { id } });
if (!notif) throw new NotFoundError();
if (notif.branchId !== user.branchId && !isAdmin) {
  throw new ForbiddenError();
}
```

### 1.2 Branch Enforcer Middleware

**Purpose**: Prisma middleware that enforces branchId filtering on all queries for protected models at runtime.

**File**: `backend/prisma/branchEnforcer.js:59-100`

```javascript
function attachBranchEnforcer(prisma, opts = {}) {
  const models = opts.models || protectedModels;

  prisma.$use(async (params, next) => {
    try {
      // Only enforce on certain actions that accept `where`
      const actionsToCheck = new Set(['findUnique', 'findFirst', 'findMany', 'update', 'updateMany', 'delete', 'deleteMany', 'count', 'aggregate']);
      if (!actionsToCheck.has(params.action)) return next(params);

      const args = params.args || {};

      if (!models.has(params.model)) return next(params);

      // Special marker: if query has _skipBranchEnforcer = true, skip the check
      if (args.where && args.where._skipBranchEnforcer === true) {
        const { _skipBranchEnforcer, ...cleanWhere } = args.where;
        params.args = { ...args, where: Object.keys(cleanWhere).length > 0 ? cleanWhere : undefined };
        if (!params.args.where || Object.keys(params.args.where).length === 0) {
          delete params.args.where;
        }
        return next(params);
      }

      // If there is no `where` argument, block it
      if (!args.where) {
        throw new Error(`Branch filter required: missing 'where' for ${params.model}.${params.action}`);
      }

      if (!containsBranchId(args.where)) {
        throw new Error(`Branch filter required: '${params.model}.${params.action}' must filter by branchId`);
      }

      return next(params);
    } catch (err) {
      throw err;
    }
  });
}
```

**Protected Models:**
```javascript
const protectedModels = new Set([
  'Customer', 'MachineSale', 'Installment', 'MaintenanceRequest',
  'WarehouseMachine', 'WarehouseSim', 'PosMachine', 'SimCard',
  'InventoryItem', 'StockMovement', 'Payment', 'BranchDebt',
  'TransferOrder', 'MaintenanceApproval', 'MaintenanceApprovalRequest',
  'ServiceAssignment', 'UsedPartLog', 'MachineMovementLog',
  'SimMovementLog', 'SystemLog', 'RepairVoucher',
]);
```

**Branch Field Variations:**
```javascript
const branchFieldNames = [
  'branchId',
  'originBranchId',
  'centerBranchId',
  'fromBranchId',
  'toBranchId',
  'debtorBranchId',
  'creditorBranchId',
  'servicedByBranchId',
];
```

---

## 2. Transaction Patterns

### 2.1 Basic Transaction Pattern

**Purpose**: Execute multiple database operations atomically - all succeed or all rollback.

**Example from**: `backend/services/requestService.js:12-80`

```javascript
async function createRequest(data, user) {
    return await db.$transaction(async (tx) => {
        // 1. Validate customer with branch filter
        const customer = await tx.customer.findFirst({
            where: { bkcode: data.customerId, branchId: user.branchId || data.branchId }
        });

        if (!customer) {
            throw new Error('العميل غير موجود');
        }

        // 2. Validate machine if provided
        if (data.posMachineId) {
            const machine = await tx.posMachine.findFirst({
                where: { id: data.posMachineId, branchId: user.branchId || data.branchId }
            });

            if (!machine) {
                throw new Error('الماكينة غير موجودة');
            }
        }

        // 3. Create request
        const request = await tx.maintenanceRequest.create({
            data: {
                customerId: customer.id,
                posMachineId: data.posMachineId || null,
                customerName: customer.client_name,
                // ... other fields
                branchId: user.branchId || data.branchId
            }
        });

        // 4. Log action within same transaction
        await tx.systemLog.create({
            data: {
                entityType: 'REQUEST',
                entityId: request.id,
                action: 'CREATE',
                details: `Created request for customer ${customer.client_name}`,
                userId: user.id,
                performedBy: user.name,
                branchId: request.branchId
            }
        });

        return request;
    });
}
```

**Best Practices:**
- Always use the transaction client `tx` instead of global `db`
- Validate all prerequisites at the beginning
- Throw errors to trigger automatic rollback
- Return the final result from the transaction

### 2.2 Complex Multi-Step Transaction

**Purpose**: Handle complex workflows with multiple entities and side effects.

**Example from**: `backend/services/requestService.js:91-218`

```javascript
async function closeRequest(requestId, actionTaken, usedParts, user, receiptNumber = null) {
    return await db.$transaction(async (tx) => {
        // 1. Get request with customer
        const request = await tx.maintenanceRequest.findFirst({
            where: { id: requestId, branchId: user.branchId },
            include: { customer: true }
        });

        if (!request) throw new Error('طلب الصيانة غير موجود');
        if (request.status === 'Closed') throw new Error('الطلب مغلق بالفعل');

        // 2. Calculate costs
        const partsWithCosts = usedParts.map(p => ({
            ...p,
            totalCost: p.isPaid ? parseFloat(p.cost) * p.quantity : 0
        }));
        const totalCost = partsWithCosts.reduce((sum, p) => sum + p.totalCost, 0);

        // 3. Update request status
        await tx.maintenanceRequest.updateMany({
            where: { id: requestId, branchId: request.branchId },
            data: {
                status: 'Closed',
                actionTaken: actionTaken,
                usedParts: JSON.stringify({ parts: partsWithCosts, totalCost: totalCost }),
                closingTimestamp: new Date(),
                receiptNumber: receiptNumber,
                closingUserId: user.id,
                closingUserName: user.name
            }
        });

        // 4. Deduct inventory (external service call with transaction)
        if (usedParts.length > 0) {
            await inventoryService.deductParts(
                usedParts,
                requestId,
                user.name,
                request.branchId,
                tx // Pass transaction client
            );
        }

        // 5. Create payment if needed
        const paidParts = partsWithCosts.filter(p => p.isPaid && p.cost > 0);
        if (paidParts.length > 0 && request.customerId) {
            await paymentService.createMaintenancePayment(
                paidParts,
                requestId,
                { id: request.customerId, name: request.customer.client_name },
                user,
                receiptNumber,
                tx, // Pass transaction client
                request.branchId
            );
        }

        // 6. Create Repair Vouchers
        const vouchers = [];
        if (paidParts.length > 0) {
            const voucher = await tx.repairVoucher.create({
                data: {
                    code: `VP-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`,
                    requestId: requestId,
                    type: 'PAID',
                    parts: JSON.stringify(paidParts),
                    totalCost: paidParts.reduce((s, p) => s + p.totalCost, 0),
                    branchId: request.branchId,
                    createdBy: user.name
                }
            });
            vouchers.push(voucher);
        }

        // 7. Log action
        await tx.systemLog.create({
            data: {
                entityType: 'REQUEST',
                entityId: requestId,
                action: 'CLOSE',
                details: `Closed with ${usedParts.length} parts. Total: ${totalCost} ج.م`,
                userId: user.id,
                performedBy: user.name,
                branchId: request.branchId
            }
        });

        return { ...updatedRequest, vouchers };
    });
    // If ANY step fails → Everything rolls back! ✓
}
```

### 2.3 Service-to-Service Transaction Passing

**Purpose**: Pass transaction context to external service functions.

**Pattern**:
```javascript
// Service function accepts optional transaction parameter
deductParts: async function(parts, requestId, performedBy, branchId, tx = db) {
    // Use tx instead of db inside the function
    for (const part of parts) {
        await tx.inventoryItem.updateMany({
            where: { partId: part.partId, branchId },
            data: { quantity: { decrement: part.quantity } }
        });
    }
}

// Call with transaction context
await inventoryService.deductParts(parts, requestId, user.name, branchId, tx);
```

**Best Practices:**
- Always pass `tx` as the last parameter with default `db`
- Use `tx` for ALL database operations within the transaction
- Never mix `db` and `tx` calls in the same transaction

---

## 3. Complex Join Patterns

### 3.1 Multi-Level Include Pattern

**Purpose**: Fetch related data in a single query using Prisma's include feature.

**Example from**: `backend/services/transferService.js:207-221`

```javascript
const order = await db.transferOrder.findFirst({
    where: {
        id: orderId,
        branchId: user.branchId,
        OR: [{ toBranchId: user.branchId }, { fromBranchId: user.branchId }]
    },
    include: { 
        fromBranch: true, 
        toBranch: true, 
        items: true 
    }
});
```

### 3.2 Selective Field Include

**Purpose**: Reduce data transfer by selecting only required fields.

**Example from**: `backend/services/maintenanceService.js:594-598`

```javascript
const assignments = await db.serviceAssignment.findMany({
    where,
    skip: (filters.page - 1) * filters.limit,
    take: filters.limit,
    orderBy: { assignedAt: 'desc' },
    include: {
        machine: { select: { model: true, manufacturer: true } },
        logs: { take: 5, orderBy: { performedAt: 'desc' } },
    },
});
```

### 3.3 Nested Relation Filtering

**Purpose**: Filter parent entities based on child entity conditions.

**Example from**: `backend/services/transferService.js:74-76`

```javascript
where.AND = [{ 
    OR: [
        { orderNumber: { contains: q } },
        { items: { some: { serialNumber: { contains: q } } } }
    ] 
}];
```

### 3.4 Complex OR with Multiple Branch Fields

**Purpose**: Handle models with multiple branch reference fields.

**Example from**: `backend/services/maintenanceService.js:396-406`

```javascript
const approvalRequest = await db.maintenanceApprovalRequest.findFirst({
    where: {
        id: approvalRequestId,
        OR: [
            { originBranchId: user.branchId },
            { centerBranchId: user.branchId },
            { branchId: user.branchId }
        ]
    },
});
```

---

## 4. Pagination Patterns

### 4.1 Offset-Based Pagination

**Purpose**: Standard pagination with skip/take using offset calculation.

**Example from**: `backend/services/maintenanceService.js:589-603`

```javascript
const assignments = await db.serviceAssignment.findMany({
    where,
    skip: (filters.page - 1) * filters.limit,
    take: filters.limit,
    orderBy: { assignedAt: 'desc' },
    include: {
        machine: { select: { model: true, manufacturer: true } },
        logs: { take: 5, orderBy: { performedAt: 'desc' } },
    },
});

const total = await db.serviceAssignment.count({ where });

return { assignments, total, page: filters.page, limit: filters.limit };
```

### 4.2 Count with Filtered Query

**Purpose**: Get total count matching the same filters for pagination metadata.

**Pattern**:
```javascript
// Execute count and query in parallel for performance
const [total, items] = await Promise.all([
    db.model.count({ where }),
    db.model.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' }
    })
]);
```

---

## 5. Aggregation Patterns

### 5.1 GroupBy Aggregation

**Purpose**: Group data by specific fields and apply aggregate functions.

**Example from**: `backend/services/transferService.js:723-727`

```javascript
const itemStats = await db.transferOrderItem.groupBy({
    by: ['isReceived'],
    where: { transferOrder: where },
    _count: true
});

// Result processing
return {
    items: {
        total: itemStats.reduce((acc, s) => acc + s._count, 0),
        received: itemStats.find(s => s.isReceived)?._count || 0,
        pending: itemStats.find(s => !s.isReceived)?._count || 0
    }
};
```

### 5.2 Multiple Count Queries

**Purpose**: Get multiple status counts in parallel.

**Example from**: `backend/services/transferService.js:715-721`

```javascript
const [total, pending, received, partial, rejected] = await Promise.all([
    db.transferOrder.count({ where: { ...where, branchId: where.branchId || { not: null } } }),
    db.transferOrder.count({ where: { ...where, status: 'PENDING' } }),
    db.transferOrder.count({ where: { ...where, status: 'RECEIVED' } }),
    db.transferOrder.count({ where: { ...where, status: 'PARTIAL' } }),
    db.transferOrder.count({ where: { ...where, status: 'REJECTED' } })
]);
```

### 5.3 Time-Based Trend Analysis

**Purpose**: Generate time-series data for trend visualization.

**Example from**: `backend/services/requestService.js:311-342`

```javascript
async function getMachineMonthlyRequestCount(serialNumber, months = 6) {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - months, 1);

    const requests = await db.maintenanceRequest.findMany({
        where: {
            serialNumber,
            branchId: { not: null },
            createdAt: { gte: startDate }
        },
        orderBy: { createdAt: 'asc' }
    });

    // Build trend
    const trend = [];
    for (let i = 0; i <= months; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthYear = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const monthCount = requests.filter(r =>
            r.createdAt.getFullYear() === d.getFullYear() &&
            r.createdAt.getMonth() === d.getMonth()
        ).length;
        trend.unshift({ month: monthYear, count: monthCount });
    }

    return { count: requests.length, trend };
}
```

---

## 6. Filter Patterns

### 6.1 Dynamic Filter Building

**Purpose**: Build where clauses dynamically based on optional parameters.

**Example from**: `backend/services/transferService.js:465-483`

```javascript
async function listTransferOrders({ branchId, status, type, fromDate, toDate, q, externalBranchId }, user) {
    let where = {};
    if (status) where.status = status;
    if (type) where.type = type;
    if (fromDate || toDate) {
        where.createdAt = {};
        if (fromDate) where.createdAt.gte = new Date(fromDate);
        if (toDate) where.createdAt.lte = new Date(toDate);
    }
    if (q) {
        where.AND = [{ 
            OR: [
                { orderNumber: { contains: q } },
                { items: { some: { serialNumber: { contains: q } } } }
            ] 
        }];
    }

    // Apply branch scoping
    const args = applyTransferBranchFilter({ 
        where, 
        include: { fromBranch: true, toBranch: true, items: true, _count: { select: { items: true } } },
        orderBy: { createdAt: 'desc' } 
    }, user, branchId || externalBranchId);

    return await db.transferOrder.findMany(args);
}
```

### 6.2 Role-Based Branch Filter

**Purpose**: Apply different branch filtering based on user role.

**Example from**: `backend/services/transferService.js:8-32`

```javascript
function applyTransferBranchFilter(args = {}, user, branchId) {
    const isGlobalAdmin = ['SUPER_ADMIN', 'MANAGEMENT'].includes(user?.role);
    const targetBranchId = isGlobalAdmin ? (branchId || undefined) : user?.branchId;

    // Ensure where exists
    if (!args.where) args.where = {};

    // If we have a target branch, filter by it (either as from or to)
    if (targetBranchId) {
        args.where = {
            ...args.where,
            OR: [{ fromBranchId: targetBranchId }, { toBranchId: targetBranchId }]
        };
    }

    // Every query MUST include branchId filter - RULE 1
    if (isGlobalAdmin) {
        if (!args.where.branchId) {
            args.where.branchId = { not: null };
        }
    }

    return args;
}
```

### 6.3 Array-Based Filtering (IN Operator)

**Purpose**: Filter by multiple values using the `in` operator.

**Example from**: `backend/services/transferService.js:138-145`

```javascript
const machines = await tx.warehouseMachine.findMany({
    where: {
        serialNumber: { in: serialsToTransfer },
        branchId: sourceBranchId
    },
    select: { id: true, serialNumber: true }
});
```

**Example from**: `backend/services/transferService.js:184-189`

```javascript
const activeRequests = await tx.maintenanceRequest.findMany({
    where: { 
        serialNumber: { in: serialsToTransfer }, 
        status: { notIn: ['Closed', 'Cancelled'] },
        branchId: sourceBranchId 
    }
});
```

### 6.4 Complex AND/OR Combinations

**Purpose**: Handle complex authorization logic with combined filters.

**Example from**: `backend/services/transferService.js:505-527`

```javascript
async function getTransferOrderById(id, user) {
    const isAdmin = ['SUPER_ADMIN', 'MANAGEMENT'].includes(user.role);
    let order;
    if (isAdmin) {
        order = await db.transferOrder.findFirst({
            where: { id, branchId: { not: null } },
            include: { fromBranch: true, toBranch: true, items: true }
        });
    } else {
        if (!user.branchId) { 
            const err = new Error('Access denied'); 
            err.status = 403; 
            throw err; 
        }
        order = await db.transferOrder.findFirst({
            where: {
                id,
                branchId: user.branchId,
                OR: [{ toBranchId: user.branchId }, { fromBranchId: user.branchId }]
            },
            include: { fromBranch: true, toBranch: true, items: true }
        });
    }
    // ...
}
```

### 6.5 Enum Status Filtering

**Purpose**: Filter by status enums with multiple valid values.

**Example from**: `backend/services/maintenanceService.js:727-756`

```javascript
async function getShipments(filters, user) {
    const where = {
        type: { in: ['SEND_TO_CENTER', 'MAINTENANCE'] },
    };

    if (!isAdmin) {
        where.toBranchId = branchId;
    } else if (filters.branchId) {
        where.toBranchId = filters.branchId;
    }

    if (filters.status && filters.status !== 'ALL') {
        where.status = filters.status;
    } else if (!filters.status) {
        where.status = { in: ['PENDING', 'ACCEPTED', 'RECEIVED'] };
    }

    // Branch scope for enforcer
    if (branchId) {
        where.OR = [
            { branchId },
            { toBranchId: branchId },
            { fromBranchId: branchId }
        ];
    }

    return await db.transferOrder.findMany({ where, ... });
}
```

---

## 7. Advanced Patterns

### 7.1 Bulk Operations in Transactions

**Purpose**: Process multiple items atomically.

**Example from**: `backend/services/transferService.js:353-431`

```javascript
const result = await db.$transaction(async (tx) => {
    // Get all machines in one query
    const machines = await tx.warehouseMachine.findMany({
        where: { serialNumber: { in: serialNumbers }, branchId: fromBranchId },
        select: { id: true, serialNumber: true, model: true, manufacturer: true, requestId: true }
    });
    const machineMap = new Map(machines.map(m => [m.serialNumber, m]));

    // Create order with nested items
    const order = await tx.transferOrder.create({
        data: {
            orderNumber: `TO-MT-${Date.now()}`,
            fromBranchId,
            toBranchId,
            branchId: toBranchId,
            type: 'MAINTENANCE',
            items: {
                create: serialNumbers.map(s => {
                    const machineInfo = machineMap.get(s) || {};
                    return { 
                        serialNumber: s, 
                        type: 'MACHINE', 
                        model: machineInfo.model || null, 
                        manufacturer: machineInfo.manufacturer || null 
                    };
                })
            }
        }
    });

    // Update all machines in parallel
    for (const serial of serialNumbers) {
        await tx.warehouseMachine.updateMany({
            where: { serialNumber: serial, branchId: fromBranchId },
            data: {
                notes: `In Bulk Transfer ${order.orderNumber}`,
                status: 'IN_TRANSIT',
                originBranchId: fromBranchId
            }
        });
    }

    // Create movement logs
    for (const machine of machines) {
        await tx.machineMovementLog.create({
            data: {
                machineId: machine.id,
                serialNumber: machine.serialNumber,
                action: 'BULK_TRANSFER_TO_MAINTENANCE',
                details: `Bulk transfer to maintenance center`,
                performedBy: performedBy || user.displayName,
                branchId: fromBranchId
            }
        });
    }

    return order;
});
```

### 7.2 Sequential ID Generation

**Purpose**: Generate sequential order numbers with date prefix.

**Example from**: `backend/services/transferService.js:34-53`

```javascript
async function generateOrderNumber() {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

    const lastOrder = await db.transferOrder.findFirst({
        where: {
            orderNumber: { startsWith: `TO-${dateStr}` },
            branchId: { not: null } // RULE 1
        },
        orderBy: { orderNumber: 'desc' }
    });

    let seq = 1;
    if (lastOrder) {
        const parts = lastOrder.orderNumber.split('-');
        seq = parseInt(parts[2] || '0') + 1;
    }

    return `TO-${dateStr}-${seq.toString().padStart(3, '0')}`;
}
```

### 7.3 Post-Query Data Enrichment

**Purpose**: Enhance query results with additional computed data.

**Example from**: `backend/services/maintenanceService.js:775-792`

```javascript
return await Promise.all(shipments.map(async (shipment) => {
    const serials = shipment.items.map(i => i.serialNumber);
    const machines = await db.warehouseMachine.findMany({
        where: { serialNumber: { in: serials }, branchId: { not: null } },
        select: { serialNumber: true, status: true, resolution: true }
    });

    const completedCount = machines.filter(m =>
        ['REPAIRED', 'SCRAPPED', 'RETURNED_AS_IS', 'READY_FOR_DELIVERY', 'IN_RETURN_TRANSIT'].includes(m.status) ||
        m.resolution
    ).length;

    return {
        ...shipment,
        machineStatuses: machines,
        progress: Math.round((completedCount / shipment.items.length) * 100) || 0
    };
}));
```

---

## 8. Security Best Practices

### 8.1 Always Apply Branch Filtering

**Critical Rule**: Every database query on protected models MUST include branchId filter.

```javascript
// ✅ CORRECT: Always include branchId
const items = await db.inventoryItem.findMany({
    where: { partId, branchId }
});

// ❌ WRONG: Missing branchId filter
const items = await db.inventoryItem.findMany({
    where: { partId }
});
```

### 8.2 Validate Before Update/Delete

**Pattern**: Always verify the record belongs to the user's branch before modifying.

```javascript
// ✅ CORRECT: Use updateMany with branchId
await tx.inventoryItem.updateMany({
    where: { id: inventoryItem.id, branchId },
    data: { quantity: { decrement: part.quantity } }
});

// ❌ WRONG: Using update without branch check
await tx.inventoryItem.update({
    where: { id: inventoryItem.id },
    data: { quantity: { decrement: part.quantity } }
});
```

### 8.3 Use findFirst with Branch for Unique Lookups

**Pattern**: When you need to verify branch ownership on a unique lookup.

```javascript
// ✅ CORRECT: Fetch and verify in one query
const request = await tx.maintenanceRequest.findFirst({
    where: { id: requestId, branchId: user.branchId },
    include: { customer: true }
});

if (!request) throw new NotFoundError('Request not found or access denied');
```

---

## Summary

### Critical Rules to Remember

1. **Rule 1**: Every query MUST include branchId filter for protected models
2. **Use Transactions**: All multi-step operations must be atomic
3. **Pass tx to Services**: External service calls within transactions must receive the transaction client
4. **Validate Early**: Check permissions and existence at the start of transactions
5. **Use updateMany**: For updates requiring branch validation, use updateMany with branchId in the where clause
6. **Avoid ensureBranchWhere with Unique Operations**: Manual authorization is safer for unique lookups
7. **Dynamic Filters**: Build where clauses dynamically but always ensure branchId is included
8. **Array Operations**: Use `in` operator for filtering by multiple values
9. **Parallel Queries**: Use `Promise.all()` for independent queries to improve performance
10. **Error Handling**: Throw errors in transactions to trigger automatic rollback

### Quick Reference: When to Use Each Pattern

| Scenario | Pattern | Example |
|----------|---------|---------|
| Branch filtering (simple) | `where: { branchId }` | `findMany({ where: { branchId } })` |
| Branch filtering (complex) | `ensureBranchWhere()` | `ensureBranchWhere(args, req)` |
| Multiple operations atomic | `$transaction()` | `db.$transaction(async (tx) => { ... })` |
| Related data fetching | `include` | `include: { items: true, branch: true }` |
| Pagination | `skip` + `take` | `skip: (page-1)*limit, take: limit` |
| Aggregation | `groupBy` + `_count` | `groupBy({ by: ['status'], _count: true })` |
| Multiple values filter | `in` operator | `where: { id: { in: ids } }` |
| Sequential IDs | `findFirst` + `orderBy` | Generate order numbers with date prefix |
| Data enrichment | Post-query mapping | `Promise.all(results.map(async ...))` |
