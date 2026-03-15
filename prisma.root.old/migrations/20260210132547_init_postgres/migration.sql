-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "uid" TEXT,
    "email" TEXT,
    "displayName" TEXT,
    "role" TEXT DEFAULT 'Technician',
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "passwordChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "loginCount" INTEGER NOT NULL DEFAULT 0,
    "branchId" TEXT,
    "theme" TEXT,
    "fontFamily" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Branch" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "type" TEXT NOT NULL DEFAULT 'BRANCH',
    "parentBranchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Customer" (
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
    "branchId" TEXT,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ClientPos" (
    "id" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "posId" TEXT,
    "model" TEXT,
    "manufacturer" TEXT,
    "customerId" TEXT,
    "isMain" BOOLEAN DEFAULT false,

    CONSTRAINT "ClientPos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ClientSimCard" (
    "id" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "type" TEXT,
    "customerId" TEXT,

    CONSTRAINT "ClientSimCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MachineParameter" (
    "id" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "manufacturer" TEXT NOT NULL,

    CONSTRAINT "MachineParameter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SparePart" (
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
CREATE TABLE "public"."InventoryItem" (
    "id" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "minLevel" INTEGER NOT NULL DEFAULT 0,
    "location" TEXT,
    "branchId" TEXT,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MaintenanceRequest" (
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
    "technician" TEXT,
    "notes" TEXT,
    "complaint" TEXT,
    "actionTaken" TEXT,
    "priority" TEXT,
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
CREATE TABLE "public"."TransferOrder" (
    "id" TEXT NOT NULL,
    "waybillNumber" TEXT,
    "fromBranchId" TEXT NOT NULL,
    "toBranchId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "type" TEXT NOT NULL,
    "driverName" TEXT,
    "driverPhone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdByUserId" TEXT,
    "receivedByUserId" TEXT,
    "notes" TEXT,
    "receivedAt" TIMESTAMP(3),
    "receivedBy" TEXT,
    "receivedByName" TEXT,
    "rejectionReason" TEXT,
    "orderNumber" TEXT NOT NULL,

    CONSTRAINT "TransferOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TransferOrderItem" (
    "id" TEXT NOT NULL,
    "transferOrderId" TEXT NOT NULL,
    "serialNumber" TEXT,
    "type" TEXT,
    "manufacturer" TEXT,
    "isReceived" BOOLEAN NOT NULL DEFAULT false,
    "receivedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "TransferOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PriceChangeLog" (
    "id" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "oldCost" DOUBLE PRECISION NOT NULL,
    "newCost" DOUBLE PRECISION NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,

    CONSTRAINT "PriceChangeLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UsedPartLog" (
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

    CONSTRAINT "UsedPartLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StockMovement" (
    "id" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT,
    "requestId" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "branchId" TEXT,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Payment" (
    "id" TEXT NOT NULL,
    "customerId" TEXT,
    "customerName" TEXT,
    "requestId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "paymentPlace" TEXT NOT NULL,
    "receiptNumber" TEXT,
    "notes" TEXT,
    "userId" TEXT,
    "userName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "branchId" TEXT,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MachineMovementLog" (
    "id" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "performedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MachineMovementLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SystemLog" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "performedBy" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MaintenanceApproval" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL,
    "parts" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "respondedBy" TEXT,

    CONSTRAINT "MaintenanceApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RepairVoucher" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "parts" TEXT NOT NULL,
    "totalCost" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "RepairVoucher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PasswordHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AccountLockout" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lastFailedAttempt" TIMESTAMP(3),
    "lockedUntil" TIMESTAMP(3),

    CONSTRAINT "AccountLockout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Branch_code_key" ON "public"."Branch"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_bkcode_key" ON "public"."Customer"("bkcode");

-- CreateIndex
CREATE UNIQUE INDEX "ClientPos_serialNumber_key" ON "public"."ClientPos"("serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ClientSimCard_serialNumber_key" ON "public"."ClientSimCard"("serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "MachineParameter_prefix_key" ON "public"."MachineParameter"("prefix");

-- CreateIndex
CREATE INDEX "MaintenanceRequest_customerId_idx" ON "public"."MaintenanceRequest"("customerId");

-- CreateIndex
CREATE INDEX "MaintenanceRequest_status_idx" ON "public"."MaintenanceRequest"("status");

-- CreateIndex
CREATE INDEX "MaintenanceRequest_branchId_idx" ON "public"."MaintenanceRequest"("branchId");

-- CreateIndex
CREATE INDEX "MaintenanceRequest_createdAt_idx" ON "public"."MaintenanceRequest"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TransferOrder_orderNumber_key" ON "public"."TransferOrder"("orderNumber");

-- CreateIndex
CREATE INDEX "TransferOrder_fromBranchId_idx" ON "public"."TransferOrder"("fromBranchId");

-- CreateIndex
CREATE INDEX "TransferOrder_toBranchId_idx" ON "public"."TransferOrder"("toBranchId");

-- CreateIndex
CREATE INDEX "TransferOrder_status_idx" ON "public"."TransferOrder"("status");

-- CreateIndex
CREATE INDEX "TransferOrder_createdAt_idx" ON "public"."TransferOrder"("createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_partId_idx" ON "public"."StockMovement"("partId");

-- CreateIndex
CREATE INDEX "StockMovement_branchId_idx" ON "public"."StockMovement"("branchId");

-- CreateIndex
CREATE INDEX "StockMovement_createdAt_idx" ON "public"."StockMovement"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceApproval_requestId_key" ON "public"."MaintenanceApproval"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "RepairVoucher_code_key" ON "public"."RepairVoucher"("code");

-- CreateIndex
CREATE INDEX "PasswordHistory_userId_idx" ON "public"."PasswordHistory"("userId");

-- CreateIndex
CREATE INDEX "PasswordHistory_createdAt_idx" ON "public"."PasswordHistory"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AccountLockout_userId_key" ON "public"."AccountLockout"("userId");

-- CreateIndex
CREATE INDEX "AccountLockout_userId_idx" ON "public"."AccountLockout"("userId");

-- CreateIndex
CREATE INDEX "AccountLockout_lockedUntil_idx" ON "public"."AccountLockout"("lockedUntil");

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Branch" ADD CONSTRAINT "Branch_parentBranchId_fkey" FOREIGN KEY ("parentBranchId") REFERENCES "public"."Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Customer" ADD CONSTRAINT "Customer_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClientPos" ADD CONSTRAINT "ClientPos_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("bkcode") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClientSimCard" ADD CONSTRAINT "ClientSimCard_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("bkcode") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InventoryItem" ADD CONSTRAINT "InventoryItem_partId_fkey" FOREIGN KEY ("partId") REFERENCES "public"."SparePart"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InventoryItem" ADD CONSTRAINT "InventoryItem_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("bkcode") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_posMachineId_fkey" FOREIGN KEY ("posMachineId") REFERENCES "public"."ClientPos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TransferOrder" ADD CONSTRAINT "TransferOrder_fromBranchId_fkey" FOREIGN KEY ("fromBranchId") REFERENCES "public"."Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TransferOrder" ADD CONSTRAINT "TransferOrder_toBranchId_fkey" FOREIGN KEY ("toBranchId") REFERENCES "public"."Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TransferOrderItem" ADD CONSTRAINT "TransferOrderItem_transferOrderId_fkey" FOREIGN KEY ("transferOrderId") REFERENCES "public"."TransferOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MaintenanceApproval" ADD CONSTRAINT "MaintenanceApproval_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "public"."MaintenanceRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RepairVoucher" ADD CONSTRAINT "RepairVoucher_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "public"."MaintenanceRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PasswordHistory" ADD CONSTRAINT "PasswordHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AccountLockout" ADD CONSTRAINT "AccountLockout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
