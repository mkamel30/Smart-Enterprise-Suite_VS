/*
  Warnings:

  - You are about to drop the column `priority` on the `MaintenanceRequest` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT,
    "requestId" TEXT,
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Payment" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "WarehouseMachine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serialNumber" TEXT NOT NULL,
    "model" TEXT,
    "manufacturer" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "originalOwnerId" TEXT,
    "notes" TEXT,
    "importDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MachineMovementLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "machineId" TEXT,
    "serialNumber" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "performedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "MachineSale" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serialNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "saleDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "totalPrice" REAL NOT NULL,
    "paidAmount" REAL NOT NULL,
    "status" TEXT NOT NULL,
    "notes" TEXT,
    CONSTRAINT "MachineSale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("bkcode") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Installment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saleId" TEXT NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "amount" REAL NOT NULL,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" DATETIME,
    "paidAmount" REAL,
    "receiptNumber" TEXT,
    "paymentPlace" TEXT,
    "description" TEXT,
    CONSTRAINT "Installment_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "MachineSale" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SystemLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "performedBy" TEXT,
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MaintenanceRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "posMachineId" TEXT,
    "customerName" TEXT,
    "machineModel" TEXT,
    "machineManufacturer" TEXT,
    "serialNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Open',
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
    CONSTRAINT "MaintenanceRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("bkcode") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MaintenanceRequest_posMachineId_fkey" FOREIGN KEY ("posMachineId") REFERENCES "PosMachine" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_MaintenanceRequest" ("actionTaken", "closingTimestamp", "closingUserId", "closingUserName", "complaint", "createdAt", "customerId", "customerName", "id", "machineManufacturer", "machineModel", "notes", "posMachineId", "receiptNumber", "serialNumber", "status", "technician", "usedParts") SELECT "actionTaken", "closingTimestamp", "closingUserId", "closingUserName", "complaint", "createdAt", "customerId", "customerName", "id", "machineManufacturer", "machineModel", "notes", "posMachineId", "receiptNumber", "serialNumber", "status", "technician", "usedParts" FROM "MaintenanceRequest";
DROP TABLE "MaintenanceRequest";
ALTER TABLE "new_MaintenanceRequest" RENAME TO "MaintenanceRequest";
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "uid" TEXT,
    "email" TEXT,
    "displayName" TEXT,
    "role" TEXT DEFAULT 'Technician',
    "canDoMaintenance" BOOLEAN NOT NULL DEFAULT false,
    "password" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_User" ("createdAt", "displayName", "email", "id", "role", "uid") SELECT "createdAt", "displayName", "email", "id", "role", "uid" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseMachine_serialNumber_key" ON "WarehouseMachine"("serialNumber");
