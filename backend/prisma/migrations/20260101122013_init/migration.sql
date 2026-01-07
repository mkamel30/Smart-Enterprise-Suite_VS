-- AlterTable
ALTER TABLE "WarehouseMachine" ADD COLUMN "currentAssignmentId" TEXT;
ALTER TABLE "WarehouseMachine" ADD COLUMN "currentTechnicianId" TEXT;
ALTER TABLE "WarehouseMachine" ADD COLUMN "currentTechnicianName" TEXT;
ALTER TABLE "WarehouseMachine" ADD COLUMN "originBranchId" TEXT;
ALTER TABLE "WarehouseMachine" ADD COLUMN "proposedParts" TEXT;
ALTER TABLE "WarehouseMachine" ADD COLUMN "proposedRepairNotes" TEXT;
ALTER TABLE "WarehouseMachine" ADD COLUMN "proposedTotalCost" REAL DEFAULT 0;
ALTER TABLE "WarehouseMachine" ADD COLUMN "repairNotes" TEXT;
ALTER TABLE "WarehouseMachine" ADD COLUMN "totalCost" REAL DEFAULT 0;
ALTER TABLE "WarehouseMachine" ADD COLUMN "usedParts" TEXT;

-- CreateTable
CREATE TABLE "ServiceAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "machineId" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "technicianName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ASSIGNED',
    "usedParts" TEXT,
    "totalCost" REAL NOT NULL DEFAULT 0,
    "approvalStatus" TEXT,
    "approvalRequestId" TEXT,
    "rejectionFlag" BOOLEAN NOT NULL DEFAULT false,
    "rejectionReason" TEXT,
    "actionTaken" TEXT,
    "resolution" TEXT,
    "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "customerId" TEXT,
    "customerName" TEXT,
    "requestId" TEXT,
    "branchId" TEXT NOT NULL,
    "originBranchId" TEXT NOT NULL,
    CONSTRAINT "ServiceAssignment_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "WarehouseMachine" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ServiceAssignmentLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assignmentId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "performedBy" TEXT NOT NULL,
    "performedById" TEXT,
    "performedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ServiceAssignmentLog_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "ServiceAssignment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PendingPayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assignmentId" TEXT NOT NULL,
    "machineSerial" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "partsDetails" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "centerBranchId" TEXT NOT NULL,
    "targetBranchId" TEXT NOT NULL,
    "receiptNumber" TEXT,
    "paymentPlace" TEXT,
    "paidAt" DATETIME,
    "paidBy" TEXT,
    "paidByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ServiceApprovalRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assignmentId" TEXT,
    "machineSerial" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "requestedParts" TEXT NOT NULL,
    "totalRequestedCost" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "respondedBy" TEXT,
    "respondedById" TEXT,
    "respondedAt" DATETIME,
    "centerBranchId" TEXT NOT NULL,
    "targetBranchId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "uid" TEXT,
    "email" TEXT,
    "displayName" TEXT,
    "role" TEXT DEFAULT 'CS_AGENT',
    "canDoMaintenance" BOOLEAN NOT NULL DEFAULT false,
    "password" TEXT,
    "theme" TEXT DEFAULT 'light',
    "fontFamily" TEXT DEFAULT 'IBM Plex Sans Arabic',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "branchId" TEXT,
    CONSTRAINT "User_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("branchId", "canDoMaintenance", "createdAt", "displayName", "email", "fontFamily", "id", "password", "role", "theme", "uid") SELECT "branchId", "canDoMaintenance", "createdAt", "displayName", "email", "fontFamily", "id", "password", "role", "theme", "uid" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
