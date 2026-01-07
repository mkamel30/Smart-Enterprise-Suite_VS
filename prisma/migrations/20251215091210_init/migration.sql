-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "uid" TEXT,
    "email" TEXT,
    "displayName" TEXT,
    "role" TEXT DEFAULT 'Technician',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Customer" (
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
    "isSpecial" BOOLEAN DEFAULT false
);

-- CreateTable
CREATE TABLE "PosMachine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serialNumber" TEXT NOT NULL,
    "posId" TEXT,
    "model" TEXT,
    "manufacturer" TEXT,
    "customerId" TEXT,
    "isMain" BOOLEAN DEFAULT false,
    CONSTRAINT "PosMachine_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("bkcode") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SimCard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serialNumber" TEXT NOT NULL,
    "type" TEXT,
    "customerId" TEXT,
    CONSTRAINT "SimCard_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("bkcode") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MachineParameter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "prefix" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "manufacturer" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "SparePart" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partNumber" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "compatibleModels" TEXT,
    "defaultCost" REAL NOT NULL DEFAULT 0,
    "isConsumable" BOOLEAN DEFAULT false,
    "allowsMultiple" BOOLEAN DEFAULT false
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "minLevel" INTEGER NOT NULL DEFAULT 0,
    "location" TEXT,
    CONSTRAINT "InventoryItem_partId_fkey" FOREIGN KEY ("partId") REFERENCES "SparePart" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MaintenanceRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "posMachineId" TEXT,
    "customerName" TEXT,
    "machineModel" TEXT,
    "machineManufacturer" TEXT,
    "serialNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Open',
    "priority" TEXT NOT NULL DEFAULT 'Medium',
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
    CONSTRAINT "MaintenanceRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("bkcode") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MaintenanceRequest_posMachineId_fkey" FOREIGN KEY ("posMachineId") REFERENCES "PosMachine" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PriceChangeLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partId" TEXT NOT NULL,
    "oldCost" REAL NOT NULL,
    "newCost" REAL NOT NULL,
    "changedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT
);

-- CreateTable
CREATE TABLE "UsedPartLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerName" TEXT,
    "posMachineId" TEXT,
    "technician" TEXT,
    "closedByUserId" TEXT,
    "closedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parts" TEXT NOT NULL,
    "receiptNumber" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "Customer_bkcode_key" ON "Customer"("bkcode");

-- CreateIndex
CREATE UNIQUE INDEX "PosMachine_serialNumber_key" ON "PosMachine"("serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SimCard_serialNumber_key" ON "SimCard"("serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "MachineParameter_prefix_key" ON "MachineParameter"("prefix");
