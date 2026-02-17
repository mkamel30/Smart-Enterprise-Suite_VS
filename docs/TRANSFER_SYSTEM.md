# 🔄 Transfer System Documentation

## Overview
Complete documentation for the Transfer Order system including validation, security, and API usage.

## 📚 Related Documentation

### Core Documents
1. **[TRANSFER_PROTECTION_REPORT.md](../TRANSFER_PROTECTION_REPORT.md)** - Complete technical report (Arabic)
   - System overview and validation rules
   - All modified files and changes
   - Security guarantees
   - Usage examples and error messages

2. **[TRANSFER_VALIDATION_COVERAGE.md](../TRANSFER_VALIDATION_COVERAGE.md)** - Coverage analysis
   - What's protected vs what needs work
   - Priority action items
   - Risk assessment

### Implementation Files

#### Validators (`backend/utils/`)
- **transfer-validators.js** - Comprehensive validation functions
  - `validateItemsForTransfer()`
  - `validateBranches()`
  - `validateUserPermission()`
  - `validateTransferOrder()`

#### Services (`backend/services/`)
- **transferService.js** - Transfer order business logic
  - `createTransferOrder()` - With full validation
  - `receiveTransferOrder()` - Handle receipt
  - `createBulkTransfer()` - Bulk transfers with validation
  - `getPendingSerials()` - Get items in pending transfers

#### Routes (`backend/routes/`)
- **transfer-orders.js** - Transfer order API endpoints
- **warehouse-machines.js** - Machine warehouse (status protection)
- **warehouseSims.js** - SIM warehouse (status protection)

### Testing
- **test_transfer_validations.js** - Comprehensive test suite

## 🛡️ Validation Rules

### Items Must Be:
✅ Present in source branch  
✅ NOT in any pending transfers  
✅ NOT in locked status (IN_TRANSIT, SOLD, ASSIGNED, UNDER_MAINTENANCE)  
✅ Valid serial numbers  

### Branches Must Be:
✅ Different (no same-branch transfers)  
✅ Both active and exist  
✅ Correct type for maintenance transfers (MAINTENANCE_CENTER)  

### ⚖️ The Binding Law (القانون الملزم)
Strict organizational rules for internal transfers:

1. **Branches to Admin Affairs (`BRANCH` → `ADMIN_AFFAIRS`)**:
   - Only Machines and SIM Cards allowed.
   - Purpose: Centralized management of core assets.

2. **Admin Affairs to Branches (`ADMIN_AFFAIRS` → `BRANCH`)**:
   - All item types allowed.
   - Purpose: Distribution of equipment and supplies.

3. **Branches to Maintenance Centers (`BRANCH` → `MAINTENANCE_CENTER`)**:
   - Only Machines allowed.
   - Constraint: Must be the **assigned** center for that branch.
   - Purpose: Repairs and overhauls.

4. **Branch to Branch (`BRANCH` → `BRANCH`)**:
   - All item types and spare parts allowed.
   - Constraint: Must be in the **same hierarchy** (Parent-Child relationship).
   - Purpose: Resource sharing between related business units.

### User Must Have:
✅ Permission to transfer from source branch  
✅ Valid authentication token  
✅ Appropriate role (SUPER_ADMIN can transfer from any branch)  

## 📊 Transfer Types

| Type | Description | From | To |
|------|-------------|------|-----|
| MACHINE | Regular machine transfer | Any branch | Any branch |
| SIM | SIM card transfer | Any branch | Any branch |
| MAINTENANCE | Send for maintenance | Branch | Maintenance Center |
| SEND_TO_CENTER | Explicit send to center | Branch | Maintenance Center |

## 🔒 Status Protection

### Cannot Manually Set:
❌ `IN_TRANSIT` - Only through transfer orders

### Auto-Set During Transfer:
⚡ Source items → `IN_TRANSIT`  
⚡ On receive (machines) → `NEW` or `RECEIVED_AT_CENTER`  
⚡ On receive (SIMs) → `ACTIVE`  

## 🚀 API Endpoints

### Create Transfer Order
```http
POST /api/transfer-orders
Authorization: Bearer <token>
Content-Type: application/json

{
  "fromBranchId": "branch-123",
  "toBranchId": "branch-456",
  "type": "MACHINE",
  "items": [
    {
      "serialNumber": "ABC123",
      "notes": "Optional notes"
    }
  ],
  "notes": "Transfer notes"
}
```

### Get Pending Serials
```http
GET /api/transfer-orders/pending-serials?branchId=xxx&type=MACHINE
Authorization: Bearer <token>
```

### Receive Transfer Order
```http
POST /api/transfer-orders/:id/receive
Authorization: Bearer <token>
Content-Type: application/json

{
  "receivedBy": "User ID",
  "receivedByName": "User Name",
  "receivedItems": ["item-id-1", "item-id-2"]
}
```

## 💡 Error Messages (Examples)

### Arabic Error Messages:
```
"الماكينات التالية موجودة في تحويلات معلقة:
ABC123 (إذن TO-20260101-001 من القاهرة إلى الإسكندرية)"

"الماكينات التالية غير متاحة للتحويل:
XYZ789 (الحالة: قيد النقل)"

"الماكينات التالية غير موجودة في الفرع المرسل:
DEF456 (موجود في الإسكندرية)"

"لا يمكن تغيير الحالة إلى 'قيد النقل' يدوياً. يجب إنشاء إذن تحويل."

"ليس لديك صلاحية التحويل من هذا الفرع"

"لا يمكن التحويل لنفس الفرع"
```

## 🔧 Developer Guide

### Using Validators Directly
```javascript
const { validateTransferOrder } = require('../utils/transfer-validators');

const validation = await validateTransferOrder({
    fromBranchId,
    toBranchId,
    type: 'MACHINE',
    items: [{serialNumber: 'ABC123'}]
}, user);

if (!validation.valid) {
    throw new Error(validation.errors.join('\n'));
}

// Warnings are non-blocking
if (validation.warnings.length > 0) {
    console.warn(validation.warnings.join('\n'));
}
```

### Adding New Transfer Types
1. Add type to schema
2. Update `validateBranches()` if needed
3. Update `validateItemsForTransfer()` for new item types
4. Add status transitions in `receiveTransferOrder()`
5. Update documentation

## 📅 Version History

### v3.1.0 (2026-01-01)
- ✨ Initial transfer validation system
- 🛡️ Comprehensive validators
- 🔒 Status change protection
- 📝 Complete documentation

## 🔗 Quick Links

- [Full Technical Report](../TRANSFER_PROTECTION_REPORT.md)
- [Coverage Analysis](../TRANSFER_VALIDATION_COVERAGE.md)
- [Services Reference](./SERVICES_REFERENCE.md#6-transferservicejs)
- [API Specification](./API_SPEC.md#2-transfer-orders-inter-branch)
- [Architecture](./ARCHITECTURE.md)
- [Changelog](./CHANGELOG.md)
