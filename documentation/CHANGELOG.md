# CHANGELOG

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.2.0] - 2026-01-13
### Changed
- **Admin Affairs Dashboard Redesign**:
  - Implemented a specialized **3-column grid layout** (3x2) for the `ADMIN_AFFAIRS` role.
  - Eliminated negative space by aligning 6 key widgets: Machines, SIMs, Pending Transfers, Low Stock Count, Request Status Pie Chart, and Low Stock List.
  - Removed "Maintenance Performance Report" button and "Revenue/Activity" charts from this specific view to focus on inventory operations.
- **Role-Based Access Control**:
  - Restricted `ADMIN_AFFAIRS` role from accessing the `/reports` route (Reports Page).
  - Updated `MENU_PERMISSIONS` to enforce this restriction at the application level.

### Added
- **Dashboard Widget Restoration**:
  - Restored "Requests Status" (Pie Chart) for Admin Affairs within the new grid layout to ensure complete operational visibility.

## [3.1.0] - 2026-01-02
### Added
- **🛡️ Transfer Order Validation System**: نظام حماية شامل لعمليات التحويل
  - Created `backend/utils/transfer-validators.js` with comprehensive validation functions
  - `validateItemsForTransfer()`: Validates machines/SIMs availability and status
  - `validateBranches()`: Validates source/destination branches
  - `validateUserPermission()`: Validates user permissions for transfers
  - `validateTransferOrder()`: Complete validation orchestration
  - Support for both MACHINE and SIM transfers
  - Detailed Arabic error messages for all validation failures

- **🔔 Notification Navigation System**: نظام توجيه المستخدم من الإشعارات
  - All notifications now include `link` field for direct navigation
  - Click notification → Auto-navigate to related page with context
  - Transfer Orders: Navigate to `/receive-orders?orderId=xxx` (incoming) or `/transfer-orders?orderId=xxx` (sent/rejected)
  - Maintenance Assignments: Navigate to `/maintenance/shipments`
  - Maintenance Approvals: Navigate to `/maintenance-approvals`
  - Pending Payments: Navigate to `/pending-payments`
  - Auto-highlighting and auto-opening of specific records from notification context
  - Enhanced UX: Users can access specific transactions directly from notification bell

### Changed
- **Enhanced Transfer Service** (`backend/services/transferService.js`):
  - Integrated comprehensive validation in `createTransferOrder()`
  - Added validation to `createBulkTransfer()` for maintenance transfers
  - Auto-freeze items by setting status to `IN_TRANSIT` during transfer creation
  - Prevents duplicate transfers across ALL branches (not just source branch)

- **Status Protection** - Warehouse Routes:
  - `backend/routes/warehouse-machines.js`: Blocked manual status change to `IN_TRANSIT`
  - `backend/routes/warehouseSims.js`: Blocked manual status change to `IN_TRANSIT`
  - Status can only be set to `IN_TRANSIT` through official transfer orders

### Security
- **Transfer Validation Rules**:
  - ✅ Prevents transferring items already in pending transfers (ANY branch)
  - ✅ Prevents transferring items with status: `IN_TRANSIT`, `SOLD`, `ASSIGNED`, `UNDER_MAINTENANCE`
  - ✅ Validates items exist in source branch
  - ✅ Validates user has permission to transfer from source branch
  - ✅ Prevents transfer to same branch
  - ✅ Validates branches are active and exist
  - ✅ Validates maintenance center type for maintenance transfers
  - ✅ Prevents manual status manipulation to bypass validations

### Documentation
- Added `TRANSFER_PROTECTION_REPORT.md`: Complete technical documentation (in Arabic)
- Added `TRANSFER_VALIDATION_COVERAGE.md`: Coverage analysis and action items
- Created `backend/test_transfer_validations.js`: Comprehensive test suite

## [3.0.0] - 2026-01-01
### Added
- **Backend Enhancements (12 Phases Complete)**:
    - Input Validation framework with Zod schemas and middleware
    - Global Error Handling with 6 custom error classes
    - Security Hardening: Helmet.js headers + Rate Limiting (100 req/15min)
    - Structured Logging with Pino (HTTP logging, custom log methods)
    - API Documentation: Interactive Swagger UI at /api-docs
    - Health Check endpoints: /health and /api/health
    - Configuration Management: Centralized config module
    - Async Handler wrapper: Eliminated try/catch boilerplate
    - Comprehensive documentation: 2,500+ lines of guides
    - Testing framework with integration test patterns

### Changed
- **Code Cleanup**: Removed 163 unused files (89 backup routes, 71 debug scripts)
- **Security**: Added CORS configuration for frontend (ports 5173, 3000)
- **Documentation**: Reorganized all docs into /documentation folder
- **Example Routes**: Updated customers.js as reference implementation

### Security
- Rate limiting prevents DoS attacks
- Helmet.js security headers enabled
- Input validation prevents injection attacks
- Error messages sanitized (no internal details leaked)

## [2.3.0] - 2025-12-30
### Added
- **Premium Modal System**: Complete overhaul of `Dialog`, `AlertDialog`, and `Sheet` primitives:
    - Massively elevated `z-index: 10000+` for global priority.
    - Implemented **Dynamic Responsive Sizing** (`w-[95vw]` to `min-w-[450px]`).
    - Applied high-end `rounded-[2.5rem]` and soft backdrop blurs.
- **Modular Customers Architecture**:
    - Decomposed `CustomerDetailCard.tsx` (22KB → 3KB) into 4 specialized sub-components.
    - Extracted data logic into centralized `useCustomerData` hook.

### Changed
- **UI/UX Unification**:
    - Replaced all legacy `alert()` calls with `react-hot-toast` notifications.
    - Standardized heavy rounding tokens across all cards and layouts.
    - Refactored legacy `RequestApprovalModal` and `SendToCenterModal` to follow the new `Dialog` standard.

### Fixed
- **Security Patches**: Applied missing branch isolation filters to all reporting routes (inventory, movements, performance).
- Resolved z-index clashing between Navbar and Modals.

## [2.2.0] - 2025-12-30

### Changed
- **Shadcn UI Migrations (THE_RULES Compliance)**:
    - `ConfirmDialog.tsx` → Shadcn `AlertDialog`
    - `ImportModal.tsx`, `CreateRequestModal.tsx`, `CloseRequestModal.tsx` → Shadcn `Dialog`
    - `SimModals.tsx` (3 modals) → Shadcn `Dialog` + `Button`
    - `AuditLogModal.tsx` → Shadcn `Sheet` (side panel pattern)
- **Toast System Unification**: Removed custom `Toast.tsx`, unified on `react-hot-toast`.
- **Users.tsx**: Branch dropdown now correctly appears for `BRANCH_TECH` role selection.

### Removed
- `Toast.tsx` (custom toast component)
- `ui/toast.tsx`, `ui/toaster.tsx` (unused Shadcn toast files)

### Fixed
- Modal z-index overlapping issues (CreateRequestModal)
- Unused imports across multiple files
- Lint errors in Customers.tsx, SimModals.tsx

## [2.1.0] - 2025-12-28
### Added
- **Maintenance Center Integration**:
    - New `MaintenanceBoard.tsx` for unified workflow management.
    - Detailed `RepairModal.tsx` with spare parts inventory deduction.
    - `MaintenanceTransferModal` for bulk machine transfers to centers.
- **Auto-Inventory Deduction**: Backend logic in `machineStateService.js` to automatically deduct parts when a repair is marked as completed.
- **Documentation Versioning**: Established `CHANGELOG.md` and `VERSIONS.md`.

## [2.0.0] - 2025-12-20
### Changed
- **SOA Refactor**: Successfully transitioned from monolith routes to a **Service-Oriented Architecture (SOA)**.
    - Centralized logic in `inventoryService`, `movementService`, `requestService`, and `machineStateService`.
- **Database Schema**: Significant updates to Prisma schema to support branch-level data isolation and audit trails.
- **UI Refresh**: Modernized the dashboard with glassmorphism and vibrant color palettes (Inter/Cairo fonts).

## [1.5.0] - 2025-11-28
### Added
- **Branch Data Isolation**: Implemented strict `branchId` filtering across all core modules (Inventory, Requests, Customers).
- **Excel Import/Export**: Robust partial import system with error reporting for customers and machines.

## [1.0.0] - 2025-11-15
### Added
- Initial release with basic CRUD for Customers, Machines, and Maintenance Requests.
- Role-based login and basic sidebar navigation.

---
*Created by Antigravity AI*
