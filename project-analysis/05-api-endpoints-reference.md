# Smart Enterprise Suite - API Endpoints Reference

**Document Version:** 1.0  
**Last Updated:** 2026-01-30  
**Base URL:** `/api`  
**Authentication:** Bearer Token (JWT)

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Customers](#2-customers)
3. [Requests & Maintenance](#3-requests--maintenance)
4. [Warehouse](#4-warehouse)
5. [Inventory](#5-inventory)
6. [Transfers](#6-transfers)
7. [Sales & Payments](#7-sales--payments)
8. [Users & Permissions](#8-users--permissions)
9. [Reports & Dashboard](#9-reports--dashboard)
10. [System](#10-system)
11. [Additional Endpoints](#11-additional-endpoints)

---

## Authentication

**Base Path:** `/api/auth`

| Method | Path | Auth Required | Rate Limit | Description |
|--------|------|---------------|------------|-------------|
| POST | `/login` | No | None | User login with credentials |
| GET | `/profile` | Yes (Any) | None | Get current user profile |
| PUT | `/preferences` | Yes (Any) | None | Update user preferences |
| POST | `/change-password` | Yes (Any) | None | Change user password |

### Request/Response Examples

#### POST /api/auth/login
**Request Body:**
```json
{
  "identifier": "user@example.com",
  "password": "password123",
  "branchId": "optional-branch-id"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "displayName": "John Doe",
    "role": "CS_AGENT",
    "branchId": "branch-id"
  }
}
```

#### GET /api/auth/profile
**Response:**
```json
{
  "id": "user-id",
  "email": "user@example.com",
  "displayName": "John Doe",
  "role": "CS_AGENT",
  "branchId": "branch-id",
  "theme": "light",
  "fontFamily": "default"
}
```

---

## Customers

**Base Path:** `/api/customers`

| Method | Path | Auth Required | Rate Limit | Description |
|--------|------|---------------|------------|-------------|
| GET | `/` | Yes (Any) | None | List all customers with pagination |
| GET | `/lite` | Yes (Any) | None | Get lightweight customer list (dropdown) |
| GET | `/:id` | Yes (Any) | None | Get single customer details |
| POST | `/` | Yes (Any) | None | Create new customer |
| PUT | `/:id` | Yes (Any) | None | Update customer |
| DELETE | `/:id` | Yes (Manager+) | None | Delete customer |
| GET | `/template/download` | Yes (Any) | None | Download Excel import template |
| POST | `/import` | Yes (Any) | None | Import customers from Excel |
| GET | `/export` | Yes (Any) | None | Export customers to Excel |

### Request/Response Examples

#### GET /api/customers
**Query Parameters:**
- `search` (optional): Search by name, code, or phone
- `limit` (optional): Results per page (max 10000)
- `offset` (optional): Page offset

**Response:**
```json
{
  "data": [
    {
      "id": "customer-id",
      "client_name": "Customer Name",
      "bkcode": "BK001",
      "phone": "0123456789",
      "mobile": "01123456789",
      "address": "Address",
      "branchId": "branch-id",
      "posMachines": [...]
    }
  ],
  "pagination": {
    "total": 100,
    "limit": 50,
    "offset": 0,
    "pages": 2
  }
}
```

#### POST /api/customers
**Request Body:**
```json
{
  "client_name": "Customer Name",
  "bkcode": "BK001",
  "phone": "0123456789",
  "mobile": "01123456789",
  "address": "Customer Address",
  "branchId": "branch-id"
}
```

#### GET /api/customers/lite
**Query Parameters:**
- `search` (optional): Search term

**Response:**
```json
[
  {
    "id": "customer-id",
    "client_name": "Customer Name",
    "bkcode": "BK001",
    "branchId": "branch-id",
    "posMachines": [
      {
        "id": "machine-id",
        "serialNumber": "SN123456",
        "model": "Model X"
      }
    ]
  }
]
```

---

## Requests & Maintenance

**Base Paths:** `/api/requests`, `/api/maintenance`

### Maintenance Requests

| Method | Path | Auth Required | Rate Limit | Description |
|--------|------|---------------|------------|-------------|
| GET | `/requests` | Yes (Any) | None | List all maintenance requests |
| GET | `/requests/:id` | Yes (Any) | None | Get single request details |
| POST | `/requests` | Yes (Technician+) | createLimiter | Create new request |
| PUT | `/requests/:id` | Yes (Technician+) | updateLimiter | Update request |
| PUT | `/requests/:id/assign` | Yes (Technician+) | None | Assign technician |
| PUT | `/requests/:id/close` | Yes (Technician+) | None | Close request |
| GET | `/requests/stats` | Yes (Any) | None | Get request statistics |
| GET | `/requests/export` | Yes (Any) | None | Export requests to Excel |
| GET | `/requests/machine/:serial/monthly-count` | Yes (Any) | None | Get monthly repair count |

### Maintenance Workflow

| Method | Path | Auth Required | Description |
|--------|------|---------------|-------------|
| GET | `/maintenance/shipments` | Yes | Get incoming shipments |
| POST | `/maintenance/shipments/:id/receive` | Yes | Confirm shipment receipt |
| POST | `/maintenance/machine/:serial/transition` | Yes | Machine workflow transition |
| POST | `/maintenance/assignments` | Yes | Create service assignment |
| GET | `/maintenance/assignments` | Yes | Get assignments |
| POST | `/maintenance/approval-request` | Yes | Request approval |
| POST | `/maintenance/complete-direct` | Yes | Complete direct maintenance |
| POST | `/maintenance/complete-after-approval` | Yes | Complete after approval |
| POST | `/maintenance/approvals/:id/respond` | Yes | Approve/reject request |
| GET | `/maintenance/approval-requests` | Yes | Get approval requests |
| GET | `/maintenance/debts` | Yes | Get branch debts |
| POST | `/maintenance/debts/payment` | Yes | Record debt payment |
| GET | `/maintenance/tracking/export` | Yes | Export tracking to Excel |

### Request/Response Examples

#### POST /api/requests
**Request Body:**
```json
{
  "customerId": "customer-id",
  "machineId": "machine-id",
  "problemDescription": "Machine not turning on",
  "status": "Open",
  "takeMachine": false,
  "branchId": "branch-id"
}
```

#### PUT /api/requests/:id/close
**Request Body:**
```json
{
  "actionTaken": "Replaced power supply",
  "usedParts": [
    {
      "partId": "part-id",
      "name": "Power Supply",
      "quantity": 1,
      "cost": 150,
      "isPaid": true
    }
  ],
  "receiptNumber": "RCP001",
  "paymentPlace": "Office"
}
```

#### GET /api/requests/stats
**Response:**
```json
{
  "day": { "open": 5, "inProgress": 3, "closed": 10, "total": 18 },
  "week": { "open": 15, "inProgress": 8, "closed": 45, "total": 68 },
  "month": { "open": 45, "inProgress": 22, "closed": 150, "total": 217 }
}
```

---

## Warehouse

**Base Paths:** `/api/warehouse-machines`, `/api/warehouse-sims`

### Warehouse Machines

| Method | Path | Auth Required | Description |
|--------|------|---------------|-------------|
| GET | `/` | Yes | List warehouse machines |
| GET | `/counts` | Yes | Get machine counts by status |
| GET | `/duplicates` | Yes (Admin+) | Find duplicate serial numbers |
| GET | `/logs` | Yes | Get machine movement logs |
| GET | `/template` | Yes | Download import template |
| POST | `/import` | Yes | Import machines |
| GET | `/export` | Yes | Export machines to Excel |
| POST | `/bulk-transfer` | Yes | Bulk transfer to maintenance center |
| POST | `/return-to-branch` | Yes | Return machines from center |
| POST | `/` | Yes | Create machine |
| PUT | `/update-by-prefix` | Yes | Update machines by prefix |
| PUT | `/:id/receive-return` | Yes | Receive returned machine |
| PUT | `/:id` | Yes | Update machine status/notes |
| POST | `/exchange` | Yes | Exchange machine with customer |
| POST | `/return` | Yes | Return machine from customer |
| DELETE | `/:id` | Yes | Delete machine |
| POST | `/return-to-customer` | Yes | Return machine to customer |
| POST | `/repair-to-standby` | Yes | Mark defective as standby |
| GET | `/check-duplicates` | Yes | Check for duplicates |
| GET | `/check-all-duplicates` | Yes | Check all duplicates |

### Warehouse SIMs

| Method | Path | Auth Required | Description |
|--------|------|---------------|-------------|
| GET | `/` | Yes | List warehouse SIMs |
| GET | `/counts` | Yes | Get SIM counts |
| POST | `/` | Yes | Create SIM |
| PUT | `/:id` | Yes | Update SIM |
| DELETE | `/:id` | Yes | Delete SIM |
| POST | `/assign` | Yes | Assign SIM to customer |
| POST | `/exchange` | Yes | Exchange customer SIM |
| POST | `/return` | Yes | Return SIM from customer |
| GET | `/movements` | Yes | Get SIM movement history |
| GET | `/template` | Yes | Download template |
| POST | `/import` | Yes | Import SIMs from Excel |
| GET | `/export` | Yes | Export SIMs to Excel |
| POST | `/transfer` | Yes | Transfer SIMs to branch |

### Request/Response Examples

#### GET /api/warehouse-machines
**Query Parameters:**
- `status`: Filter by status (NEW, STANDBY, CLIENT_REPAIR, etc.)
- `q`: Search query
- `branchId`: Filter by branch (admin only)

**Response:**
```json
[
  {
    "id": "machine-id",
    "serialNumber": "SN123456",
    "model": "Model X",
    "manufacturer": "Manufacturer",
    "status": "STANDBY",
    "branchId": "branch-id",
    "notes": "Good condition"
  }
]
```

#### POST /api/warehouse-machines/exchange
**Request Body:**
```json
{
  "outgoingMachineId": "warehouse-machine-id",
  "customerId": "customer-bkcode",
  "incomingMachineId": "pos-machine-id",
  "incomingNotes": "Customer reported issues",
  "performedBy": "Technician Name"
}
```

---

## Inventory

**Base Path:** `/api/inventory`

| Method | Path | Auth Required | Description |
|--------|------|---------------|-------------|
| GET | `/inventory` | Yes | Get inventory (parts with quantities) |
| POST | `/inventory/stock-in` | Yes | Add stock (IN movement) |
| POST | `/inventory/import` | Yes | Bulk import stock |
| PUT | `/inventory/:partId` | Yes | Update inventory quantity |
| POST | `/inventory/stock-out` | Yes | Stock out (used in repair) |
| POST | `/inventory/transfer` | Yes | Transfer stock between branches |
| GET | `/inventory/movements` | Yes | Get stock movements log |

### Request/Response Examples

#### GET /api/inventory/inventory
**Response:**
```json
[
  {
    "partId": "part-id",
    "partNumber": "PN001",
    "name": "Power Supply",
    "quantity": 50,
    "minLevel": 10,
    "defaultCost": 150
  }
]
```

#### POST /api/inventory/stock-in
**Request Body:**
```json
{
  "partId": "part-id",
  "quantity": 10,
  "branchId": "branch-id"
}
```

---

## Transfers

**Base Path:** `/api/transfer-orders`

| Method | Path | Auth Required | Description |
|--------|------|---------------|-------------|
| GET | `/` | Yes | List transfer orders |
| GET | `/pending` | Yes | Get pending orders |
| GET | `/pending-serials` | Yes | Get serials in pending transfers |
| GET | `/stats/summary` | Yes | Get transfer statistics |
| GET | `/export-data` | Yes | Export to Excel |
| GET | `/template/:type` | Yes | Download template |
| GET | `/:id` | Yes | Get single order |
| POST | `/` | Yes | Create transfer order |
| POST | `/import` | Yes (with file) | Import from Excel |
| POST | `/:id/receive` | Yes | Receive order |
| POST | `/:id/reject` | Yes | Reject order |
| POST | `/:id/cancel` | Yes | Cancel order |

### Request/Response Examples

#### POST /api/transfer-orders
**Request Body:**
```json
{
  "type": "MACHINE",
  "fromBranchId": "source-branch",
  "toBranchId": "target-branch",
  "items": [
    {
      "serialNumber": "SN123456",
      "quantity": 1
    }
  ],
  "notes": "Transfer notes"
}
```

#### POST /api/transfer-orders/:id/receive
**Request Body:**
```json
{
  "receivedItems": [
    {
      "serialNumber": "SN123456",
      "accepted": true,
      "notes": "Good condition"
    }
  ]
}
```

---

## Sales & Payments

### Sales
**Base Path:** `/api/sales`

| Method | Path | Auth Required | Description |
|--------|------|---------------|-------------|
| GET | `/stats` | Yes | Get dashboard stats |
| GET | `/` | Yes | Get all sales |
| GET | `/installments` | Yes | Get installments |
| POST | `/` | Yes | Create sale |
| POST | `/installments/:id/pay` | Yes | Pay installment |
| PUT | `/:saleId/recalculate` | Yes | Recalculate installments |
| DELETE | `/:id` | Yes | Delete sale |
| GET | `/export` | Yes | Export to Excel |

### Payments
**Base Path:** `/api/payments`

| Method | Path | Auth Required | Description |
|--------|------|---------------|-------------|
| GET | `/check-receipt` | Yes | Check receipt number |
| GET | `/` | Yes | Get all payments |
| GET | `/customer/:customerId` | Yes | Get customer payments |
| GET | `/stats` | Yes | Get payment statistics |
| POST | `/` | Yes | Create payment |
| DELETE | `/:id` | Yes | Delete payment |
| GET | `/export` | Yes | Export to Excel |

### Request/Response Examples

#### POST /api/sales
**Request Body:**
```json
{
  "customerId": "customer-id",
  "serialNumber": "SN123456",
  "type": "CASH",
  "totalPrice": 5000,
  "paidAmount": 5000,
  "installmentCount": 0,
  "notes": "Sale notes",
  "receiptNumber": "RCP001"
}
```

#### POST /api/payments
**Request Body:**
```json
{
  "receiptNumber": "RCP001",
  "paymentPlace": "Office",
  "amount": 500,
  "customerId": "customer-bkcode",
  "reason": "Machine maintenance",
  "notes": "Payment notes"
}
```

---

## Users & Permissions

### Users
**Base Path:** `/api/users`

| Method | Path | Auth Required | Description |
|--------|------|---------------|-------------|
| GET | `/` | Yes (Admin+) | List all users |
| GET | `/:id` | Yes (Admin+) | Get single user |
| POST | `/` | Yes (Super Admin) | Create user |
| PUT | `/:id` | Yes (Super Admin) | Update user |
| DELETE | `/:id` | Yes (Super Admin) | Delete user |
| POST | `/:id/reset-password` | Yes (Super Admin) | Reset password |
| GET | `/meta/roles` | Yes | Get available roles |

### Permissions
**Base Path:** `/api/permissions`

| Method | Path | Auth Required | Description |
|--------|------|---------------|-------------|
| GET | `/` | Yes | Get all permissions |
| PUT | `/` | Yes (Admin+) | Update permission |
| POST | `/bulk` | Yes (Admin+) | Bulk update permissions |
| POST | `/reset` | Yes (Admin+) | Reset to defaults |
| GET | `/check` | Yes | Check specific permission |

### Request/Response Examples

#### POST /api/users
**Request Body:**
```json
{
  "email": "user@example.com",
  "displayName": "John Doe",
  "password": "password123",
  "role": "CS_AGENT",
  "branchId": "branch-id",
  "canDoMaintenance": true
}
```

#### GET /api/permissions
**Response:**
```json
{
  "pages": {
    "/requests": {
      "SUPER_ADMIN": true,
      "MANAGEMENT": true,
      "CS_AGENT": true
    }
  },
  "actions": {
    "CREATE_REQUEST": {
      "SUPER_ADMIN": true,
      "CS_AGENT": true
    }
  },
  "roles": ["SUPER_ADMIN", "MANAGEMENT", "CS_AGENT", ...]
}
```

---

## Reports & Dashboard

### Dashboard
**Base Path:** `/api/dashboard`

| Method | Path | Auth Required | Description |
|--------|------|---------------|-------------|
| GET | `/` | Yes | Get main dashboard KPIs |
| GET | `/admin-summary` | Yes (Super Admin) | Get admin summary |
| GET | `/search` | Yes | Global search |
| GET | `/metrics-reference` | Yes | Get metrics documentation |

### Executive Dashboard
**Base Path:** `/api/executive-dashboard`

| Method | Path | Auth Required | Description |
|--------|------|---------------|-------------|
| GET | `/` | Yes (Management+) | Get executive analytics |
| GET | `/branch/:branchId` | Yes (Management+) | Branch drill-down |

### Reports
**Base Path:** `/api/reports`

| Method | Path | Auth Required | Description |
|--------|------|---------------|-------------|
| GET | `/reports/inventory` | Yes | Current inventory report |
| GET | `/reports/movements` | Yes | Stock movements report |
| GET | `/reports/performance` | Yes | Technician performance |
| GET | `/reports/executive` | Yes | Executive analytics |
| GET | `/reports/governorate-performance` | Yes | Geographic analytics |
| GET | `/reports/inventory-movement` | Yes | Inventory time-series |
| GET | `/reports/pos-stock` | Yes | POS stock snapshot |
| GET | `/reports/pos-sales-monthly` | Yes | Monthly sales report |
| GET | `/reports/pos-sales-daily` | Yes | Daily sales report |

### Request/Response Examples

#### GET /api/dashboard
**Response:**
```json
{
  "revenue": {
    "monthly": 50000,
    "trend": [...]
  },
  "requests": {
    "open": 10,
    "inProgress": 5,
    "closed": 150
  },
  "inventory": {
    "totalMachines": 200,
    "totalSims": 500
  },
  "alerts": {
    "overdueInstallments": 3,
    "pendingTransfers": 5
  },
  "recentActivity": [...]
}
```

---

## System

### Settings
**Base Path:** `/api/settings`

| Method | Path | Auth Required | Description |
|--------|------|---------------|-------------|
| GET | `/branches-lookup` | Yes | Get branches lookup |
| GET | `/machine-parameters` | Yes | Get machine parameters |
| POST | `/machine-parameters` | Yes | Create parameter |
| DELETE | `/machine-parameters/:id` | Yes | Delete parameter |
| GET | `/settings/client-types` | Yes | Get client types |
| POST | `/settings/client-types` | Yes | Create client type |
| PUT | `/settings/client-types/:id` | Yes | Update client type |
| DELETE | `/settings/client-types/:id` | Yes | Delete client type |
| POST | `/force-update-models` | Yes | Update all machine models |

### Backup
**Base Path:** `/api/backup`

| Method | Path | Auth Required | Description |
|--------|------|---------------|-------------|
| POST | `/create` | Yes | Create manual backup |
| GET | `/list` | Yes | List all backups |
| POST | `/restore/:filename` | Yes | Restore from backup |
| DELETE | `/delete/:filename` | Yes | Delete backup |
| GET | `/logs` | Yes | Get backup activity logs |

### Branches
**Base Path:** `/api/branches`

| Method | Path | Auth Required | Description |
|--------|------|---------------|-------------|
| GET | `/` | Yes | List all branches |
| GET | `/active` | Yes | Get active branches |
| GET | `/:id` | Yes | Get single branch |
| POST | `/` | Yes | Create branch |
| PUT | `/:id` | Yes | Update branch |
| DELETE | `/:id` | Yes | Delete branch |
| GET | `/type/:type` | Yes | Get branches by type |
| GET | `/centers/with-branches` | Yes | Get centers with branches |
| GET | `/center/:centerId/branches` | Yes | Get branches by center |

### Request/Response Examples

#### POST /api/branches
**Request Body:**
```json
{
  "code": "BR001",
  "name": "Main Branch",
  "address": "123 Main St",
  "type": "BRANCH",
  "maintenanceCenterId": "center-id",
  "isActive": true
}
```

---

## Additional Endpoints

### Machines
**Base Path:** `/api/machines`

| Method | Path | Auth Required | Description |
|--------|------|---------------|-------------|
| GET | `/machines/template` | Yes | Download import template |
| POST | `/machines/import` | Yes | Import machines |
| GET | `/machines/export` | Yes | Export machines |
| GET | `/machines` | Yes | List all machines |
| POST | `/machines/apply-parameters` | Yes | Apply parameters |

### Technicians
**Base Path:** `/api/technicians`

| Method | Path | Auth Required | Description |
|--------|------|---------------|-------------|
| GET | `/` | Yes | Get maintenance-capable users |

### Notifications
**Base Path:** `/api/notifications`

| Method | Path | Auth Required | Description |
|--------|------|---------------|-------------|
| GET | `/` | Yes | Get notifications |
| GET | `/count` | Yes | Get unread count |
| PUT | `/:id/read` | Yes | Mark as read |
| PUT | `/read-all` | Yes | Mark all as read |
| DELETE | `/:id` | Yes | Delete notification |

### Audit Logs
**Base Path:** `/api/audit-logs`

| Method | Path | Auth Required | Description |
|--------|------|---------------|-------------|
| GET | `/` | Yes | Get unified audit logs |

### Admin
**Base Path:** `/api/admin`

| Method | Path | Auth Required | Description |
|--------|------|---------------|-------------|
| GET | `/audit-logs` | Yes (Super Admin) | Get system audit logs |
| GET | `/audit-logs/:id` | Yes (Super Admin) | Get specific log |
| DELETE | `/audit-logs/older-than/:days` | Yes (Super Admin) | Delete old logs |
| GET | `/settings` | Yes (Admin) | Get system settings |
| PUT | `/settings` | Yes (Super Admin) | Update settings |
| GET | `/system/status` | Yes (Admin) | Get system status |
| GET | `/system/logs/recent` | Yes (Admin) | Get recent logs |
| GET | `/branches` | Yes (Super Admin) | Get all branches |
| POST | `/branches` | Yes (Super Admin) | Create branch |
| PUT | `/branches/:id` | Yes (Super Admin) | Update branch |

### Approvals
**Base Path:** `/api/approvals`

| Method | Path | Auth Required | Description |
|--------|------|---------------|-------------|
| GET | `/request/:requestId` | Yes | Get approval by request |
| POST | `/` | Yes | Create approval request |
| PUT | `/:id/respond` | Yes | Respond to approval |

---

## Error Responses

All endpoints may return the following error responses:

### 400 Bad Request
```json
{
  "error": "Invalid request data",
  "details": "Specific error message"
}
```

### 401 Unauthorized
```json
{
  "error": "Authentication required"
}
```

### 403 Forbidden
```json
{
  "error": "Access denied",
  "code": "FORBIDDEN"
}
```

### 404 Not Found
```json
{
  "error": "Resource not found",
  "code": "NOT_FOUND"
}
```

### 409 Conflict
```json
{
  "error": "Resource conflict",
  "code": "DUPLICATE"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error"
}
```

---

## Authentication & Authorization

### JWT Token
All protected endpoints require a Bearer token in the Authorization header:

```
Authorization: Bearer <jwt-token>
```

### User Roles
- `SUPER_ADMIN`: Full system access
- `MANAGEMENT`: Management access
- `CENTER_MANAGER`: Maintenance center manager
- `CENTER_TECH`: Maintenance center technician
- `BRANCH_MANAGER`: Branch manager
- `BRANCH_TECH`: Branch technician
- `CS_SUPERVISOR`: Customer service supervisor
- `CS_AGENT`: Customer service agent
- `ADMIN_AFFAIRS`: Administrative affairs

### Rate Limits
- `createLimiter`: Applied to POST operations (configurable)
- `updateLimiter`: Applied to PUT operations (configurable)
- `deleteLimiter`: Applied to DELETE operations (configurable)

---

## Data Types & Schemas

### Common Enums

**Request Status:**
- `Open`, `In Progress`, `Closed`, `PENDING_TRANSFER`, `AT_CENTER`

**Machine Status:**
- `NEW`, `STANDBY`, `CLIENT_REPAIR`, `AT_CENTER`, `EXTERNAL_REPAIR`, `DEFECTIVE`, `SOLD`, `IN_TRANSIT`, `RETURNING`, `COMPLETED`, `READY_FOR_RETURN`

**SIM Status:**
- `ACTIVE`, `DEFECTIVE`, `IN_TRANSIT`

**Transfer Order Status:**
- `PENDING`, `APPROVED`, `REJECTED`, `COMPLETED`, `CANCELLED`

**Payment Types:**
- `INSTALLMENT`, `MACHINE_SALE`, `SIM_PURCHASE`, `SIM_EXCHANGE`, `MAINTENANCE`, `MANUAL`

**Branch Types:**
- `BRANCH`, `MAINTENANCE_CENTER`

---

## Notes

1. All endpoints use branch-based filtering unless user has SUPER_ADMIN or MANAGEMENT role
2. Dates should be provided in ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ)
3. File uploads use multipart/form-data with field name 'file'
4. Export endpoints return Excel files (.xlsx)
5. Template endpoints return downloadable Excel templates

---

*This document is auto-generated from the backend route files. For the most up-to-date information, refer to the source code in `backend/routes/`.*
