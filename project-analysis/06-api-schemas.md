# Smart Enterprise Suite - API Request/Response Schemas

**Version:** 1.0  
**Last Updated:** 2026-01-30  
**Base URL:** `/api`

---

## Table of Contents

1. [Authentication](#authentication)
2. [Customers](#customers)
3. [Maintenance Requests](#maintenance-requests)
4. [Transfer Orders](#transfer-orders)
5. [Sales](#sales)

---

## Authentication

### POST /auth/login

Authenticate a user and receive a JWT token.

#### Request Schema

| Field | Type | Required | Validation | Description | Example |
|-------|------|----------|------------|-------------|---------|
| `identifier` | string | Yes | Min 1 char | User email or UID | `user@example.com` or `emp001` |
| `password` | string | Yes | Min 1 char | User password | `password123` |
| `branchId` | string | No | CUID format | Optional branch selection | `cm5z7abcd1234efgh5678ijkl` |

#### Request Example
```json
{
  "identifier": "user@example.com",
  "password": "password123",
  "branchId": "cm5z7abcd1234efgh5678ijkl"
}
```

#### Response Schema (200 OK)

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `token` | string | JWT access token (24h expiry) | `eyJhbGciOiJIUzI1NiIs...` |
| `user` | object | Authenticated user details | See below |
| `user.id` | string | User CUID | `cm5z7abcd1234efgh5678ijkl` |
| `user.email` | string | User email | `user@example.com` |
| `user.displayName` | string | User display name | `John Doe` |
| `user.role` | string | User role enum | `TECHNICIAN` |
| `user.name` | string | Alias for displayName | `John Doe` |
| `user.branchId` | string | Assigned branch CUID | `cm5z7abcd1234efgh5678ijkl` |
| `user.branchType` | string | Branch type | `BRANCH` |
| `user.theme` | string | UI theme preference | `light` |
| `user.fontFamily` | string | Font preference | `default` |

#### Response Example (200 OK)
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "cm5z7abcd1234efgh5678ijkl",
    "email": "user@example.com",
    "displayName": "John Doe",
    "role": "TECHNICIAN",
    "name": "John Doe",
    "branchId": "cm5z7efgh1234ijkl5678mnop",
    "branchType": "BRANCH",
    "theme": "light",
    "fontFamily": "default"
  }
}
```

#### Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 401 | INVALID_CREDENTIALS | المستخدم غير موجود / Invalid credentials |
| 500 | JWT_NOT_CONFIGURED | JWT secret not configured |

---

### GET /auth/profile

Get the authenticated user's profile.

**Authentication:** Bearer token required

#### Response Schema (200 OK)

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `id` | string | User CUID | `cm5z7abcd1234efgh5678ijkl` |
| `email` | string | User email | `user@example.com` |
| `displayName` | string | User display name | `John Doe` |
| `role` | string | User role | `TECHNICIAN` |
| `branchId` | string | Branch CUID | `cm5z7efgh1234ijkl5678mnop` |
| `branchType` | string | Branch type | `BRANCH` |
| `theme` | string | UI theme | `light` |
| `fontFamily` | string | Font preference | `default` |

#### Response Example
```json
{
  "id": "cm5z7abcd1234efgh5678ijkl",
  "email": "user@example.com",
  "displayName": "John Doe",
  "role": "TECHNICIAN",
  "branchId": "cm5z7efgh1234ijkl5678mnop",
  "branchType": "BRANCH",
  "theme": "light",
  "fontFamily": "default"
}
```

---

## Customers

### POST /customers

Create a new customer.

**Authentication:** Bearer token required  
**Permissions:** Any authenticated user

#### Request Schema

| Field | Type | Required | Validation | Description | Example |
|-------|------|----------|------------|-------------|---------|
| `client_name` | string | Yes | Min 2 chars | Customer full name | `Ahmed Hassan` |
| `bkcode` | string | Yes | Min 1 char | Unique customer code | `CUST001` |
| `phone` | string | No | - | Phone number | `+20 123 456 7890` |
| `mobile` | string | No | - | Mobile number | `+20 100 123 4567` |
| `address` | string | No | - | Customer address | `123 Main St, Cairo` |
| `branchId` | string | No | CUID format | Branch ID (admin only) | `cm5z7abcd1234efgh5678ijkl` |

#### Request Example
```json
{
  "client_name": "Ahmed Hassan",
  "bkcode": "CUST001",
  "phone": "+20 123 456 7890",
  "mobile": "+20 100 123 4567",
  "address": "123 Main St, Cairo",
  "branchId": "cm5z7abcd1234efgh5678ijkl"
}
```

#### Response Schema (201 Created)

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `id` | string | Customer CUID | `cm5z7abcd1234efgh5678ijkl` |
| `client_name` | string | Customer name | `Ahmed Hassan` |
| `bkcode` | string | Customer code | `CUST001` |
| `phone` | string | Phone number | `+20 123 456 7890` |
| `mobile` | string | Mobile number | `+20 100 123 4567` |
| `address` | string | Address | `123 Main St, Cairo` |
| `branchId` | string | Branch CUID | `cm5z7abcd1234efgh5678ijkl` |
| `createdAt` | string | ISO timestamp | `2026-01-30T10:00:00.000Z` |
| `updatedAt` | string | ISO timestamp | `2026-01-30T10:00:00.000Z` |

#### Response Example
```json
{
  "id": "cm5z7abcd1234efgh5678ijkl",
  "client_name": "Ahmed Hassan",
  "bkcode": "CUST001",
  "phone": "+20 123 456 7890",
  "mobile": "+20 100 123 4567",
  "address": "123 Main St, Cairo",
  "branchId": "cm5z7efgh1234ijkl5678mnop",
  "createdAt": "2026-01-30T10:00:00.000Z",
  "updatedAt": "2026-01-30T10:00:00.000Z"
}
```

#### Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 400 | MISSING_BRANCH | Branch ID is required |
| 409 | DUPLICATE_CODE | Customer code already exists in this branch |

---

### PUT /customers/:id

Update an existing customer.

**Authentication:** Bearer token required  
**Permissions:** Any authenticated user within same branch

#### URL Parameters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `id` | string | Customer CUID | `cm5z7abcd1234efgh5678ijkl` |

#### Request Schema

| Field | Type | Required | Validation | Description | Example |
|-------|------|----------|------------|-------------|---------|
| `client_name` | string | No | Min 2 chars | Customer full name | `Ahmed Hassan Updated` |
| `bkcode` | string | No | Min 1 char | Unique customer code | `CUST001` |
| `phone` | string | No | - | Phone number | `+20 123 456 7890` |
| `mobile` | string | No | - | Mobile number | `+20 100 123 4567` |
| `address` | string | No | - | Customer address | `456 New St, Cairo` |
| `branchId` | string | No | CUID format | Branch ID (super admin only) | `cm5z7abcd1234efgh5678ijkl` |

#### Request Example
```json
{
  "client_name": "Ahmed Hassan Updated",
  "address": "456 New St, Cairo",
  "phone": "+20 123 456 7891"
}
```

#### Response Schema (200 OK)

Same as POST response with updated values.

#### Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 404 | NOT_FOUND | Customer not found |
| 403 | FORBIDDEN | Access denied (different branch) |

---

## Maintenance Requests

### POST /requests

Create a new maintenance request.

**Authentication:** Bearer token required  
**Permissions:** TECHNICIAN, MANAGER, or higher  
**Rate Limit:** Create limiter applied

#### Request Schema

| Field | Type | Required | Validation | Description | Example |
|-------|------|----------|------------|-------------|---------|
| `customerId` | string | Yes | Min 1 char | Customer CUID or code | `cm5z7abcd1234efgh5678ijkl` |
| `machineId` | string | No | CUID format | Machine CUID | `cm5z7efgh1234ijkl5678mnop` |
| `problemDescription` | string | Yes | Min 5 chars | Problem/complaint description | `Machine not printing receipts` |
| `status` | string | No | Enum: `Open`, `In Progress` | Initial status | `Open` |
| `takeMachine` | boolean | No | - | Whether to take machine | `false` |
| `branchId` | string | No | CUID format | Branch ID (if user has no branch) | `cm5z7abcd1234efgh5678ijkl` |

#### Request Example
```json
{
  "customerId": "cm5z7abcd1234efgh5678ijkl",
  "machineId": "cm5z7efgh1234ijkl5678mnop",
  "problemDescription": "Machine not printing receipts. Display shows error code E01.",
  "status": "Open",
  "takeMachine": false,
  "branchId": "cm5z7qrst1234uvwx5678yzab"
}
```

#### Response Schema (201 Created)

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `id` | string | Request CUID | `cm5z7abcd1234efgh5678ijkl` |
| `customerId` | string | Customer CUID | `cm5z7efgh1234ijkl5678mnop` |
| `customerName` | string | Customer name | `Ahmed Hassan` |
| `posMachineId` | string | Machine CUID | `cm5z7qrst1234uvwx5678yzab` |
| `serialNumber` | string | Machine serial | `SN123456789` |
| `complaint` | string | Problem description | `Machine not printing receipts...` |
| `status` | string | Request status | `Open` |
| `branchId` | string | Branch CUID | `cm5z7abcd1234efgh5678ijkl` |
| `createdAt` | string | ISO timestamp | `2026-01-30T10:00:00.000Z` |
| `updatedAt` | string | ISO timestamp | `2026-01-30T10:00:00.000Z` |

#### Response Example
```json
{
  "id": "cm5z7abcd1234efgh5678ijkl",
  "customerId": "cm5z7efgh1234ijkl5678mnop",
  "customerName": "Ahmed Hassan",
  "posMachineId": "cm5z7qrst1234uvwx5678yzab",
  "serialNumber": "SN123456789",
  "complaint": "Machine not printing receipts. Display shows error code E01.",
  "status": "Open",
  "branchId": "cm5z7mnop1234qrst5678uvwx",
  "createdAt": "2026-01-30T10:00:00.000Z",
  "updatedAt": "2026-01-30T10:00:00.000Z"
}
```

#### Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 400 | MISSING_BRANCH | Branch ID is required |
| 403 | FORBIDDEN | Insufficient permissions |
| 429 | RATE_LIMITED | Too many requests |

---

### PUT /requests/:id/close

Close a maintenance request.

**Authentication:** Bearer token required  
**Permissions:** TECHNICIAN, MANAGER, or higher  
**Rate Limit:** Update limiter applied

#### URL Parameters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `id` | string | Request CUID | `cm5z7abcd1234efgh5678ijkl` |

#### Request Schema

| Field | Type | Required | Validation | Description | Example |
|-------|------|----------|------------|-------------|---------|
| `actionTaken` | string | No | - | Actions performed to resolve | `Replaced thermal printer head` |
| `usedParts` | array | No | See Part schema | Parts used in repair | `[]` |
| `usedParts[].partId` | string | Yes | CUID format | Part CUID | `cm5z7abcd1234efgh5678ijkl` |
| `usedParts[].name` | string | Yes | Min 1 char | Part name | `Thermal Printer Head` |
| `usedParts[].quantity` | number | Yes | Positive integer | Quantity used | `1` |
| `usedParts[].cost` | number | Yes | Non-negative | Part cost | `150.00` |
| `usedParts[].isPaid` | boolean | Yes | - | Whether customer paid | `true` |
| `receiptNumber` | string | No | - | Payment receipt number | `RCP-001` |
| `paymentPlace` | string | No | - | Payment location/method | `Warehouse` |

#### Request Example
```json
{
  "actionTaken": "Replaced thermal printer head and cleaned rollers",
  "usedParts": [
    {
      "partId": "cm5z7abcd1234efgh5678ijkl",
      "name": "Thermal Printer Head",
      "quantity": 1,
      "cost": 150.00,
      "isPaid": true
    }
  ],
  "receiptNumber": "RCP-2026-001",
  "paymentPlace": "Warehouse"
}
```

#### Response Schema (200 OK)

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `id` | string | Request CUID | `cm5z7abcd1234efgh5678ijkl` |
| `status` | string | Updated status | `Closed` |
| `actionTaken` | string | Actions performed | `Replaced thermal printer head...` |
| `closedAt` | string | ISO timestamp | `2026-01-30T12:00:00.000Z` |
| `closedBy` | string | User name | `John Doe` |
| `usedParts` | array | Parts consumed | See request schema |
| `receiptNumber` | string | Receipt number | `RCP-2026-001` |
| `paymentPlace` | string | Payment location | `Warehouse` |

#### Response Example
```json
{
  "id": "cm5z7abcd1234efgh5678ijkl",
  "status": "Closed",
  "actionTaken": "Replaced thermal printer head and cleaned rollers",
  "closedAt": "2026-01-30T12:00:00.000Z",
  "closedBy": "John Doe",
  "usedParts": [
    {
      "partId": "cm5z7abcd1234efgh5678ijkl",
      "name": "Thermal Printer Head",
      "quantity": 1,
      "cost": 150.00,
      "isPaid": true
    }
  ],
  "receiptNumber": "RCP-2026-001",
  "paymentPlace": "Warehouse"
}
```

#### Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 400 | REQUEST_ALREADY_CLOSED | Request is already closed |
| 403 | FORBIDDEN | Access denied (different branch) |
| 404 | NOT_FOUND | Request not found |

---

## Transfer Orders

### POST /transfer-orders

Create a new transfer order for machines, SIMs, or spare parts.

**Authentication:** Bearer token required  
**Permissions:** Any authenticated user

#### Request Schema

| Field | Type | Required | Validation | Description | Example |
|-------|------|----------|------------|-------------|---------|
| `type` | string | Yes | Enum: `MACHINE`, `SIM`, `SPARE_PART` | Transfer type | `MACHINE` |
| `fromBranchId` | string | No | CUID format | Source branch (defaults to user branch) | `cm5z7abcd1234efgh5678ijkl` |
| `toBranchId` | string | Yes | CUID format | Destination branch | `cm5z7efgh1234ijkl5678mnop` |
| `items` | array | Yes | Min 1 item | Items to transfer | See Item schema |
| `items[].serialNumber` | string | No | Min 1 char | Serial number (Machine/SIM) | `SN123456789` |
| `items[].partId` | string | No | Min 1 char | Part ID (Spare Parts) | `PART-001` |
| `items[].quantity` | number | No | Positive integer | Quantity (default: 1) | `1` |
| `notes` | string | No | - | Transfer notes | `Urgent transfer for maintenance` |

#### Request Example (Machine Transfer)
```json
{
  "type": "MACHINE",
  "fromBranchId": "cm5z7abcd1234efgh5678ijkl",
  "toBranchId": "cm5z7efgh1234ijkl5678mnop",
  "items": [
    {
      "serialNumber": "SN123456789",
      "quantity": 1
    },
    {
      "serialNumber": "SN987654321",
      "quantity": 1
    }
  ],
  "notes": "Transfer for urgent maintenance"
}
```

#### Request Example (SIM Transfer)
```json
{
  "type": "SIM",
  "toBranchId": "cm5z7efgh1234ijkl5678mnop",
  "items": [
    {
      "serialNumber": "SIM-001-ABC",
      "quantity": 1
    }
  ],
  "notes": "New SIM activation"
}
```

#### Response Schema (201 Created)

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `id` | string | Order CUID | `cm5z7abcd1234efgh5678ijkl` |
| `orderNumber` | string | Generated order number | `TO-20260130-001` |
| `type` | string | Transfer type | `MACHINE` |
| `status` | string | Order status | `PENDING` |
| `fromBranchId` | string | Source branch CUID | `cm5z7abcd1234efgh5678ijkl` |
| `toBranchId` | string | Destination branch CUID | `cm5z7efgh1234ijkl5678mnop` |
| `branchId` | string | Ownership branch CUID | `cm5z7efgh1234ijkl5678mnop` |
| `createdBy` | string | Creator user ID | `cm5z7qrst1234uvwx5678yzab` |
| `createdByName` | string | Creator name | `John Doe` |
| `notes` | string | Transfer notes | `Transfer for urgent maintenance` |
| `items` | array | Transfer items | See below |
| `items[].id` | string | Item CUID | `cm5z7abcd1234efgh5678ijkl` |
| `items[].serialNumber` | string | Serial number | `SN123456789` |
| `items[].type` | string | Item type | `MACHINE` |
| `items[].model` | string | Machine model | `PAX A920` |
| `items[].manufacturer` | string | Manufacturer | `PAX` |
| `items[].isReceived` | boolean | Receipt status | `false` |
| `items[].notes` | string | Item notes | `null` |
| `fromBranch` | object | Source branch details | `{ id, name }` |
| `toBranch` | object | Destination branch details | `{ id, name }` |
| `createdAt` | string | ISO timestamp | `2026-01-30T10:00:00.000Z` |

#### Response Example
```json
{
  "id": "cm5z7abcd1234efgh5678ijkl",
  "orderNumber": "TO-20260130-001",
  "type": "MACHINE",
  "status": "PENDING",
  "fromBranchId": "cm5z7abcd1234efgh5678ijkl",
  "toBranchId": "cm5z7efgh1234ijkl5678mnop",
  "branchId": "cm5z7efgh1234ijkl5678mnop",
  "createdBy": "cm5z7qrst1234uvwx5678yzab",
  "createdByName": "John Doe",
  "notes": "Transfer for urgent maintenance",
  "items": [
    {
      "id": "cm5z7aaaa1234bbbb5678cccc",
      "serialNumber": "SN123456789",
      "type": "MACHINE",
      "model": "PAX A920",
      "manufacturer": "PAX",
      "isReceived": false,
      "notes": null
    },
    {
      "id": "cm5z7dddd1234eeee5678ffff",
      "serialNumber": "SN987654321",
      "type": "MACHINE",
      "model": "Verifone VX520",
      "manufacturer": "Verifone",
      "isReceived": false,
      "notes": null
    }
  ],
  "fromBranch": {
    "id": "cm5z7abcd1234efgh5678ijkl",
    "name": "Main Branch"
  },
  "toBranch": {
    "id": "cm5z7efgh1234ijkl5678mnop",
    "name": "Maintenance Center"
  },
  "createdAt": "2026-01-30T10:00:00.000Z"
}
```

#### Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 400 | VALIDATION_ERROR | Validation failed with specific errors |
| 403 | FORBIDDEN | Access denied |

---

### POST /transfer-orders/:id/receive

Confirm receipt of a transfer order.

**Authentication:** Bearer token required  
**Permissions:** Any authenticated user at destination branch

#### URL Parameters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `id` | string | Order CUID | `cm5z7abcd1234efgh5678ijkl` |

#### Request Schema

| Field | Type | Required | Validation | Description | Example |
|-------|------|----------|------------|-------------|---------|
| `receivedItems` | array | No | See schema | Items being received (default: all) | `[]` |
| `receivedItems[].serialNumber` | string | No | - | Serial number | `SN123456789` |
| `receivedItems[].partId` | string | No | - | Part ID | `PART-001` |
| `receivedItems[].accepted` | boolean | Yes | - | Whether item accepted | `true` |
| `receivedItems[].notes` | string | No | - | Receipt notes | `Good condition` |

#### Request Example
```json
{
  "receivedItems": [
    {
      "serialNumber": "SN123456789",
      "accepted": true,
      "notes": "Received in good condition"
    },
    {
      "serialNumber": "SN987654321",
      "accepted": false,
      "notes": "Damaged during transport"
    }
  ]
}
```

#### Response Schema (200 OK)

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `id` | string | Order CUID | `cm5z7abcd1234efgh5678ijkl` |
| `orderNumber` | string | Order number | `TO-20260130-001` |
| `status` | string | Updated status | `RECEIVED` or `PARTIAL` |
| `receivedBy` | string | Receiving user ID | `cm5z7qrst1234uvwx5678yzab` |
| `receivedByName` | string | Receiver name | `Jane Smith` |
| `receivedAt` | string | ISO timestamp | `2026-01-30T14:00:00.000Z` |
| `items` | array | Updated items | See below |
| `items[].id` | string | Item CUID | `cm5z7aaaa1234bbbb5678cccc` |
| `items[].serialNumber` | string | Serial number | `SN123456789` |
| `items[].isReceived` | boolean | Receipt status | `true` |
| `items[].receivedAt` | string | ISO timestamp | `2026-01-30T14:00:00.000Z` |

#### Response Example
```json
{
  "id": "cm5z7abcd1234efgh5678ijkl",
  "orderNumber": "TO-20260130-001",
  "status": "PARTIAL",
  "receivedBy": "cm5z7qrst1234uvwx5678yzab",
  "receivedByName": "Jane Smith",
  "receivedAt": "2026-01-30T14:00:00.000Z",
  "items": [
    {
      "id": "cm5z7aaaa1234bbbb5678cccc",
      "serialNumber": "SN123456789",
      "isReceived": true,
      "receivedAt": "2026-01-30T14:00:00.000Z"
    },
    {
      "id": "cm5z7dddd1234eeee5678ffff",
      "serialNumber": "SN987654321",
      "isReceived": false,
      "receivedAt": null
    }
  ],
  "fromBranch": {
    "id": "cm5z7abcd1234efgh5678ijkl",
    "name": "Main Branch"
  },
  "toBranch": {
    "id": "cm5z7efgh1234ijkl5678mnop",
    "name": "Maintenance Center"
  }
}
```

#### Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 400 | NOT_PENDING | Order is not in pending status |
| 403 | FORBIDDEN | Access denied |
| 404 | NOT_FOUND | Order not found |

---

## Sales

### POST /sales

Create a new machine sale (cash or installment).

**Authentication:** Bearer token required  
**Permissions:** Any authenticated user

#### Request Schema

| Field | Type | Required | Validation | Description | Example |
|-------|------|----------|------------|-------------|---------|
| `customerId` | string | Yes | Min 1 char | Customer CUID or bkcode | `CUST001` |
| `serialNumber` | string | Yes | Min 1 char | Machine serial number | `SN123456789` |
| `type` | string | Yes | Enum: `CASH`, `INSTALLMENT` | Sale type | `INSTALLMENT` |
| `totalPrice` | number | Yes | Non-negative | Total sale price | `5000.00` |
| `paidAmount` | number | Yes | Non-negative | Initial payment | `1000.00` |
| `installmentCount` | number | No | Non-negative integer | Number of installments (for INSTALLMENT type) | `10` |
| `notes` | string | No | - | Sale notes | `First sale of the month` |
| `paymentMethod` | string | No | - | Payment method | `CASH` |
| `paymentPlace` | string | No | - | Payment location | `Warehouse` |
| `receiptNumber` | string | No | - | Receipt number (required if paidAmount > 0) | `RCP-2026-001` |
| `branchId` | string | No | CUID format | Branch ID (defaults to user branch) | `cm5z7abcd1234efgh5678ijkl` |
| `performedBy` | string | No | - | Person performing sale | `John Doe` |

#### Request Example (Installment Sale)
```json
{
  "customerId": "CUST001",
  "serialNumber": "SN123456789",
  "type": "INSTALLMENT",
  "totalPrice": 5000.00,
  "paidAmount": 1000.00,
  "installmentCount": 10,
  "notes": "Customer requested 10-month installment plan",
  "paymentMethod": "CASH",
  "paymentPlace": "Warehouse",
  "receiptNumber": "RCP-2026-001",
  "performedBy": "John Doe"
}
```

#### Request Example (Cash Sale)
```json
{
  "customerId": "CUST002",
  "serialNumber": "SN987654321",
  "type": "CASH",
  "totalPrice": 4500.00,
  "paidAmount": 4500.00,
  "notes": "Full payment upfront",
  "paymentMethod": "CASH",
  "paymentPlace": "Main Office",
  "receiptNumber": "RCP-2026-002",
  "performedBy": "Jane Smith"
}
```

#### Response Schema (200 OK)

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `id` | string | Sale CUID | `cm5z7abcd1234efgh5678ijkl` |
| `serialNumber` | string | Machine serial | `SN123456789` |
| `customerId` | string | Customer CUID | `cm5z7efgh1234ijkl5678mnop` |
| `type` | string | Sale type | `INSTALLMENT` |
| `totalPrice` | number | Total price | `5000.00` |
| `paidAmount` | number | Amount paid | `1000.00` |
| `status` | string | Sale status | `ONGOING` or `COMPLETED` |
| `notes` | string | Sale notes | `Customer requested 10-month...` |
| `branchId` | string | Branch CUID | `cm5z7abcd1234efgh5678ijkl` |
| `saleDate` | string | ISO timestamp | `2026-01-30T10:00:00.000Z` |
| `model` | string | Machine model | `PAX A920` |
| `manufacturer` | string | Manufacturer | `PAX` |
| `paymentMethod` | string | Payment method | `Warehouse` |
| `receiptNumber` | string | Receipt number | `RCP-2026-001` |
| `customer` | object | Customer details | See Customer schema |
| `installments` | array | Generated installments (INSTALLMENT type) | See below |
| `installments[].id` | string | Installment CUID | `cm5z7aaaa1234bbbb5678cccc` |
| `installments[].amount` | number | Installment amount | `400.00` |
| `installments[].dueDate` | string | Due date | `2026-02-28T00:00:00.000Z` |
| `installments[].isPaid` | boolean | Payment status | `false` |
| `installments[].description` | string | Installment description | `القسط رقم 1 من 10` |

#### Response Example
```json
{
  "id": "cm5z7abcd1234efgh5678ijkl",
  "serialNumber": "SN123456789",
  "customerId": "cm5z7efgh1234ijkl5678mnop",
  "type": "INSTALLMENT",
  "totalPrice": 5000.00,
  "paidAmount": 1000.00,
  "status": "ONGOING",
  "notes": "Customer requested 10-month installment plan",
  "branchId": "cm5z7abcd1234efgh5678ijkl",
  "saleDate": "2026-01-30T10:00:00.000Z",
  "model": "PAX A920",
  "manufacturer": "PAX",
  "paymentMethod": "Warehouse",
  "receiptNumber": "RCP-2026-001",
  "customer": {
    "id": "cm5z7efgh1234ijkl5678mnop",
    "client_name": "Ahmed Hassan",
    "bkcode": "CUST001",
    "phone": "+20 123 456 7890",
    "mobile": "+20 100 123 4567",
    "address": "123 Main St, Cairo"
  },
  "installments": [
    {
      "id": "cm5z7aaaa1234bbbb5678cccc",
      "amount": 400.00,
      "dueDate": "2026-02-28T00:00:00.000Z",
      "isPaid": false,
      "description": "القسط رقم 1 من 10"
    },
    {
      "id": "cm5z7dddd1234eeee5678ffff",
      "amount": 400.00,
      "dueDate": "2026-03-28T00:00:00.000Z",
      "isPaid": false,
      "description": "القسط رقم 2 من 10"
    }
  ]
}
```

#### Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 400 | MISSING_PAYMENT_PLACE | يجب اختيار مكان الدفع (Payment place required) |
| 400 | MISSING_RECEIPT | يجب إدخال رقم الإيصال (Receipt number required) |
| 400 | DUPLICATE_RECEIPT | Receipt number already exists |
| 400 | MACHINE_SOLD | Machine is already sold |
| 403 | ACCESS_DENIED | Access denied to machine/customer |
| 404 | MACHINE_NOT_FOUND | Machine not found |
| 404 | CUSTOMER_NOT_FOUND | Customer not found |

---

### POST /sales/:id/installments/:installmentId/pay

Pay a specific installment.

**Authentication:** Bearer token required  
**Permissions:** Any authenticated user

#### URL Parameters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `id` | string | Sale CUID | `cm5z7abcd1234efgh5678ijkl` |
| `installmentId` | string | Installment CUID | `cm5z7aaaa1234bbbb5678cccc` |

#### Request Schema

| Field | Type | Required | Validation | Description | Example |
|-------|------|----------|------------|-------------|---------|
| `amount` | number | Yes | Positive | Payment amount | `400.00` |
| `notes` | string | No | - | Payment notes | `Monthly installment payment` |
| `receiptNumber` | string | No | - | Receipt number | `RCP-2026-003` |

#### Request Example
```json
{
  "amount": 400.00,
  "notes": "January 2026 installment",
  "receiptNumber": "RCP-2026-003"
}
```

#### Response Schema (200 OK)

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `id` | string | Installment CUID | `cm5z7aaaa1234bbbb5678cccc` |
| `saleId` | string | Sale CUID | `cm5z7abcd1234efgh5678ijkl` |
| `amount` | number | Installment amount | `400.00` |
| `paidAmount` | number | Amount paid | `400.00` |
| `isPaid` | boolean | Payment status | `true` |
| `paidAt` | string | ISO timestamp | `2026-01-30T14:00:00.000Z` |
| `receiptNumber` | string | Receipt number | `RCP-2026-003` |
| `paymentPlace` | string | Payment location | `Warehouse` |
| `description` | string | Installment description | `القسط رقم 1 من 10` |
| `dueDate` | string | Due date | `2026-02-28T00:00:00.000Z` |

#### Response Example
```json
{
  "id": "cm5z7aaaa1234bbbb5678cccc",
  "saleId": "cm5z7abcd1234efgh5678ijkl",
  "amount": 400.00,
  "paidAmount": 400.00,
  "isPaid": true,
  "paidAt": "2026-01-30T14:00:00.000Z",
  "receiptNumber": "RCP-2026-003",
  "paymentPlace": "Warehouse",
  "description": "القسط رقم 1 من 10",
  "dueDate": "2026-02-28T00:00:00.000Z"
}
```

#### Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 400 | MISSING_PAYMENT_PLACE | يجب اختيار مكان الدفع |
| 400 | MISSING_RECEIPT | يجب إدخال رقم الإيصال |
| 400 | DUPLICATE_RECEIPT | رقم الإيصال مستخدم من قبل |
| 404 | INSTALLMENT_NOT_FOUND | Installment not found |

---

## Common Data Types

### Enums

#### User Roles
- `SUPER_ADMIN` - Full system access
- `MANAGEMENT` - Management level access
- `BRANCH_MANAGER` - Branch manager
- `CS_SUPERVISOR` - Customer service supervisor
- `TECHNICIAN` - Maintenance technician
- `ADMIN` - Administrator
- `USER` - Standard user

#### Request Statuses
- `Open` - New maintenance request
- `In Progress` - Being worked on
- `Closed` - Completed and closed
- `PENDING_TRANSFER` - Awaiting transfer
- `AT_CENTER` - At maintenance center

#### Transfer Order Statuses
- `PENDING` - Awaiting receipt
- `RECEIVED` - Fully received
- `PARTIAL` - Partially received
- `REJECTED` - Rejected by recipient
- `CANCELLED` - Cancelled by sender

#### Sale Statuses
- `ONGOING` - Active installment plan
- `COMPLETED` - Fully paid
- `PENDING` - Awaiting initial payment

#### Transfer Types
- `MACHINE` - Machine/equipment transfer
- `SIM` - SIM card transfer
- `SPARE_PART` - Spare parts transfer
- `MAINTENANCE` - Maintenance transfer

#### Machine Statuses
- `NEW` - New in warehouse
- `SOLD` - Sold to customer
- `IN_TRANSIT` - In transfer
- `DEFECTIVE` - Defective/damaged
- `AT_CENTER` - At maintenance center
- `RECEIVED_AT_CENTER` - Received at center
- `REPAIRED` - Repaired and ready
- `CLIENT_REPAIR` - Under client repair

---

## Authentication

All endpoints require Bearer token authentication except `/auth/login`.

### Headers
```
Authorization: Bearer <token>
Content-Type: application/json
```

### Token Format
JWT token with the following claims:
- `id` - User CUID
- `email` - User email
- `role` - User role
- `displayName` - User name
- `branchId` - Branch CUID
- `exp` - Expiration time (24 hours)

---

## Error Response Format

All errors follow a consistent format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "status": 400
}
```

### Common HTTP Status Codes

| Status | Description |
|--------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 409 | Conflict |
| 429 | Too Many Requests |
| 500 | Internal Server Error |

---

## Validation Rules Summary

### ID Formats
- **CUID**: 25-character alphanumeric string (e.g., `cm5z7abcd1234efgh5678ijkl`)
- **Serial Numbers**: Variable length, typically 10-20 alphanumeric characters
- **Receipt Numbers**: Format varies, typically `RCP-YYYY-NNN`

### Numeric Constraints
- **Prices**: Non-negative, rounded to 2 decimal places
- **Quantities**: Positive integers
- **Installment Counts**: 1-60 months typical

### Date Formats
- All dates in ISO 8601 format: `YYYY-MM-DDTHH:mm:ss.sssZ`
- Due dates are set to midnight (00:00:00) of the specified date

### String Constraints
- Names: Minimum 2 characters
- Descriptions: Minimum 5 characters for maintenance requests
- Codes: Minimum 1 character, unique within branch

---

## Rate Limiting

The following endpoints have rate limiting applied:

| Endpoint | Limit |
|----------|-------|
| POST /requests | Create limiter |
| PUT /requests/:id | Update limiter |
| DELETE /requests/:id | Delete limiter |

Rate limit response (429):
```json
{
  "error": "Too many requests",
  "retryAfter": 60
}
```
