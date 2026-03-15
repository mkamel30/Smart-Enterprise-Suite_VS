# Smart Enterprise Suite Database Schema Reference

## System Information
- **Database**: SQLite
- **ORM**: Prisma
- **Schema Version**: 1.0
- **Generated**: January 30, 2026
- **Total Models**: 19

---

## Table of Contents

1. [Overview](#overview)
2. [Model Reference](#model-reference)
   - [User](#user)
   - [Branch](#branch)
   - [Customer](#customer)
   - [PosMachine](#posmachine)
   - [SimCard](#simcard)
   - [MachineParameter](#machineparameter)
   - [SparePart](#sparepart)
   - [InventoryItem](#inventoryitem)
   - [MaintenanceRequest](#maintenancerequest)
   - [TransferOrder](#transferorder)
   - [TransferOrderItem](#transferorderitem)
   - [PriceChangeLog](#pricechangelog)
   - [UsedPartLog](#usedpartlog)
   - [StockMovement](#stockmovement)
   - [Payment](#payment)
   - [MachineMovementLog](#machinemovementlog)
   - [SystemLog](#systemlog)
   - [MaintenanceApproval](#maintenanceapproval)
   - [RepairVoucher](#repairvoucher)
3. [Index Summary](#index-summary)
4. [Summary & Statistics](#summary--statistics)

---

## Overview

The Smart Enterprise Suite database is designed to support a maintenance management system with inventory tracking, customer management, and request handling capabilities. It uses Prisma ORM with SQLite database.

### Key Features
- **User Management**: Multi-role system with branch assignments
- **Hierarchical Branch Structure**: Support for parent/child branch relationships
- **Customer Management**: Detailed customer profiles with machine associations
- **Maintenance Tracking**: Full lifecycle from open to close
- **Inventory Management**: Multi-branch inventory with stock tracking
- **Transfer System**: Machine and parts transfer between branches
- **Audit Logging**: Comprehensive system-wide logging

---

## Model Reference

### User

**Purpose**: System users with authentication and authorization capabilities.

**Fields**:

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| id | String | Yes | cuid() | Primary key - unique identifier |
| uid | String? | No | null | Optional legacy Firebase UID for backward compatibility |
| email | String? | No | null | User email address for login |
| displayName | String? | No | null | Display name shown in UI |
| role | String? | No | "Technician" | User role: Technician, Admin, Manager, etc. |
| password | String? | No | null | Hashed password for authentication |
| createdAt | DateTime | Yes | now() | Account creation timestamp |
| branchId | String? | No | null | Foreign key to assigned branch |
| branch | Branch? | No | - | Relation to Branch model |

**Relationships**:
- **Many-to-One** with `Branch` (optional) - Users are assigned to a branch

**Constraints**:
- Primary key: `id`
- No unique constraints on email (allows flexibility)

---

### Branch

**Purpose**: Organizational units representing physical locations (branches or maintenance centers).

**Fields**:

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| id | String | Yes | cuid() | Primary key - unique identifier |
| code | String | Yes | - | Unique branch code for identification |
| name | String | Yes | - | Branch display name |
| address | String? | No | null | Physical address of the branch |
| type | String | Yes | "BRANCH" | Branch type: BRANCH or MAINTENANCE_CENTER |
| parentBranchId | String? | No | null | Foreign key to parent branch for hierarchy |
| parentBranch | Branch? | No | - | Self-relation to parent branch |
| childBranches | Branch[] | No | [] | Self-relation to child branches |
| users | User[] | No | [] | Users assigned to this branch |
| customers | Customer[] | No | [] | Customers belonging to this branch |
| requests | MaintenanceRequest[] | No | [] | Maintenance requests for this branch |
| inventory | InventoryItem[] | No | [] | Inventory items at this branch |
| sentTransfers | TransferOrder[] | No | [] | Transfer orders sent from this branch |
| receivedTransfers | TransferOrder[] | No | [] | Transfer orders received by this branch |
| createdAt | DateTime | Yes | now() | Branch creation timestamp |

**Relationships**:
- **Self-relation**: Hierarchical structure with parent/child branches
- **One-to-Many** with `User` - Branch has many users
- **One-to-Many** with `Customer` - Branch has many customers
- **One-to-Many** with `MaintenanceRequest` - Branch has many requests
- **One-to-Many** with `InventoryItem` - Branch has inventory
- **One-to-Many** with `TransferOrder` (sent) - Transfer orders originating here
- **One-to-Many** with `TransferOrder` (received) - Transfer orders arriving here

**Constraints**:
- Primary key: `id`
- Unique: `code` - Branch code must be unique

---

### Customer

**Purpose**: Customer profiles with contact information and machine associations.

**Fields**:

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| id | String | Yes | cuid() | Primary key - unique identifier |
| bkcode | String | Yes | - | Unique customer code (business key) |
| client_name | String | Yes | - | Customer name |
| supply_office | String? | No | null | Supply office identifier |
| operating_date | DateTime? | No | null | Date customer started operations |
| address | String? | No | null | Customer address |
| contact_person | String? | No | null | Primary contact person name |
| scanned_id_path | String? | No | null | Path to scanned ID document |
| national_id | String? | No | null | National ID number |
| dept | String? | No | null | Department code |
| telephone_1 | String? | No | null | Primary phone number |
| telephone_2 | String? | No | null | Secondary phone number |
| has_gates | Boolean? | No | false | Whether customer has gates/access points |
| bk_type | String? | No | null | Business type classification |
| notes | String? | No | null | General notes about customer |
| papers_date | DateTime? | No | null | Date papers were submitted |
| isSpecial | Boolean? | No | false | Flag for special/custom customers |
| machines | PosMachine[] | No | [] | POS machines owned by customer |
| simCards | SimCard[] | No | [] | SIM cards assigned to customer |
| requests | MaintenanceRequest[] | No | [] | Maintenance requests for this customer |
| branchId | String? | No | null | Foreign key to assigned branch |
| branch | Branch? | No | - | Relation to Branch model |

**Relationships**:
- **One-to-Many** with `PosMachine` - Customer has multiple machines
- **One-to-Many** with `SimCard` - Customer has multiple SIM cards
- **One-to-Many** with `MaintenanceRequest` - Customer has service requests
- **Many-to-One** with `Branch` - Customer belongs to a branch

**Constraints**:
- Primary key: `id`
- Unique: `bkcode` - Customer code must be unique

---

### PosMachine

**Purpose**: Point-of-sale machines owned by customers.

**Fields**:

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| id | String | Yes | cuid() | Primary key - unique identifier |
| serialNumber | String | Yes | - | Unique serial number of the machine |
| posId | String? | No | null | POS system identifier |
| model | String? | No | null | Machine model name |
| manufacturer | String? | No | null | Manufacturer name |
| customerId | String? | No | null | Foreign key to owning customer (bkcode) |
| customer | Customer? | No | - | Relation to Customer model |
| isMain | Boolean? | No | false | Whether this is the customer's main machine |
| requests | MaintenanceRequest[] | No | [] | Maintenance requests for this machine |

**Relationships**:
- **Many-to-One** with `Customer` - Machine belongs to a customer
- **One-to-Many** with `MaintenanceRequest` - Machine has service history

**Constraints**:
- Primary key: `id`
- Unique: `serialNumber` - Serial number must be unique

**Database Mapping**:
- Table name: `ClientPos`

---

### SimCard

**Purpose**: SIM cards assigned to customers for connectivity.

**Fields**:

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| id | String | Yes | cuid() | Primary key - unique identifier |
| serialNumber | String | Yes | - | Unique SIM card serial number |
| type | String? | No | null | SIM card type/category |
| customerId | String? | No | null | Foreign key to assigned customer (bkcode) |
| customer | Customer? | No | - | Relation to Customer model |

**Relationships**:
- **Many-to-One** with `Customer` - SIM belongs to a customer

**Constraints**:
- Primary key: `id`
- Unique: `serialNumber` - Serial number must be unique

**Database Mapping**:
- Table name: `ClientSimCard`

---

### MachineParameter

**Purpose**: Configuration for automatic machine model detection based on serial number prefixes.

**Fields**:

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| id | String | Yes | cuid() | Primary key - unique identifier |
| prefix | String | Yes | - | Serial number prefix pattern |
| model | String | Yes | - | Model name to assign |
| manufacturer | String | Yes | - | Manufacturer name to assign |

**Relationships**: None

**Constraints**:
- Primary key: `id`
- Unique: `prefix` - Prefix pattern must be unique

---

### SparePart

**Purpose**: Spare parts catalog with compatibility and pricing information.

**Fields**:

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| id | String | Yes | cuid() | Primary key - unique identifier |
| partNumber | String? | No | null | Manufacturer part number |
| name | String | Yes | - | Part name/description |
| description | String? | No | null | Detailed description |
| compatibleModels | String? | No | null | JSON string or comma-separated compatible models |
| defaultCost | Float | Yes | 0 | Default unit cost |
| isConsumable | Boolean? | No | false | Whether part is consumable (cannot be reused) |
| allowsMultiple | Boolean? | No | false | Whether multiple units can be used per repair |
| inventoryItems | InventoryItem[] | No | [] | Inventory items for this part |

**Relationships**:
- **One-to-Many** with `InventoryItem` - Part exists in inventory

**Constraints**:
- Primary key: `id`

---

### InventoryItem

**Purpose**: Inventory tracking for spare parts at specific branch locations.

**Fields**:

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| id | String | Yes | cuid() | Primary key - unique identifier |
| partId | String | Yes | - | Foreign key to spare part |
| part | SparePart | Yes | - | Relation to SparePart model |
| quantity | Int | Yes | 0 | Current stock quantity |
| minLevel | Int | Yes | 0 | Minimum stock level for reorder alerts |
| location | String? | No | null | Storage location within branch |
| branchId | String? | No | null | Foreign key to branch |
| branch | Branch? | No | - | Relation to Branch model |

**Relationships**:
- **Many-to-One** with `SparePart` - Item is a specific part
- **Many-to-One** with `Branch` - Item is stored at a branch

**Constraints**:
- Primary key: `id`

---

### MaintenanceRequest

**Purpose**: Core entity for tracking maintenance and repair requests.

**Fields**:

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| id | String | Yes | cuid() | Primary key - unique identifier |
| customerId | String | Yes | - | Foreign key to customer (bkcode) |
| customer | Customer | Yes | - | Relation to Customer model |
| posMachineId | String? | No | null | Foreign key to specific machine |
| posMachine | PosMachine? | No | - | Relation to PosMachine model |
| customerName | String? | No | null | Denormalized customer name for quick access |
| machineModel | String? | No | null | Denormalized machine model |
| machineManufacturer | String? | No | null | Denormalized manufacturer |
| serialNumber | String? | No | null | Denormalized serial number |
| status | String | Yes | "Open" | Request status |
| branchId | String? | No | null | Foreign key to owning branch |
| branch | Branch? | No | - | Relation to Branch model |
| servicedByBranchId | String? | No | null | Branch/center currently holding the machine |
| technician | String? | No | null | Assigned technician name |
| notes | String? | No | null | General notes |
| complaint | String? | No | null | Customer complaint description |
| actionTaken | String? | No | null | Actions taken during repair |
| createdAt | DateTime | Yes | now() | Request creation timestamp |
| closingUserId | String? | No | null | User ID who closed the request |
| closingUserName | String? | No | null | User name who closed the request |
| closingTimestamp | DateTime? | No | null | When request was closed |
| usedParts | String? | No | null | JSON string of parts used |
| receiptNumber | String? | No | null | Payment receipt number |
| totalCost | Float? | No | 0 | Total cost of repair |
| approval | MaintenanceApproval? | No | - | Associated approval record |
| vouchers | RepairVoucher[] | No | [] | Generated repair vouchers |

**Relationships**:
- **Many-to-One** with `Customer` - Request is for a customer
- **Many-to-One** with `PosMachine` - Request is for a specific machine (optional)
- **Many-to-One** with `Branch` - Request belongs to a branch
- **One-to-One** with `MaintenanceApproval` - Optional approval workflow
- **One-to-Many** with `RepairVoucher` - Request can have multiple vouchers

**Constraints**:
- Primary key: `id`

**Indexes**:
```prisma
@@index([customerId])
@@index([status])
@@index([branchId])
@@index([createdAt])
```

**Status Values**:
- `Open` - Initial state
- `In Progress` - Being worked on
- `Closed` - Completed
- `Cancelled` - Cancelled
- `PENDING_TRANSFER` - Waiting for transfer
- `AT_CENTER` - At maintenance center
- `WAITING_APPROVAL` - Pending cost approval

---

### TransferOrder

**Purpose**: Orders for transferring machines, SIMs, or parts between branches.

**Fields**:

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| id | String | Yes | cuid() | Primary key - unique identifier |
| waybillNumber | String? | No | null | Manual waybill/tracking number |
| fromBranchId | String | Yes | - | Source branch ID |
| fromBranch | Branch | Yes | - | Relation to source branch |
| toBranchId | String | Yes | - | Destination branch ID |
| toBranch | Branch | Yes | - | Relation to destination branch |
| status | String | Yes | "PENDING" | Transfer status |
| type | String | Yes | - | Transfer type |
| items | TransferOrderItem[] | No | [] | Items in this transfer |
| driverName | String? | No | null | Driver name for delivery |
| driverPhone | String? | No | null | Driver contact number |
| createdAt | DateTime | Yes | now() | Creation timestamp |
| updatedAt | DateTime | Yes | updatedAt() | Last update timestamp |
| createdByUserId | String? | No | null | User who created the order |
| receivedByUserId | String? | No | null | User who received the order |
| notes | String? | No | null | General notes |
| receivedAt | DateTime? | No | null | When order was received |
| receivedBy | String? | No | null | Receiver identifier |
| receivedByName | String? | No | null | Receiver name |
| rejectionReason | String? | No | null | Reason if transfer was rejected |
| orderNumber | String | Yes | - | Unique order number |

**Relationships**:
- **Many-to-One** with `Branch` (from) - Source branch
- **Many-to-One** with `Branch` (to) - Destination branch
- **One-to-Many** with `TransferOrderItem` - Transfer contains items

**Constraints**:
- Primary key: `id`
- Unique: `orderNumber`

**Indexes**:
```prisma
@@index([fromBranchId])
@@index([toBranchId])
@@index([status])
@@index([createdAt])
```

**Status Values**:
- `PENDING` - Created but not shipped
- `SHIPPED` - In transit
- `RECEIVED` - Fully received
- `PARTIAL` - Partially received
- `REJECTED` - Rejected by recipient

**Type Values**:
- `SEND_TO_CENTER` - Send to maintenance center
- `RETURN_TO_BRANCH` - Return to original branch
- `MACHINE` - Machine transfer
- `SIM` - SIM card transfer

---

### TransferOrderItem

**Purpose**: Individual items within a transfer order.

**Fields**:

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| id | String | Yes | cuid() | Primary key - unique identifier |
| transferOrderId | String | Yes | - | Foreign key to parent order |
| transferOrder | TransferOrder | Yes | - | Relation to TransferOrder |
| serialNumber | String? | No | null | Item serial number |
| type | String? | No | null | Item type/model |
| manufacturer | String? | No | null | Item manufacturer |
| isReceived | Boolean | Yes | false | Whether item was received |
| receivedAt | DateTime? | No | null | When item was received |
| notes | String? | No | null | Item-specific notes |

**Relationships**:
- **Many-to-One** with `TransferOrder` - Item belongs to a transfer order

**Constraints**:
- Primary key: `id`
- Cascade delete: When parent order is deleted, items are deleted

---

### PriceChangeLog

**Purpose**: Audit log for spare part price changes.

**Fields**:

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| id | String | Yes | cuid() | Primary key - unique identifier |
| partId | String | Yes | - | Spare part ID that was changed |
| oldCost | Float | Yes | - | Previous cost value |
| newCost | Float | Yes | - | New cost value |
| changedAt | DateTime | Yes | now() | When change occurred |
| userId | String? | No | null | User who made the change |

**Relationships**: None

**Constraints**:
- Primary key: `id`

---

### UsedPartLog

**Purpose**: Historical record of parts used in maintenance operations.

**Fields**:

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| id | String | Yes | cuid() | Primary key - unique identifier |
| requestId | String | Yes | - | Maintenance request ID |
| customerId | String | Yes | - | Customer ID |
| customerName | String? | No | null | Customer name (denormalized) |
| posMachineId | String? | No | null | Machine ID |
| technician | String? | No | null | Technician who performed work |
| closedByUserId | String? | No | null | User who closed the request |
| closedAt | DateTime | Yes | now() | When request was closed |
| parts | String | Yes | - | JSON string of parts used |
| receiptNumber | String? | No | null | Payment receipt number |

**Relationships**: None (denormalized log table)

**Constraints**:
- Primary key: `id`

---

### StockMovement

**Purpose**: Detailed inventory transaction log for all stock changes.

**Fields**:

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| id | String | Yes | cuid() | Primary key - unique identifier |
| partId | String | Yes | - | Spare part ID |
| type | String | Yes | - | Movement type: "IN" or "OUT" |
| quantity | Int | Yes | - | Quantity changed |
| reason | String? | No | null | Reason for movement (Arabic text) |
| requestId | String? | No | null | Link to maintenance request if applicable |
| userId | String? | No | null | User who performed the movement |
| createdAt | DateTime | Yes | now() | When movement occurred |
| branchId | String? | No | null | Branch where movement occurred |

**Relationships**: None (log table)

**Constraints**:
- Primary key: `id`

**Indexes**:
```prisma
@@index([partId])
@@index([branchId])
@@index([createdAt])
```

**Type Values**:
- `IN` - Stock addition (receiving, transfer in)
- `OUT` - Stock reduction (usage, transfer out)

---

### Payment

**Purpose**: Payment records for maintenance services.

**Fields**:

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| id | String | Yes | cuid() | Primary key - unique identifier |
| customerId | String? | No | null | Customer who made payment |
| customerName | String? | No | null | Customer name (denormalized) |
| requestId | String? | No | null | Related maintenance request |
| amount | Float | Yes | - | Payment amount |
| reason | String | Yes | - | Payment reason (Arabic text) |
| paymentPlace | String | Yes | - | Payment location/method |
| receiptNumber | String? | No | null | Official receipt number |
| notes | String? | No | null | Additional notes |
| userId | String? | No | null | User who recorded payment |
| userName | String? | No | null | User name (denormalized) |
| createdAt | DateTime | Yes | now() | Payment timestamp |
| branchId | String? | No | null | Branch where payment was recorded |

**Relationships**: None (denormalized for performance)

**Constraints**:
- Primary key: `id`

**Payment Place Values** (Arabic):
- بنك - Bank
- ضامن - Guarantor
- البريد - Post Office

---

### MachineMovementLog

**Purpose**: Audit trail for machine movements and status changes.

**Fields**:

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| id | String | Yes | cuid() | Primary key - unique identifier |
| machineId | String | Yes | - | Machine ID |
| serialNumber | String | Yes | - | Machine serial number |
| action | String | Yes | - | Type of action performed |
| details | String? | No | null | Additional details |
| performedBy | String? | No | null | User who performed action |
| createdAt | DateTime | Yes | now() | When action occurred |

**Relationships**: None (log table)

**Constraints**:
- Primary key: `id`

---

### SystemLog

**Purpose**: Comprehensive system-wide audit logging for all entity changes.

**Fields**:

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| id | String | Yes | cuid() | Primary key - unique identifier |
| entityType | String | Yes | - | Type of entity affected |
| entityId | String | Yes | - | ID of affected entity |
| action | String | Yes | - | Action performed |
| details | String? | No | null | JSON string with change details |
| performedBy | String? | No | null | Display name of user |
| userId | String? | No | null | User ID |
| createdAt | DateTime | Yes | now() | When action occurred |

**Relationships**: None (system-wide log)

**Constraints**:
- Primary key: `id`

**Entity Types**:
- `CUSTOMER` - Customer entity
- `USER` - User entity
- `REQUEST` - Maintenance request
- `PAYMENT` - Payment record
- `PART` - Spare part

**Actions**:
- `CREATE` - Entity created
- `UPDATE` - Entity updated
- `DELETE` - Entity deleted
- `LOGIN` - User login
- `STATUS_CHANGE` - Status changed

---

### MaintenanceApproval

**Purpose**: Cost approval workflow for maintenance requests.

**Fields**:

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| id | String | Yes | cuid() | Primary key - unique identifier |
| requestId | String | Yes | - | Foreign key to maintenance request |
| request | MaintenanceRequest | Yes | - | Relation to request |
| cost | Float | Yes | - | Proposed cost |
| parts | String | Yes | - | JSON string of proposed parts |
| status | String | Yes | "PENDING" | Approval status |
| notes | String? | No | null | Additional notes |
| createdAt | DateTime | Yes | now() | When approval was requested |
| respondedAt | DateTime? | No | null | When approval was responded to |
| respondedBy | String? | No | null | Who responded to approval |

**Relationships**:
- **One-to-One** with `MaintenanceRequest` - Each request has one approval record

**Constraints**:
- Primary key: `id`
- Unique: `requestId` - One approval per request

**Status Values**:
- `PENDING` - Awaiting approval
- `APPROVED` - Approved
- `REJECTED` - Rejected

---

### RepairVoucher

**Purpose**: Official repair vouchers/receipts generated for completed maintenance.

**Fields**:

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| id | String | Yes | cuid() | Primary key - unique identifier |
| code | String | Yes | - | Unique voucher code |
| requestId | String | Yes | - | Foreign key to maintenance request |
| request | MaintenanceRequest | Yes | - | Relation to request |
| type | String | Yes | - | Voucher type |
| parts | String | Yes | - | JSON string of parts used |
| totalCost | Float | Yes | - | Total cost |
| createdAt | DateTime | Yes | now() | When voucher was created |
| createdBy | String? | No | null | User who created voucher |

**Relationships**:
- **Many-to-One** with `MaintenanceRequest` - Voucher belongs to a request

**Constraints**:
- Primary key: `id`
- Unique: `code` - Voucher code must be unique

---

## Index Summary

| Model | Index Name | Fields | Type | Purpose |
|-------|-----------|--------|------|---------|
| MaintenanceRequest | customerId_idx | customerId | B-Tree | Fast lookup by customer |
| MaintenanceRequest | status_idx | status | B-Tree | Filter by status |
| MaintenanceRequest | branchId_idx | branchId | B-Tree | Filter by branch |
| MaintenanceRequest | createdAt_idx | createdAt | B-Tree | Sort by date |
| TransferOrder | fromBranchId_idx | fromBranchId | B-Tree | Filter outgoing transfers |
| TransferOrder | toBranchId_idx | toBranchId | B-Tree | Filter incoming transfers |
| TransferOrder | status_idx | status | B-Tree | Filter by status |
| TransferOrder | createdAt_idx | createdAt | B-Tree | Sort by date |
| StockMovement | partId_idx | partId | B-Tree | Filter by part |
| StockMovement | branchId_idx | branchId | B-Tree | Filter by branch |
| StockMovement | createdAt_idx | createdAt | B-Tree | Sort by date |

**Total Indexes**: 11

---

## Summary & Statistics

### Model Counts
- **Total Models**: 19
- **Core Business Entities**: 7 (User, Branch, Customer, PosMachine, SimCard, SparePart, MaintenanceRequest)
- **Inventory/Stock**: 3 (SparePart, InventoryItem, StockMovement)
- **Transfer/Logistics**: 2 (TransferOrder, TransferOrderItem)
- **Financial**: 2 (Payment, RepairVoucher)
- **Audit/Logging**: 4 (PriceChangeLog, UsedPartLog, MachineMovementLog, SystemLog)
- **Workflow**: 1 (MaintenanceApproval)
- **Configuration**: 1 (MachineParameter)

### Field Statistics
- **Total Fields**: ~200+
- **Required Fields**: ~60%
- **Optional Fields**: ~40%
- **Relation Fields**: ~25
- **Indexed Fields**: 11

### Key Insights

1. **Hierarchical Structure**: The Branch model supports a hierarchical organization structure with parent/child relationships

2. **Flexible Machine Association**: Maintenance requests can be linked to specific machines or just customers, allowing for general service requests

3. **Comprehensive Audit Trail**: The system includes multiple logging mechanisms:
   - `SystemLog`: General entity changes
   - `StockMovement`: Inventory transactions
   - `MachineMovementLog`: Machine status changes
   - `UsedPartLog`: Parts usage history
   - `PriceChangeLog`: Price modifications

4. **Multi-Branch Support**: Full support for multiple branches with:
   - Branch-specific inventory
   - Inter-branch transfers
   - Branch-based user assignments
   - Branch-level reporting

5. **Denormalization for Performance**: Several fields are denormalized (e.g., `customerName`, `machineModel`) to reduce join queries for common read operations

6. **Status Workflows**: Multiple entities have status fields with defined workflows:
   - MaintenanceRequest: 7 possible statuses
   - TransferOrder: 5 possible statuses
   - MaintenanceApproval: 3 possible statuses

7. **JSON Storage**: Several fields store JSON strings for flexibility:
   - `compatibleModels` in SparePart
   - `usedParts` in MaintenanceRequest
   - `parts` in UsedPartLog and RepairVoucher
   - `details` in SystemLog

8. **Soft References**: Some relations use business keys (like `bkcode`) rather than primary keys for customer associations, likely for legacy data compatibility

9. **Arabic Language Support**: Several fields store Arabic text, particularly in Payment model (reason, paymentPlace)

10. **Transfer System**: Sophisticated transfer system with:
    - Order and item-level tracking
    - Partial receipt capability
    - Driver assignment
    - Rejection handling

---

## Notes

- **Database**: SQLite (file-based, suitable for single-instance deployments)
- **ID Generation**: CUID (Collision-resistant Unique Identifier) used for all primary keys
- **Timestamps**: All entities track creation time; TransferOrder also tracks updates
- **Soft Deletes**: No explicit soft delete pattern; deletions are physical with cascade rules
- **Constraints**: Minimal constraints defined; mostly rely on application-level validation

---

*Document generated automatically from prisma/schema.prisma*
