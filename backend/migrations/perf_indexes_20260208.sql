-- Migration: Add Performance Indexes for Query Optimization
-- Created during Code Quality Review to address N+1 query issues

-- 1. WarehouseMachine indexes for maintenance center queries
-- Frequently queried by status and branch for the maintenance dashboard
CREATE INDEX IF NOT EXISTS idx_warehouse_machine_status_branch ON "WarehouseMachine" (status, "branchId");
CREATE INDEX IF NOT EXISTS idx_warehouse_machine_origin_branch ON "WarehouseMachine" ("originBranchId", status);
CREATE INDEX IF NOT EXISTS idx_warehouse_machine_serial ON "WarehouseMachine" ("serialNumber");

-- 2. MaintenanceRequest indexes for branch tracking
-- Used to quickly find requests by branch and serial number
CREATE INDEX IF NOT EXISTS idx_maintenance_request_branch_status ON "MaintenanceRequest" (branchId, status);
CREATE INDEX IF NOT EXISTS idx_maintenance_request_serial ON "MaintenanceRequest" ("serialNumber", branchId);

-- 3. ServiceAssignment indexes for technician workload queries
CREATE INDEX IF NOT EXISTS idx_service_assignment_machine_status ON "ServiceAssignment" ("machineId", status);
CREATE INDEX IF NOT EXISTS idx_service_assignment_center_status ON "ServiceAssignment" ("centerBranchId", status);

-- 4. TransferOrder indexes for transfer workflow
CREATE INDEX IF NOT EXISTS idx_transfer_order_branch_status ON "TransferOrder" ("branchId", status);
CREATE INDEX IF NOT EXISTS idx_transfer_order_from_branch ON "TransferOrder" ("fromBranchId", status);
CREATE INDEX IF NOT EXISTS idx_transfer_order_to_branch ON "TransferOrder" ("toBranchId", status);

-- 5. MachineMovementLog indexes for audit trail queries
CREATE INDEX IF NOT EXISTS idx_movement_log_machine ON "MachineMovementLog" ("machineId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_movement_log_branch ON "MachineMovementLog" ("branchId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_movement_log_serial ON "MachineMovementLog" ("serialNumber", "createdAt" DESC);
