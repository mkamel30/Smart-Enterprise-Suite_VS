/*
  Warnings:

  - A unique constraint covering the columns `[bkcode,branchId]` on the table `Customer` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Customer_bkcode_key";

-- AlterTable
ALTER TABLE "WarehouseMachine" ADD COLUMN "complaint" TEXT;

-- CreateTable
CREATE TABLE "PasswordHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PasswordHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AccountLockout" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lastFailedAttempt" DATETIME,
    "lockedUntil" DATETIME,
    CONSTRAINT "AccountLockout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    CONSTRAINT "MachineSale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MachineSale_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_MachineSale" ("branchId", "customerId", "id", "notes", "paidAmount", "saleDate", "serialNumber", "status", "totalPrice", "type") SELECT "branchId", "customerId", "id", "notes", "paidAmount", "saleDate", "serialNumber", "status", "totalPrice", "type" FROM "MachineSale";
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
    "technicianId" TEXT,
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
    CONSTRAINT "MaintenanceRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MaintenanceRequest_posMachineId_fkey" FOREIGN KEY ("posMachineId") REFERENCES "PosMachine" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MaintenanceRequest_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_MaintenanceRequest" ("actionTaken", "branchId", "closingTimestamp", "closingUserId", "closingUserName", "complaint", "createdAt", "customerId", "customerName", "id", "machineManufacturer", "machineModel", "notes", "posMachineId", "receiptNumber", "serialNumber", "servicedByBranchId", "status", "technician", "totalCost", "usedParts") SELECT "actionTaken", "branchId", "closingTimestamp", "closingUserId", "closingUserName", "complaint", "createdAt", "customerId", "customerName", "id", "machineManufacturer", "machineModel", "notes", "posMachineId", "receiptNumber", "serialNumber", "servicedByBranchId", "status", "technician", "totalCost", "usedParts" FROM "MaintenanceRequest";
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
    CONSTRAINT "Payment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Payment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Payment" ("amount", "branchId", "createdAt", "customerId", "customerName", "id", "notes", "paymentMethod", "paymentPlace", "reason", "receiptNumber", "requestId", "type", "userId", "userName") SELECT "amount", "branchId", "createdAt", "customerId", "customerName", "id", "notes", "paymentMethod", "paymentPlace", "reason", "receiptNumber", "requestId", "type", "userId", "userName" FROM "Payment";
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
    CONSTRAINT "PosMachine_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PosMachine_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PosMachine" ("branchId", "customerId", "id", "isMain", "manufacturer", "model", "posId", "serialNumber") SELECT "branchId", "customerId", "id", "isMain", "manufacturer", "model", "posId", "serialNumber" FROM "PosMachine";
DROP TABLE "PosMachine";
ALTER TABLE "new_PosMachine" RENAME TO "PosMachine";
CREATE UNIQUE INDEX "PosMachine_serialNumber_key" ON "PosMachine"("serialNumber");
CREATE TABLE "new_SimCard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serialNumber" TEXT NOT NULL,
    "type" TEXT,
    "customerId" TEXT,
    "branchId" TEXT,
    CONSTRAINT "SimCard_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SimCard_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_SimCard" ("branchId", "customerId", "id", "serialNumber", "type") SELECT "branchId", "customerId", "id", "serialNumber", "type" FROM "SimCard";
DROP TABLE "SimCard";
ALTER TABLE "new_SimCard" RENAME TO "SimCard";
CREATE UNIQUE INDEX "SimCard_serialNumber_key" ON "SimCard"("serialNumber");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "uid" TEXT,
    "email" TEXT,
    "displayName" TEXT,
    "role" TEXT DEFAULT 'CS_AGENT',
    "canDoMaintenance" BOOLEAN NOT NULL DEFAULT false,
    "password" TEXT,
    "theme" TEXT DEFAULT 'light',
    "fontFamily" TEXT DEFAULT 'sans-serif',
    "fontSize" TEXT DEFAULT 'medium',
    "highlightEffect" BOOLEAN NOT NULL DEFAULT true,
    "notificationSound" BOOLEAN NOT NULL DEFAULT true,
    "mobilePush" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "branchId" TEXT,
    "passwordChangedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" DATETIME,
    "loginCount" INTEGER NOT NULL DEFAULT 0,
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mfaSecret" TEXT,
    "mfaRecoveryCodes" TEXT,
    "mfaSetupPending" BOOLEAN NOT NULL DEFAULT false,
    "mfaTempSecret" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "User_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("branchId", "canDoMaintenance", "createdAt", "displayName", "email", "fontFamily", "fontSize", "highlightEffect", "id", "lastLoginAt", "loginCount", "mfaEnabled", "mfaRecoveryCodes", "mfaSecret", "mfaSetupPending", "mfaTempSecret", "mobilePush", "mustChangePassword", "notificationSound", "password", "passwordChangedAt", "role", "theme", "uid") SELECT "branchId", "canDoMaintenance", "createdAt", "displayName", "email", "fontFamily", "fontSize", "highlightEffect", "id", "lastLoginAt", coalesce("loginCount", 0) AS "loginCount", coalesce("mfaEnabled", false) AS "mfaEnabled", "mfaRecoveryCodes", "mfaSecret", coalesce("mfaSetupPending", false) AS "mfaSetupPending", "mfaTempSecret", "mobilePush", coalesce("mustChangePassword", false) AS "mustChangePassword", "notificationSound", "password", coalesce("passwordChangedAt", CURRENT_TIMESTAMP) AS "passwordChangedAt", "role", "theme", "uid" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "PasswordHistory_userId_idx" ON "PasswordHistory"("userId");

-- CreateIndex
CREATE INDEX "PasswordHistory_createdAt_idx" ON "PasswordHistory"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AccountLockout_userId_key" ON "AccountLockout"("userId");

-- CreateIndex
CREATE INDEX "AccountLockout_userId_idx" ON "AccountLockout"("userId");

-- CreateIndex
CREATE INDEX "AccountLockout_lockedUntil_idx" ON "AccountLockout"("lockedUntil");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_bkcode_branchId_key" ON "Customer"("bkcode", "branchId");
