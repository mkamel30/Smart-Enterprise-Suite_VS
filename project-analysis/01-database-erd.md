# Database Entity Relationship Diagram

**System:** Smart Enterprise Suite  
**Version:** 3.2.0  
**Last Updated:** January 30, 2026

---

## Complete Database Schema Overview

The Smart Enterprise Suite database consists of **27 interconnected models** designed to support multi-branch maintenance management operations with strict data isolation and comprehensive audit trails.

---

## Entity Relationship Diagram

```mermaid
erDiagram
    %% Core Hierarchy Entities
    Branch ||--o{ User : "has many"
    Branch ||--o{ Customer : "serves"
    Branch ||--o{ MaintenanceRequest : "handles"
    Branch ||--o{ InventoryItem : "stores"
    Branch ||--o{ WarehouseMachine : "stocks"
    Branch ||--o{ WarehouseSim : "holds"
    Branch ||--o{ Payment : "receives"
    Branch ||--o{ StockMovement : "tracks"
    Branch ||--o{ TransferOrder : "sends"
    Branch ||--o{ TransferOrder : "receives"
    Branch ||--o{ SystemLog : "logs"
    
    %% Self-referential Branch Hierarchy
    Branch ||--o{ Branch : "parent of"
    
    %% Customer Relationships
    Customer ||--o{ PosMachine : "owns"
    Customer ||--o{ SimCard : "has"
    Customer ||--o{ MaintenanceRequest : "requests"
    Customer ||--o{ MachineSale : "purchases"
    Customer ||--o{ Payment : "makes"
    
    %% Maintenance Workflow
    MaintenanceRequest ||--|| MaintenanceApproval : "requires"
    MaintenanceRequest ||--o{ RepairVoucher : "generates"
    MaintenanceRequest ||--o{ UsedPartLog : "consumes"
    MaintenanceRequest }o--|| PosMachine : "for"
    MaintenanceRequest }o--|| User : "assigned to"
    
    %% Machine State Management
    WarehouseMachine ||--o{ MachineMovementLog : "tracks"
    WarehouseMachine ||--o{ ServiceAssignment : "assigned to"
    WarehouseMachine ||--o{ MachineSale : "sold as"
    
    %% SIM Management
    WarehouseSim ||--o{ SimMovementLog : "tracks"
    WarehouseSim ||--o{ SimCard : "becomes"
    
    %% Inventory System
    SparePart ||--o{ InventoryItem : "stocked as"
    SparePart ||--o{ StockMovement : "moved"
    SparePart ||--o{ UsedPartLog : "used in"
    SparePart ||--o{ PriceChangeLog : "priced"
    
    %% Sales & Financials
    MachineSale ||--o{ Installment : "has"
    MachineSale ||--o{ Payment : "receives"
    
    %% Transfer System
    TransferOrder ||--o{ TransferOrderItem : "contains"
    TransferOrderItem }o--o| WarehouseMachine : "references"
    TransferOrderItem }o--o| WarehouseSim : "references"
    
    %% Notifications
    User ||--o{ Notification : "receives"
    
    %% Role Permissions
    RolePermission }o--|| User : "defines"
```

---

## Core Entity Groups

### 1. Organization & Users

```mermaid
erDiagram
    Branch {
        string id PK
        string code UK
        string name
        string type "BRANCH|MAINTENANCE_CENTER|ADMIN_AFFAIRS"
        string parentBranchId FK "self-reference"
        datetime createdAt
    }
    
    User {
        string id PK
        string uid "Firebase UID"
        string email
        string displayName
        string role
        string password "hashed"
        string branchId FK
        datetime createdAt
    }
    
    RolePermission {
        string id PK
        string role
        string page
        string action
        boolean allowed
    }
    
    Branch ||--o{ User : employs
    Branch ||--o{ Branch : "parent branch"
```

### 2. Customer & Assets

```mermaid
erDiagram
    Customer {
        string id PK
        string bkcode UK
        string client_name
        string telephone_1
        string telephone_2
        string address
        string branchId FK
        boolean isSpecial
    }
    
    PosMachine {
        string id PK
        string serialNumber UK
        string model
        string manufacturer
        string customerId FK
        boolean isMain
    }
    
    SimCard {
        string id PK
        string serialNumber UK
        string type
        string customerId FK
    }
    
    Customer ||--o{ PosMachine : owns
    Customer ||--o{ SimCard : has
```

### 3. Maintenance Workflow

```mermaid
erDiagram
    MaintenanceRequest {
        string id PK
        string customerId FK
        string posMachineId FK
        string status "Open|In Progress|Closed"
        string technician
        string complaint
        string actionTaken
        float totalCost
        string branchId FK
        datetime createdAt
        datetime closingTimestamp
    }
    
    MaintenanceApproval {
        string id PK
        string requestId FK "unique"
        float cost
        string parts "JSON"
        string status "PENDING|APPROVED|REJECTED"
    }
    
    RepairVoucher {
        string id PK
        string code UK
        string requestId FK
        string type "PAID|FREE"
        string parts "JSON"
        float totalCost
    }
    
    UsedPartLog {
        string id PK
        string requestId FK
        string customerId FK
        string parts "JSON"
        datetime closedAt
    }
    
    MaintenanceRequest ||--|| MaintenanceApproval : requires
    MaintenanceRequest ||--o{ RepairVoucher : generates
    MaintenanceRequest ||--o{ UsedPartLog : logs
```

### 4. Inventory Management

```mermaid
erDiagram
    SparePart {
        string id PK
        string partNumber
        string name
        string compatibleModels
        float defaultCost
        boolean isConsumable
        boolean allowsMultiple
    }
    
    InventoryItem {
        string id PK
        string partId FK
        int quantity
        int minLevel
        string location
        string branchId FK
    }
    
    StockMovement {
        string id PK
        string partId FK
        string type "IN|OUT"
        int quantity
        string reason
        string requestId FK
        string branchId FK
        datetime createdAt
    }
    
    PriceChangeLog {
        string id PK
        string partId FK
        float oldCost
        float newCost
        datetime changedAt
    }
    
    SparePart ||--o{ InventoryItem : stocked
    SparePart ||--o{ StockMovement : moved
    SparePart ||--o{ PriceChangeLog : tracked
```

### 5. Warehouse & Assets

```mermaid
erDiagram
    WarehouseMachine {
        string id PK
        string serialNumber UK
        string model
        string manufacturer
        string status "NEW|USED|SOLD|IN_TRANSIT"
        string branchId FK
        datetime createdAt
    }
    
    WarehouseSim {
        string id PK
        string serialNumber UK
        string phoneNumber
        string type
        string status "NEW|ASSIGNED|SOLD"
        string branchId FK
    }
    
    MachineMovementLog {
        string id PK
        string machineId FK
        string serialNumber
        string action
        string details
        datetime createdAt
    }
    
    ServiceAssignment {
        string id PK
        string machineId FK
        string originBranchId FK
        string centerBranchId FK
        string status "UNDER_INSPECTION|REPAIRED"
    }
    
    WarehouseMachine ||--o{ MachineMovementLog : tracks
    WarehouseMachine ||--o{ ServiceAssignment : assigned
```

### 6. Sales & Financials

```mermaid
erDiagram
    MachineSale {
        string id PK
        string customerId FK
        string machineId FK
        string type "CASH|INSTALLMENT"
        float totalPrice
        float downPayment
        int installmentCount
        string branchId FK
        datetime createdAt
    }
    
    Installment {
        string id PK
        string saleId FK
        int monthNumber
        float amount
        datetime dueDate
        boolean isPaid
        datetime paidAt
    }
    
    Payment {
        string id PK
        string customerId FK
        string saleId FK
        float amount
        string method "CASH|BANK|VISA"
        string receiptNumber
        string branchId FK
        datetime createdAt
    }
    
    MachineSale ||--o{ Installment : has
    MachineSale ||--o{ Payment : receives
```

### 7. Transfer System

```mermaid
erDiagram
    TransferOrder {
        string id PK
        string orderNumber UK
        string fromBranchId FK
        string toBranchId FK
        string status "PENDING|PARTIAL|RECEIVED"
       
