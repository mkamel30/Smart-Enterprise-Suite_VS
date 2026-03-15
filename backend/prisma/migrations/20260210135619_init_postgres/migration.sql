-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "branchId" TEXT,
    "passwordChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "loginCount" INTEGER NOT NULL DEFAULT 0,
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mfaSecret" TEXT,
    "mfaRecoveryCodes" TEXT,
    "mfaSetupPending" BOOLEAN NOT NULL DEFAULT false,
    "mfaTempSecret" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "type" TEXT NOT NULL DEFAULT 'BRANCH',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "parentBranchId" TEXT,
    "maintenanceCenterId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "bkcode" TEXT NOT NULL,
    "client_name" TEXT NOT NULL,
    "supply_office" TEXT,
    "operating_date" TIMESTAMP(3),
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
    "papers_date" TIMESTAMP(3),
    "isSpecial" BOOLEAN DEFAULT false,
    "clienttype" TEXT,
    "branchId" TEXT,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MachineParameter" (
    "id" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "manufacturer" TEXT NOT NULL,

    CONSTRAINT "MachineParameter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "permissionType" TEXT NOT NULL,
    "permissionKey" TEXT NOT NULL,
    "isAllowed" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SparePart" (
    "id" TEXT NOT NULL,
    "partNumber" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "compatibleModels" TEXT,
    "defaultCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isConsumable" BOOLEAN DEFAULT false,
    "allowsMultiple" BOOLEAN DEFAULT false,

    CONSTRAINT "SparePart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "minLevel" INTEGER NOT NULL DEFAULT 0,
    "location" TEXT,
    "branchId" TEXT,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceRequest" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closingUserId" TEXT,
    "closingUserName" TEXT,
    "closingTimestamp" TIMESTAMP(3),
    "usedParts" TEXT,
    "receiptNumber" TEXT,
    "totalCost" DOUBLE PRECISION DEFAULT 0,

    CONSTRAINT "MaintenanceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceChangeLog" (
    "id" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "oldCost" DOUBLE PRECISION NOT NULL,
    "newCost" DOUBLE PRECISION NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,

    CONSTRAINT "PriceChangeLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsedPartLog" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerName" TEXT,
    "posMachineId" TEXT,
    "technician" TEXT,
    "closedByUserId" TEXT,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parts" TEXT NOT NULL,
    "receiptNumber" TEXT,
    "branchId" TEXT,

    CONSTRAINT "UsedPartLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT,
    "requestId" TEXT,
    "userId" TEXT,
    "performedBy" TEXT,
    "branchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "customerId" TEXT,
    "customerName" TEXT,
    "requestId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "type" TEXT,
    "reason" TEXT,
    "paymentPlace" TEXT,
    "paymentMethod" TEXT,
    "receiptNumber" TEXT,
    "notes" TEXT,
    "userId" TEXT,
    "userName" TEXT,
    "branchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MachineMovementLog" (
    "id" TEXT NOT NULL,
    "machineId" TEXT,
    "serialNumber" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "performedBy" TEXT,
    "branchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MachineMovementLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemLog" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "performedBy" TEXT,
    "userId" TEXT,
    "branchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Installment" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),
    "description" TEXT,
    "paidAmount" DOUBLE PRECISION,
    "paymentPlace" TEXT,
    "receiptNumber" TEXT,
    "branchId" TEXT,

    CONSTRAINT "Installment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MachineSale" (
    "id" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "saleDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "totalPrice" DOUBLE PRECISION NOT NULL,
    "paidAmount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,
    "notes" TEXT,
    "branchId" TEXT,

    CONSTRAINT "MachineSale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosMachine" (
    "id" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "posId" TEXT,
    "model" TEXT,
    "manufacturer" TEXT,
    "customerId" TEXT,
    "isMain" BOOLEAN DEFAULT false,
    "branchId" TEXT,

    CONSTRAINT "PosMachine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimCard" (
    "id" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "type" TEXT,
    "customerId" TEXT,
    "branchId" TEXT,

    CONSTRAINT "SimCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarehouseMachine" (
    "id" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "model" TEXT,
    "manufacturer" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "resolution" TEXT,
    "notes" TEXT,
    "complaint" TEXT,
    "importDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "originalOwnerId" TEXT,
    "branchId" TEXT,
    "requestId" TEXT,
    "customerId" TEXT,
    "customerName" TEXT,
    "readyForPickup" BOOLEAN NOT NULL DEFAULT false,
    "currentAssignmentId" TEXT,
    "currentTechnicianId" TEXT,
    "currentTechnicianName" TEXT,
    "originBranchId" TEXT,
    "proposedParts" TEXT,
    "proposedRepairNotes" TEXT,
    "proposedTotalCost" DOUBLE PRECISION DEFAULT 0,
    "repairNotes" TEXT,
    "totalCost" DOUBLE PRECISION DEFAULT 0,
    "usedParts" TEXT,

    CONSTRAINT "WarehouseMachine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarehouseSim" (
    "id" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "type" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "importDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "branchId" TEXT,

    CONSTRAINT "WarehouseSim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimMovementLog" (
    "id" TEXT NOT NULL,
    "simId" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "performedBy" TEXT,
    "branchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SimMovementLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransferOrder" (
    "id" TEXT NOT NULL,
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
    "receivedAt" TIMESTAMP(3),
    "receivedBy" TEXT,
    "receivedByName" TEXT,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransferOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransferOrderItem" (
    "id" TEXT NOT NULL,
    "transferOrderId" TEXT NOT NULL,
    "serialNumber" TEXT,
    "type" TEXT,
    "model" TEXT,
    "manufacturer" TEXT,
    "isReceived" BOOLEAN NOT NULL DEFAULT false,
    "receivedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "TransferOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceApproval" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL,
    "parts" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "branchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "respondedBy" TEXT,

    CONSTRAINT "MaintenanceApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepairVoucher" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "parts" TEXT NOT NULL,
    "totalCost" DOUBLE PRECISION NOT NULL,
    "branchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "RepairVoucher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "branchId" TEXT,
    "link" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceAssignment" (
    "id" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "technicianName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNDER_MAINTENANCE',
    "proposedParts" TEXT,
    "proposedTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "usedParts" TEXT,
    "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "needsApproval" BOOLEAN NOT NULL DEFAULT false,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "actionTaken" TEXT,
    "resolution" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "customerId" TEXT,
    "customerName" TEXT,
    "requestId" TEXT,
    "branchId" TEXT,
    "centerBranchId" TEXT,
    "originBranchId" TEXT NOT NULL,

    CONSTRAINT "ServiceAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceAssignmentLog" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "performedBy" TEXT NOT NULL,
    "performedById" TEXT,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceAssignmentLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BranchDebt" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "machineSerial" TEXT,
    "customerId" TEXT,
    "customerName" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "remainingAmount" DOUBLE PRECISION NOT NULL,
    "partsDetails" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "creditorBranchId" TEXT NOT NULL,
    "debtorBranchId" TEXT NOT NULL,
    "receiptNumber" TEXT,
    "paymentPlace" TEXT,
    "paidAt" TIMESTAMP(3),
    "paidBy" TEXT,
    "paidByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BranchDebt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceApprovalRequest" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "machineSerial" TEXT NOT NULL,
    "customerId" TEXT,
    "customerName" TEXT NOT NULL,
    "proposedParts" TEXT NOT NULL,
    "proposedTotal" DOUBLE PRECISION NOT NULL,
    "diagnosis" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "respondedBy" TEXT,
    "respondedById" TEXT,
    "respondedAt" TIMESTAMP(3),
    "centerBranchId" TEXT NOT NULL,
    "originBranchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaintenanceApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountLockout" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lastFailedAttempt" TIMESTAMP(3),
    "lockedUntil" TIMESTAMP(3),

    CONSTRAINT "AccountLockout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClientType_name_key" ON "ClientType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_code_key" ON "Branch"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_bkcode_branchId_key" ON "Customer"("bkcode", "branchId");

-- CreateIndex
CREATE UNIQUE INDEX "MachineParameter_prefix_key" ON "MachineParameter"("prefix");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_role_permissionType_permissionKey_key" ON "RolePermission"("role", "permissionType", "permissionKey");

-- CreateIndex
CREATE UNIQUE INDEX "PosMachine_serialNumber_key" ON "PosMachine"("serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SimCard_serialNumber_key" ON "SimCard"("serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseMachine_serialNumber_key" ON "WarehouseMachine"("serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseSim_serialNumber_key" ON "WarehouseSim"("serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "TransferOrder_orderNumber_key" ON "TransferOrder"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceApproval_requestId_key" ON "MaintenanceApproval"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "RepairVoucher_code_key" ON "RepairVoucher"("code");

-- CreateIndex
CREATE INDEX "ServiceAssignment_machineId_status_idx" ON "ServiceAssignment"("machineId", "status");

-- CreateIndex
CREATE INDEX "ServiceAssignment_centerBranchId_status_idx" ON "ServiceAssignment"("centerBranchId", "status");

-- CreateIndex
CREATE INDEX "ServiceAssignment_originBranchId_status_idx" ON "ServiceAssignment"("originBranchId", "status");

-- CreateIndex
CREATE INDEX "ServiceAssignmentLog_assignmentId_performedAt_idx" ON "ServiceAssignmentLog"("assignmentId", "performedAt");

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
CREATE INDEX "PasswordHistory_userId_idx" ON "PasswordHistory"("userId");

-- CreateIndex
CREATE INDEX "PasswordHistory_createdAt_idx" ON "PasswordHistory"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AccountLockout_userId_key" ON "AccountLockout"("userId");

-- CreateIndex
CREATE INDEX "AccountLockout_userId_idx" ON "AccountLockout"("userId");

-- CreateIndex
CREATE INDEX "AccountLockout_lockedUntil_idx" ON "AccountLockout"("lockedUntil");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_maintenanceCenterId_fkey" FOREIGN KEY ("maintenanceCenterId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_parentBranchId_fkey" FOREIGN KEY ("parentBranchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_partId_fkey" FOREIGN KEY ("partId") REFERENCES "SparePart"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_posMachineId_fkey" FOREIGN KEY ("posMachineId") REFERENCES "PosMachine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsedPartLog" ADD CONSTRAINT "UsedPartLog_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineMovementLog" ADD CONSTRAINT "MachineMovementLog_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemLog" ADD CONSTRAINT "SystemLog_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Installment" ADD CONSTRAINT "Installment_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "MachineSale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Installment" ADD CONSTRAINT "Installment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineSale" ADD CONSTRAINT "MachineSale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineSale" ADD CONSTRAINT "MachineSale_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosMachine" ADD CONSTRAINT "PosMachine_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosMachine" ADD CONSTRAINT "PosMachine_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimCard" ADD CONSTRAINT "SimCard_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimCard" ADD CONSTRAINT "SimCard_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseMachine" ADD CONSTRAINT "WarehouseMachine_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseSim" ADD CONSTRAINT "WarehouseSim_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimMovementLog" ADD CONSTRAINT "SimMovementLog_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferOrder" ADD CONSTRAINT "TransferOrder_toBranchId_fkey" FOREIGN KEY ("toBranchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferOrder" ADD CONSTRAINT "TransferOrder_fromBranchId_fkey" FOREIGN KEY ("fromBranchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferOrderItem" ADD CONSTRAINT "TransferOrderItem_transferOrderId_fkey" FOREIGN KEY ("transferOrderId") REFERENCES "TransferOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceApproval" ADD CONSTRAINT "MaintenanceApproval_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceApproval" ADD CONSTRAINT "MaintenanceApproval_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MaintenanceRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairVoucher" ADD CONSTRAINT "RepairVoucher_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairVoucher" ADD CONSTRAINT "RepairVoucher_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MaintenanceRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceAssignment" ADD CONSTRAINT "ServiceAssignment_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "WarehouseMachine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceAssignmentLog" ADD CONSTRAINT "ServiceAssignmentLog_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "ServiceAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordHistory" ADD CONSTRAINT "PasswordHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountLockout" ADD CONSTRAINT "AccountLockout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
