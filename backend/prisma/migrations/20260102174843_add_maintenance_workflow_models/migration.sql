/*
  Warnings:

  - You are about to drop the `PendingPayment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ServiceApprovalRequest` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `approvalRequestId` on the `ServiceAssignment` table. All the data in the column will be lost.
  - You are about to drop the column `approvalStatus` on the `ServiceAssignment` table. All the data in the column will be lost.
  - You are about to drop the column `rejectionFlag` on the `ServiceAssignment` table. All the data in the column will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "PendingPayment";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "ServiceApprovalRequest";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "BranchDebt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "machineSerial" TEXT,
    "customerId" TEXT,
    "customerName" TEXT,
    "amount" REAL NOT NULL,
    "paidAmount" REAL NOT NULL DEFAULT 0,
    "remainingAmount" REAL NOT NULL,
    "partsDetails" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "creditorBranchId" TEXT NOT NULL,
    "debtorBranchId" TEXT NOT NULL,
    "receiptNumber" TEXT,
    "paymentPlace" TEXT,
    "paidAt" DATETIME,
    "paidBy" TEXT,
    "paidByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MaintenanceApprovalRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assignmentId" TEXT NOT NULL,
    "machineSerial" TEXT NOT NULL,
    "customerId" TEXT,
    "customerName" TEXT NOT NULL,
    "proposedParts" TEXT NOT NULL,
    "proposedTotal" REAL NOT NULL,
    "diagnosis" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "respondedBy" TEXT,
    "respondedById" TEXT,
    "respondedAt" DATETIME,
    "centerBranchId" TEXT NOT NULL,
    "originBranchId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ServiceAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "machineId" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "technicianName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNDER_MAINTENANCE',
    "proposedParts" TEXT,
    "proposedTotal" REAL NOT NULL DEFAULT 0,
    "usedParts" TEXT,
    "totalCost" REAL NOT NULL DEFAULT 0,
    "needsApproval" BOOLEAN NOT NULL DEFAULT false,
    "approvedAt" DATETIME,
    "rejectedAt" DATETIME,
    "rejectionReason" TEXT,
    "actionTaken" TEXT,
    "resolution" TEXT,
    "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "customerId" TEXT,
    "customerName" TEXT,
    "requestId" TEXT,
    "branchId" TEXT,
    "centerBranchId" TEXT,
    "originBranchId" TEXT NOT NULL,
    CONSTRAINT "ServiceAssignment_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "WarehouseMachine" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ServiceAssignment" ("actionTaken", "assignedAt", "branchId", "completedAt", "customerId", "customerName", "id", "machineId", "originBranchId", "rejectionReason", "requestId", "resolution", "serialNumber", "startedAt", "status", "technicianId", "technicianName", "totalCost", "usedParts") SELECT "actionTaken", "assignedAt", "branchId", "completedAt", "customerId", "customerName", "id", "machineId", "originBranchId", "rejectionReason", "requestId", "resolution", "serialNumber", "startedAt", "status", "technicianId", "technicianName", "totalCost", "usedParts" FROM "ServiceAssignment";
DROP TABLE "ServiceAssignment";
ALTER TABLE "new_ServiceAssignment" RENAME TO "ServiceAssignment";
CREATE INDEX "ServiceAssignment_machineId_status_idx" ON "ServiceAssignment"("machineId", "status");
CREATE INDEX "ServiceAssignment_centerBranchId_status_idx" ON "ServiceAssignment"("centerBranchId", "status");
CREATE INDEX "ServiceAssignment_originBranchId_status_idx" ON "ServiceAssignment"("originBranchId", "status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "BranchDebt_debtorBranchId_status_idx" ON "BranchDebt"("debtorBranchId", "status");

-- CreateIndex
CREATE INDEX "BranchDebt_creditorBranchId_status_idx" ON "BranchDebt"("creditorBranchId", "status");

-- CreateIndex
CREATE INDEX "BranchDebt_type_referenceId_idx" ON "BranchDebt"("type", "referenceId");

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceApprovalRequest_assignmentId_key" ON "MaintenanceApprovalRequest"("assignmentId");

-- CreateIndex
CREATE INDEX "MaintenanceApprovalRequest_centerBranchId_status_idx" ON "MaintenanceApprovalRequest"("centerBranchId", "status");

-- CreateIndex
CREATE INDEX "MaintenanceApprovalRequest_originBranchId_status_idx" ON "MaintenanceApprovalRequest"("originBranchId", "status");

-- CreateIndex
CREATE INDEX "ServiceAssignmentLog_assignmentId_performedAt_idx" ON "ServiceAssignmentLog"("assignmentId", "performedAt");
