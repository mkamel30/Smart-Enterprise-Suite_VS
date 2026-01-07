-- CreateTable
CREATE TABLE "ClientType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "type" TEXT NOT NULL DEFAULT 'BRANCH',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "parentBranchId" TEXT,
    "maintenanceCenterId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Branch_parentBranchId_fkey" FOREIGN KEY ("parentBranchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Branch_maintenanceCenterId_fkey" FOREIGN KEY ("maintenanceCenterId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "role" TEXT NOT NULL,
    "permissionType" TEXT NOT NULL,
    "permissionKey" TEXT NOT NULL,
    "isAllowed" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" DATETIME NOT NULL,
    "updatedBy" TEXT
);

-- CreateTable
CREATE TABLE "WarehouseSim" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serialNumber" TEXT NOT NULL,
    "type" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "importDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "branchId" TEXT,
    CONSTRAINT "WarehouseSim_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SimMovementLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "simId" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "performedBy" TEXT,
    "branchId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SimMovementLog_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TransferOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderNumber" TEXT NOT NULL,
    "waybillNumber" TEXT,
    "branchId" TEXT,
    "fromBranchId" TEXT NOT NULL,
    "toBranchId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "type" TEXT NOT NULL,
    "driverName" TEXT,
    "driverPhone" TEXT,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdByName" TEXT,
    "createdByUserId" TEXT,
    "receivedByUserId" TEXT,
    "receivedAt" DATETIME,
    "receivedBy" TEXT,
    "receivedByName" TEXT,
    "rejectionReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TransferOrder_fromBranchId_fkey" FOREIGN KEY ("fromBranchId") REFERENCES "Branch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TransferOrder_toBranchId_fkey" FOREIGN KEY ("toBranchId") REFERENCES "Branch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TransferOrderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transferOrderId" TEXT NOT NULL,
    "serialNumber" TEXT,
    "type" TEXT,
    "model" TEXT,
    "manufacturer" TEXT,
    "isReceived" BOOLEAN NOT NULL DEFAULT false,
    "receivedAt" DATETIME,
    "notes" TEXT,
    CONSTRAINT "TransferOrderItem_transferOrderId_fkey" FOREIGN KEY ("transferOrderId") REFERENCES "TransferOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MaintenanceApproval" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "cost" REAL NOT NULL,
    "parts" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "branchId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" DATETIME,
    "respondedBy" TEXT,
    CONSTRAINT "MaintenanceApproval_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MaintenanceRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MaintenanceApproval_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RepairVoucher" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "parts" TEXT NOT NULL,
    "totalCost" REAL NOT NULL,
    "branchId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    CONSTRAINT "RepairVoucher_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MaintenanceRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RepairVoucher_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "branchId" TEXT,
    "link" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Customer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bkcode" TEXT NOT NULL,
    "client_name" TEXT NOT NULL,
    "supply_office" TEXT,
    "operating_date" DATETIME,
    "address" TEXT,
    "contact_person" TEXT,
    "scanned_id_path" TEXT,
    "national_id" TEXT,
    "dept" TEXT,
    "telephone_1" TEXT,
    "telephone_2" TEXT,
    "has_gates" BOOLEAN DEFAULT false,
    "bk_type" TEXT,
    "notes" TEXT,
    "papers_date" DATETIME,
    "isSpecial" BOOLEAN DEFAULT false,
    "clienttype" TEXT,
    "branchId" TEXT,
    CONSTRAINT "Customer_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Customer" ("address", "bk_type", "bkcode", "client_name", "contact_person", "dept", "has_gates", "id", "isSpecial", "national_id", "notes", "operating_date", "papers_date", "scanned_id_path", "supply_office", "telephone_1", "telephone_2") SELECT "address", "bk_type", "bkcode", "client_name", "contact_person", "dept", "has_gates", "id", "isSpecial", "national_id", "notes", "operating_date", "papers_date", "scanned_id_path", "supply_office", "telephone_1", "telephone_2" FROM "Customer";
DROP TABLE "Customer";
ALTER TABLE "new_Customer" RENAME TO "Customer";
CREATE UNIQUE INDEX "Customer_bkcode_key" ON "Customer"("bkcode");
CREATE TABLE "new_Installment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saleId" TEXT NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "amount" REAL NOT NULL,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" DATETIME,
    "description" TEXT,
    "paidAmount" REAL,
    "paymentPlace" TEXT,
    "receiptNumber" TEXT,
    "branchId" TEXT,
    CONSTRAINT "Installment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Installment_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "MachineSale" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Installment" ("amount", "description", "dueDate", "id", "isPaid", "paidAmount", "paidAt", "paymentPlace", "receiptNumber", "saleId") SELECT "amount", "description", "dueDate", "id", "isPaid", "paidAmount", "paidAt", "paymentPlace", "receiptNumber", "saleId" FROM "Installment";
DROP TABLE "Installment";
ALTER TABLE "new_Installment" RENAME TO "Installment";
CREATE TABLE "new_InventoryItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "minLevel" INTEGER NOT NULL DEFAULT 0,
    "location" TEXT,
    "branchId" TEXT,
    CONSTRAINT "InventoryItem_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InventoryItem_partId_fkey" FOREIGN KEY ("partId") REFERENCES "SparePart" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_InventoryItem" ("id", "location", "minLevel", "partId", "quantity") SELECT "id", "location", "minLevel", "partId", "quantity" FROM "InventoryItem";
DROP TABLE "InventoryItem";
ALTER TABLE "new_InventoryItem" RENAME TO "InventoryItem";
CREATE TABLE "new_MachineMovementLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "machineId" TEXT,
    "serialNumber" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "performedBy" TEXT,
    "branchId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MachineMovementLog_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_MachineMovementLog" ("action", "createdAt", "details", "id", "machineId", "performedBy", "serialNumber") SELECT "action", "createdAt", "details", "id", "machineId", "performedBy", "serialNumber" FROM "MachineMovementLog";
DROP TABLE "MachineMovementLog";
ALTER TABLE "new_MachineMovementLog" RENAME TO "MachineMovementLog";
CREATE TABLE "new_MachineSale" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serialNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "saleDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "totalPrice" REAL NOT NULL,
    "paidAmount" REAL NOT NULL,
    "status" TEXT NOT NULL,
    "notes" TEXT,
    "branchId" TEXT,
    CONSTRAINT "MachineSale_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MachineSale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("bkcode") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_MachineSale" ("customerId", "id", "notes", "paidAmount", "saleDate", "serialNumber", "status", "totalPrice", "type") SELECT "customerId", "id", "notes", "paidAmount", "saleDate", "serialNumber", "status", "totalPrice", "type" FROM "MachineSale";
DROP TABLE "MachineSale";
ALTER TABLE "new_MachineSale" RENAME TO "MachineSale";
CREATE TABLE "new_MaintenanceRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "posMachineId" TEXT,
    "customerName" TEXT,
    "machineModel" TEXT,
    "machineManufacturer" TEXT,
    "serialNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Open',
    "branchId" TEXT,
    "servicedByBranchId" TEXT,
    "technician" TEXT,
    "notes" TEXT,
    "complaint" TEXT,
    "actionTaken" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closingUserId" TEXT,
    "closingUserName" TEXT,
    "closingTimestamp" DATETIME,
    "usedParts" TEXT,
    "receiptNumber" TEXT,
    "totalCost" REAL DEFAULT 0,
    CONSTRAINT "MaintenanceRequest_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MaintenanceRequest_posMachineId_fkey" FOREIGN KEY ("posMachineId") REFERENCES "PosMachine" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MaintenanceRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("bkcode") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_MaintenanceRequest" ("actionTaken", "closingTimestamp", "closingUserId", "closingUserName", "complaint", "createdAt", "customerId", "customerName", "id", "machineManufacturer", "machineModel", "notes", "posMachineId", "receiptNumber", "serialNumber", "status", "technician", "totalCost", "usedParts") SELECT "actionTaken", "closingTimestamp", "closingUserId", "closingUserName", "complaint", "createdAt", "customerId", "customerName", "id", "machineManufacturer", "machineModel", "notes", "posMachineId", "receiptNumber", "serialNumber", "status", "technician", "totalCost", "usedParts" FROM "MaintenanceRequest";
DROP TABLE "MaintenanceRequest";
ALTER TABLE "new_MaintenanceRequest" RENAME TO "MaintenanceRequest";
CREATE TABLE "new_Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT,
    "customerName" TEXT,
    "requestId" TEXT,
    "amount" REAL NOT NULL,
    "type" TEXT,
    "reason" TEXT,
    "paymentPlace" TEXT,
    "paymentMethod" TEXT,
    "receiptNumber" TEXT,
    "notes" TEXT,
    "userId" TEXT,
    "userName" TEXT,
    "branchId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Payment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("bkcode") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Payment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Payment" ("amount", "createdAt", "customerId", "customerName", "id", "notes", "paymentMethod", "paymentPlace", "reason", "receiptNumber", "requestId", "type", "userId", "userName") SELECT "amount", "createdAt", "customerId", "customerName", "id", "notes", "paymentMethod", "paymentPlace", "reason", "receiptNumber", "requestId", "type", "userId", "userName" FROM "Payment";
DROP TABLE "Payment";
ALTER TABLE "new_Payment" RENAME TO "Payment";
CREATE TABLE "new_PosMachine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serialNumber" TEXT NOT NULL,
    "posId" TEXT,
    "model" TEXT,
    "manufacturer" TEXT,
    "customerId" TEXT,
    "isMain" BOOLEAN DEFAULT false,
    "branchId" TEXT,
    CONSTRAINT "PosMachine_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PosMachine_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("bkcode") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PosMachine" ("customerId", "id", "isMain", "manufacturer", "model", "posId", "serialNumber") SELECT "customerId", "id", "isMain", "manufacturer", "model", "posId", "serialNumber" FROM "PosMachine";
DROP TABLE "PosMachine";
ALTER TABLE "new_PosMachine" RENAME TO "PosMachine";
CREATE UNIQUE INDEX "PosMachine_serialNumber_key" ON "PosMachine"("serialNumber");
CREATE TABLE "new_SimCard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serialNumber" TEXT NOT NULL,
    "type" TEXT,
    "customerId" TEXT,
    "branchId" TEXT,
    CONSTRAINT "SimCard_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SimCard_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("bkcode") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_SimCard" ("customerId", "id", "serialNumber", "type") SELECT "customerId", "id", "serialNumber", "type" FROM "SimCard";
DROP TABLE "SimCard";
ALTER TABLE "new_SimCard" RENAME TO "SimCard";
CREATE UNIQUE INDEX "SimCard_serialNumber_key" ON "SimCard"("serialNumber");
CREATE TABLE "new_StockMovement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT,
    "requestId" TEXT,
    "userId" TEXT,
    "performedBy" TEXT,
    "branchId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockMovement_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_StockMovement" ("createdAt", "id", "partId", "quantity", "reason", "requestId", "type", "userId") SELECT "createdAt", "id", "partId", "quantity", "reason", "requestId", "type", "userId" FROM "StockMovement";
DROP TABLE "StockMovement";
ALTER TABLE "new_StockMovement" RENAME TO "StockMovement";
CREATE TABLE "new_SystemLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "performedBy" TEXT,
    "userId" TEXT,
    "branchId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SystemLog_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_SystemLog" ("action", "createdAt", "details", "entityId", "entityType", "id", "performedBy", "userId") SELECT "action", "createdAt", "details", "entityId", "entityType", "id", "performedBy", "userId" FROM "SystemLog";
DROP TABLE "SystemLog";
ALTER TABLE "new_SystemLog" RENAME TO "SystemLog";
CREATE TABLE "new_UsedPartLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerName" TEXT,
    "posMachineId" TEXT,
    "technician" TEXT,
    "closedByUserId" TEXT,
    "closedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parts" TEXT NOT NULL,
    "receiptNumber" TEXT,
    "branchId" TEXT,
    CONSTRAINT "UsedPartLog_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_UsedPartLog" ("closedAt", "closedByUserId", "customerId", "customerName", "id", "parts", "posMachineId", "receiptNumber", "requestId", "technician") SELECT "closedAt", "closedByUserId", "customerId", "customerName", "id", "parts", "posMachineId", "receiptNumber", "requestId", "technician" FROM "UsedPartLog";
DROP TABLE "UsedPartLog";
ALTER TABLE "new_UsedPartLog" RENAME TO "UsedPartLog";
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "uid" TEXT,
    "email" TEXT,
    "displayName" TEXT,
    "role" TEXT DEFAULT 'CS_AGENT',
    "canDoMaintenance" BOOLEAN NOT NULL DEFAULT false,
    "password" TEXT,
    "theme" TEXT DEFAULT 'light',
    "fontFamily" TEXT DEFAULT 'Inter',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "branchId" TEXT,
    CONSTRAINT "User_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("canDoMaintenance", "createdAt", "displayName", "email", "id", "password", "role", "uid") SELECT "canDoMaintenance", "createdAt", "displayName", "email", "id", "password", "role", "uid" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE TABLE "new_WarehouseMachine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serialNumber" TEXT NOT NULL,
    "model" TEXT,
    "manufacturer" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "resolution" TEXT,
    "notes" TEXT,
    "importDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "originalOwnerId" TEXT,
    "branchId" TEXT,
    "requestId" TEXT,
    "customerId" TEXT,
    "customerName" TEXT,
    "readyForPickup" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "WarehouseMachine_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_WarehouseMachine" ("id", "importDate", "manufacturer", "model", "notes", "originalOwnerId", "serialNumber", "status", "updatedAt") SELECT "id", "importDate", "manufacturer", "model", "notes", "originalOwnerId", "serialNumber", "status", "updatedAt" FROM "WarehouseMachine";
DROP TABLE "WarehouseMachine";
ALTER TABLE "new_WarehouseMachine" RENAME TO "WarehouseMachine";
CREATE UNIQUE INDEX "WarehouseMachine_serialNumber_key" ON "WarehouseMachine"("serialNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "ClientType_name_key" ON "ClientType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_code_key" ON "Branch"("code");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_role_permissionType_permissionKey_key" ON "RolePermission"("role", "permissionType", "permissionKey");

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseSim_serialNumber_key" ON "WarehouseSim"("serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "TransferOrder_orderNumber_key" ON "TransferOrder"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceApproval_requestId_key" ON "MaintenanceApproval"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "RepairVoucher_code_key" ON "RepairVoucher"("code");
