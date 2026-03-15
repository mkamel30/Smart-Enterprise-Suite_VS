# Smart Enterprise Suite - Frontend Pages Documentation

Complete documentation for all frontend pages in the Smart Enterprise Suite application.

## Table of Contents

1. [Dashboard Pages](#dashboard-pages)
2. [Maintenance & Service Pages](#maintenance--service-pages)
3. [Customer Management Pages](#customer-management-pages)
4. [Warehouse & Inventory Pages](#warehouse--inventory-pages)
5. [Transfer & Orders Pages](#transfer--orders-pages)
6. [Financial Pages](#financial-pages)
7. [Reports & Analytics Pages](#reports--analytics-pages)
8. [Administration Pages](#administration-pages)
9. [Authentication Pages](#authentication-pages)

---

## Quick Reference Table

| Page Name | Route Path | Access Roles | Key Features | API Dependencies |
|-----------|-----------|--------------|--------------|------------------|
| Dashboard | /dashboard | All system roles | Real-time stats, revenue charts, request distribution | `/api/dashboard/stats`, `/api/branches`, `/api/requests/stats` |
| Executive Dashboard | /executive-dashboard | SUPER_ADMIN, MANAGEMENT | KPIs, branch rankings, forecasts, inventory status | `/api/executive/dashboard`, `/api/branches/lookup`, `/api/executive/branch-detail` |
| Admin Dashboard | / | SUPER_ADMIN | Global search, system health, center analysis, admin logs | `/api/admin/summary`, `/api/logs`, `/api/search` |
| Technician Dashboard | N/A (unused) | CENTER_MANAGER, CENTER_TECH | Service assignments, workflow management | `/api/service-assignments`, `/api/machine-workflow/kanban`, `/api/inventory` |
| Requests | /requests | Branch roles | Request CRUD, assignment, approval workflow | `/api/requests`, `/api/technicians`, `/api/requests/stats`, `/api/inventory` |
| Maintenance Board | /maintenance-board (commented out) | CENTER_MANAGER, CENTER_TECH | Kanban workflow, incoming shipments | `/api/pending-transfer-orders`, `/api/receive-transfer-order` |
| Maintenance Shipments | /maintenance/shipments | CENTER_MANAGER, CENTER_TECH | Shipment tracking, status filtering | `/api/maintenance/shipments` |
| Maintenance Approvals | /maintenance-approvals | Branch supervisors | Approval review, parts/cost management | `/api/maintenance-approvals` |
| Customers | /customers | Branch roles | Customer directory, machine exchange, SIM management | `/api/customers`, `/api/warehouse-machines`, `/api/exchange`, `/api/return` |
| Warehouse | /warehouse | All except ADMIN_AFFAIRS | Spare parts inventory, stock movements | `/api/inventory`, `/api/stock-movements`, `/api/machine-parameters` |
| Machine Warehouse | /warehouse-machines | ADMIN_AFFAIRS, Branch roles | Machine storage, transfers, sales, repairs | `/api/warehouse-machines`, `/api/sales`, `/api/transfer-orders` |
| SIM Warehouse | /warehouse-sims | ADMIN_AFFAIRS, Branch roles | SIM card management, transfers | `/api/warehouse-sims`, `/api/transfer-orders` |
| Receive Orders | /receive-orders | Branch roles | Incoming transfer orders, receive/reject | `/api/pending-transfer-orders`, `/api/transfer-orders`, `/api/receive-transfer-order` |
| Transfer Orders | /transfer-orders | All except ADMIN_AFFAIRS | Transfer order creation, tracking, approval | `/api/transfer-orders`, `/api/create-transfer-order`, `/api/transfer-orders/stats` |
| Payments | /payments | Branch roles | Payment recording, receipt tracking | `/api/payments`, `/api/payment-stats`, `/api/check-receipt` |
| Pending Payments | /pending-payments | Branch roles, Centers | Pending payment tracking, settlement | `/api/pending-payments`, `/api/pending-payments/summary` |
| Receipts | /receipts | Branch roles | Sales tracking, installment management | `/api/sales`, `/api/installments`, `/api/pay-installment` |
| Reports | /reports | All except ADMIN_AFFAIRS | Financial overview, branch rankings, AI assistant | `/api/executive-report`, `/api/branches` |
| Production Reports | /production-reports | SUPER_ADMIN, MANAGEMENT | Governorate performance, POS stock, sales reports | `/api/governorate-performance`, `/api/inventory-movement`, `/api/pos-stock`, `/api/pos-sales` |
| Users | /technicians | SUPER_ADMIN | User CRUD, role management, password reset | `/api/users`, `/api/branches`, `/api/create-user`, `/api/delete-user` |
| Branches Settings | /branches | SUPER_ADMIN | Branch CRUD, type management, activation | `/api/branches`, `/api/create-branch`, `/api/update-branch`, `/api/delete-branch` |
| Settings | /settings | SUPER_ADMIN, Branch supervisors | Security, appearance, machine parameters, permissions | `/api/machine-parameters`, `/api/spare-parts`, `/api/client-types`, `/api/database` |
| Login | /login | Public | Authentication, token management | `/api/login` |
| Shipment Detail | /maintenance/shipments/:id | CENTER_MANAGER, CENTER_TECH | Individual shipment processing, machine workflow | `/api/maintenance/shipments`, `/api/maintenance/machine/:serial/transition`, `/api/maintenance/shipments/:id/receive` |
| Track Machines | /track-machines | Branch roles | Machine status tracking at center | `/api/track-machines`, `/api/track-machines/summary` |
| Assignments | /assignments | CENTER_MANAGER, CENTER_TECH | Service assignment management | `/api/service-assignments`, `/api/service-assignments/:id/start`, `/api/service-assignments/:id/complete` |
| Approvals | /approvals | SUPER_ADMIN, CENTER_MANAGER | General approval requests management | `/api/approvals`, `/api/respond-to-approval` |

---

## Dashboard Pages

### 1. Dashboard

**Route:** `/dashboard`

**Page Overview:**
- **Purpose:** Main operational dashboard showing real-time system statistics and KPIs
- **User Roles:** All system roles (SUPER_ADMIN, MANAGEMENT, ADMIN_AFFAIRS, CENTER_MANAGER, CENTER_TECH, BRANCH_MANAGER, CS_SUPERVISOR, CS_AGENT, BRANCH_TECH)
- **Route Path:** `/dashboard` (also accessible via `/` with role-based redirection)

**Key Features:**
- Real-time statistics cards (revenue, open requests, overdue installments, inventory alerts)
- Revenue trend area chart using Recharts
- Request status pie chart with distribution breakdown
- Low stock alerts with quick replenishment actions
- Recent activity table with payment history
- Branch filter for administrators
- Create maintenance request shortcut
- Performance report modal access

**Sub-components Used:**
- `PageHeader` - Standard page header with filter and action buttons
- `StatCard` - Reusable statistics card component
- `PerformanceReportModal` - Modal for generating performance reports
- Recharts components (AreaChart, PieChart, ResponsiveContainer)

**API Endpoints Called:**
- `GET /api/dashboard/stats` - Dashboard statistics with optional branch filter
- `GET /api/branches` - Active branches for admin filter
- `GET /api/requests/stats` - Request statistics (day/week/month)
- `POST /api/requests` - Create new request (via navigation)

**State Management:**
- React Query hooks: `useQuery(['dashboard-stats', filterBranchId])`, `useQuery(['branches'])`
- Local state: `filterBranchId`, `showPerformanceReport`
- URL state: None
- Refetch interval: 60 seconds for stats

**User Interface:**
- Responsive grid layout (1-4 columns based on screen size)
- RTL (Right-to-Left) Arabic layout
- Animated transitions with fade-in and slide-up effects
- Color-coded status indicators
- Interactive charts with tooltips

**Permissions:**
- **Required Role:** Any authenticated user
- **Feature-level:**
  - Branch filter: Only for users without branchId (admins)
  - Create request button: SUPER_ADMIN, BRANCH_MANAGER, TECHNICIAN roles only
  - Performance report button: All except ADMIN_AFFAIRS

---

### 2. Executive Dashboard

**Route:** `/executive-dashboard`

**Page Overview:**
- **Purpose:** High-level management dashboard with predictive analytics and branch performance tracking
- **User Roles:** SUPER_ADMIN, MANAGEMENT only
- **Route Path:** `/executive-dashboard` (protected by ProtectedRoute)

**Key Features:**
- KPI cards with trend indicators (revenue, pending debts, closure rate, inventory health)
- Revenue trend chart with 6-month historical data
- Branch performance ranking table with drill-down capability
- Inventory status visualization (in stock, low stock, critical, out of stock)
- Top performers grid showing best technicians
- AI-powered revenue forecasts with confidence intervals
- Alert system for critical business events
- Quick stats summary (customers, machines, utilization, requests)
- Branch detail modal with deep analytics

**Sub-components Used:**
- `KPICard` - Key performance indicator cards
- `AlertCard` - Alert notification component
- `BranchRankingTable` - Sortable branch performance table
- `ForecastChart` - Revenue prediction visualization
- `BranchDetailModal` - Drill-down branch analytics

**API Endpoints Called:**
- `GET /api/executive/dashboard` - Executive summary data with date range
- `GET /api/branches/lookup` - Branch list for filters
- `GET /api/executive/branch-detail/:id` - Detailed branch data for modal

**State Management:**
- React Query: `useQuery(['executive-dashboard', dateParams])`, `useQuery(['branch-detail', drillDownBranchId])`
- Local state: `dateRange`, `selectedBranch`, `drillDownBranchId`
- Date calculation: Start/end dates based on month/quarter/year selection
- Refetch interval: 60 seconds

**User Interface:**
- Dark theme gradient background (slate-900 to slate-800)
- Card-based layout with hover effects
- Interactive charts with Recharts (AreaChart, PieChart, ComposedChart)
- Responsive grid (adapts from 4 columns to 1 on mobile)
- Medal icons for top 3 branches (🥇🥈🥉)
- Progress bars for closure rates
- RTL layout with Arabic numerals

**Permissions:**
- **Required Role:** SUPER_ADMIN or MANAGEMENT only
- **Protected Route:** Yes, with `allowedRoles={['SUPER_ADMIN', 'MANAGEMENT']}`

---

### 3. Admin Dashboard

**Route:** `/` (for SUPER_ADMIN)

**Page Overview:**
- **Purpose:** System administration dashboard with global oversight
- **User Roles:** SUPER_ADMIN only
- **Route Path:** `/` (redirects to AdminDashboard for SUPER_ADMIN)

**Key Features:**
- Global search functionality (machines and customers)
- Quick search results dropdown with real-time filtering
- System health monitoring (success rate, error count)
- Branch performance bar chart comparison
- Maintenance center analysis (parts transfers, repairs)
- Admin affairs analysis (machine/SIM transfers)
- Global low stock alerts across all branches
- Quick actions panel (add user, add branch, reports, settings)
- Recent admin activity logs

**Sub-components Used:**
- `HighlightCard` - Summary statistic cards
- `HealthMeter` - System health visual indicator
- Custom search dropdown component
- Recharts BarChart for branch comparison

**API Endpoints Called:**
- `GET /api/admin/summary` - Global statistics
- `GET /api/logs?limit=5` - Recent admin logs (30s refresh)
- `GET /api/search?q={query}` - Global search
- `GET /api/customer-template` - Download import template

**State Management:**
- React Query: `useQuery(['admin-global-stats'])`, `useQuery(['recent-logs'])`
- Local state: `searchQuery`, `searchResults`, `isSearching`
- Debounced search: 300ms delay
- Refetch intervals: 60s (stats), 30s (logs)

**User Interface:**
- Clean light theme with blue accents
- Search bar with real-time results
- Animated cards with hover effects
- Grid layout (1-3 columns)
- Dark themed system status card
- Scrollable log list

**Permissions:**
- **Required Role:** SUPER_ADMIN
- **Conditional Rendering:**
  - Full dashboard only for users without branchId
  - Otherwise redirects to standard Dashboard

---

### 4. Technician Dashboard

**Route:** `/assignments` (primary), Component exists but routes commented out

**Page Overview:**
- **Purpose:** Maintenance center workflow management for technicians and managers
- **User Roles:** CENTER_MANAGER, CENTER_TECH, SUPER_ADMIN
- **Route Path:** Not currently routed in App.tsx (routes commented out)

**Key Features:**
- Service assignment management
- Machine workflow status tracking
- Parts usage recording
- Inspection and approval request workflows
- Status-based action buttons (Start Work, Request Approval, Complete)

**Sub-components Used:**
- `CloseRequestModal` - For completing repairs with parts
- Shadcn UI Dialog, Button, Input, Label, Textarea

**API Endpoints Called:**
- `GET /api/service-assignments` - Technician assignments
- `GET /api/machine-workflow/kanban` - All machines for managers
- `GET /api/inventory` - Spare parts inventory
- `POST /api/machine-workflow/:id/transition` - Status transitions

**State Management:**
- React Query: `useQuery(['tech-dashboard-machines'])`, `useQuery(['spare-parts-inventory'])`
- Local state: `selectedAssignment`, `showPartsModal`, `inspectionModal`, `approvalModal`, `filterStatus`
- Form data: `inspectionNotes`, `approvalData`
- Refetch interval: 30 seconds

**User Interface:**
- Status-based color coding
- Action buttons contextual to machine status
- Modal workflows for inspection and approval

**Permissions:**
- **Required Role:** CENTER_MANAGER, CENTER_TECH
- **Manager View:** Shows all center machines
- **Technician View:** Shows only assigned machines

---

## Maintenance & Service Pages

### 5. Requests

**Route:** `/requests`

**Page Overview:**
- **Purpose:** Complete maintenance request management system
- **User Roles:** BRANCH_MANAGER, CS_SUPERVISOR, CS_AGENT, BRANCH_TECH
- **Route Path:** `/requests`

**Key Features:**
- Create, view, assign, close, and delete maintenance requests
- Status-based workflow (Open → In Progress → Closed)
- Technician assignment with dropdown selection
- Close request modal with parts usage tracking
- Print service reports
- Export to Excel
- Search by customer, serial, or complaint
- Daily/weekly/monthly statistics
- Open/closed request tabs
- Send to maintenance center workflow

**Sub-components Used:**
- `CreateRequestModal` - New request creation
- `CloseRequestModal` - Request closure with parts
- `SendToCenterModal` - Transfer to maintenance center
- `RequestApprovalModal` - Approval request for costly repairs
- `AuditLogModal` - Request history tracking
- `ConfirmDialog` - Delete confirmation
- `PageHeader` - Standard header
- `Dialog` (Shadcn) - Detail and assignment modals

**API Endpoints Called:**
- `GET /api/requests` - Request list with filters
- `POST /api/requests` - Create request
- `PUT /api/requests/:id/assign` - Assign technician
- `PUT /api/requests/:id/close` - Close request
- `DELETE /api/requests/:id` - Delete request
- `GET /api/requests/stats` - Statistics
- `GET /api/technicians` - Available technicians
- `GET /api/inventory` - Spare parts
- `GET /api/monthly-repair-count` - For report generation

**State Management:**
- React Query: Multiple queries for requests, stats, technicians, parts
- Local state: Modal visibility flags, selected request, form data
- URL state: `location.state` for navigation from customers page
- Debounced search: 500ms

**User Interface:**
- Tab-based navigation (Open/Closed)
- Statistics cards with time period breakdown
- Action buttons per row (View, Assign, Close, Print, Delete)
- Status badges with color coding
- Modal-based workflows

**Permissions:**
- **Required Role:** Branch customer service roles
- **Delete:** Only SUPER_ADMIN, BRANCH_MANAGER, CS_SUPERVISOR
- **Assign:** Open or Pending requests only
- **Close:** In Progress requests only

---

### 6. Maintenance Board

**Route:** `/maintenance-board` (commented out in App.tsx)

**Page Overview:**
- **Purpose:** Kanban-style maintenance center management
- **User Roles:** CENTER_MANAGER, CENTER_TECH
- **Route Path:** Currently not routed (commented in App.tsx line 86)

**Key Features:**
- Two view modes: Kanban workflow and Incoming Shipments
- Receive maintenance shipments at center
- View shipment details
- Kanban board for machine workflow tracking

**Sub-components Used:**
- `MaintenanceKanban` - Kanban board component
- Shadcn Badge, Button

**API Endpoints Called:**
- `GET /api/pending-transfer-orders` - Pending orders
- `POST /api/receive-transfer-order/:id` - Receive shipment

**State Management:**
- React Query: `useQuery(['pending-orders'])`
- Local state: `activeView`, `selectedOrder`
- Mutations: `useMutation` for receive action

**User Interface:**
- Tab toggle between views
- Card-based shipment display
- Modal for order details

**Permissions:**
- **Required Role:** CENTER_MANAGER, CENTER_TECH
- **Note:** Route is currently commented out in App.tsx

---

### 7. Maintenance Shipments

**Route:** `/maintenance/shipments`

**Page Overview:**
- **Purpose:** Track and manage incoming maintenance shipments
- **User Roles:** CENTER_MANAGER, CENTER_TECH, SUPER_ADMIN
- **Route Path:** `/maintenance/shipments`

**Key Features:**
- Shipment cards with status indicators
- Progress tracking for each shipment
- Status filtering (Pending, Accepted, Completed)
- Navigate to shipment detail for processing
- Branch origin display
- Item count and creation date

**Sub-components Used:**
- Shadcn Card, Button, Progress
- date-fns for date formatting
- Lucide icons (Truck, Calendar, Archive)

**API Endpoints Called:**
- `GET /api/maintenance/shipments` - Shipment list with status filter

**State Management:**
- React Query: `useQuery(['maintenance-shipments', filterStatus])`
- Local state: `filterStatus`
- Refetch: Manual via button

**User Interface:**
- Grid layout (1-3 columns responsive)
- Card-based shipment display
- Progress bars for completion
- Status badges (color-coded)
- Click to navigate to detail

**Permissions:**
- **Required Role:** CENTER_MANAGER, CENTER_TECH, SUPER_ADMIN
- **Protected Route:** Yes

---

### 8. Maintenance Approvals

**Route:** `/maintenance-approvals`

**Page Overview:**
- **Purpose:** Review and approve/reject maintenance cost requests from centers
- **User Roles:** BRANCH_MANAGER, CS_SUPERVISOR, SUPER_ADMIN, MANAGEMENT
- **Route Path:** `/maintenance-approvals`

**Key Features:**
- List of pending approval requests
- Detailed parts and cost breakdown
- Approve/Reject actions
- Rejection reason input
- Filter by status (Pending, Approved, Rejected)
- Summary alert for pending count

**Sub-components Used:**
- Shadcn Button, Dialog
- Lucide icons (CheckCircle, XCircle, Clock, Package, AlertTriangle)

**API Endpoints Called:**
- `GET /api/maintenance-approvals` - List with branch filter
- `PUT /api/maintenance-approvals/:id/approve` - Approve request
- `PUT /api/maintenance-approvals/:id/reject` - Reject request

**State Management:**
- React Query: `useQuery(['maintenance-approvals'])`
- Local state: `selectedRequest`, `showRejectDialog`, `rejectionReason`, `filterStatus`
- Refetch interval: 30 seconds

**User Interface:**
- Alert banner for pending count
- List view with expandable details
- Parts breakdown with costs
- Action buttons (Approve/Reject)
- Modal for rejection reason

**Permissions:**
- **Required Role:** Branch supervisors (BRANCH_MANAGER, CS_SUPERVISOR)
- **Note:** Technicians cannot approve costs

---

## Customer Management Pages

### 9. Customers

**Route:** `/customers`

**Page Overview:**
- **Purpose:** Complete customer relationship management
- **User Roles:** BRANCH_MANAGER, CS_SUPERVISOR, CS_AGENT, BRANCH_TECH
- **Route Path:** `/customers`

**Key Features:**
- Customer directory with search
- Machine exchange (swap defective for standby)
- Machine return to warehouse
- SIM card management (purchase, exchange, type updates)
- Create maintenance request from customer
- View machine history
- Import customers from Excel
- Customer detail view with tabs
- All machines view
- All SIM cards view

**Sub-components Used:**
- `CustomerHeader` - Page header with import actions
- `CustomerStats` - Statistics display
- `CustomerSearch` - Search with dropdown results
- `CustomerQuickList` - Quick customer selection
- `CustomerDetailCard` - Detailed customer view with tabs
- `AllMachinesTable` - All machines across customers
- `AllSimCardsTable` - All SIM cards view
- `CustomerModals` - All modal dialogs (exchange, return, history, SIM actions, import)
- `Tabs` (Shadcn) - View switching

**API Endpoints Called:**
- `GET /api/customers` - Customer list
- `GET /api/customers?bkcode={code}` - Specific customer
- `GET /api/warehouse-machines` - Available machines for exchange
- `POST /api/exchange` - Exchange machine
- `POST /api/return` - Return machine
- `PUT /api/sim-cards/:id` - Update SIM type
- `POST /api/import-customers` - Import from Excel
- `GET /api/customer-template` - Download template

**State Management:**
- Custom hook: `useCustomerData` - Centralized data management
- Local state: `viewTab`, `modals`, `modalData`
- React Query: Multiple queries for customers, branches, warehouse machines
- Mutations: exchange, return, SIM update

**User Interface:**
- Tab-based navigation (Customers / Machines / SIM Cards)
- Search with autocomplete dropdown
- Card-based customer detail view
- Modal workflows for all actions
- Statistics cards at top

**Permissions:**
- **Required Role:** Branch customer service roles
- **Exchange/Return:** Based on warehouse machine availability
- **Note:** CustomerDetail is a component within this page, not a separate route

---

## Warehouse & Inventory Pages

### 10. Warehouse

**Route:** `/warehouse`

**Page Overview:**
- **Purpose:** Spare parts inventory management
- **User Roles:** CENTER_MANAGER, CENTER_TECH, Branch roles (not ADMIN_AFFAIRS)
- **Route Path:** `/warehouse`

**Key Features:**
- Current inventory view with search and filters
- Stock movement history log
- Excel import/export functionality
- Model-based filtering
- Inline quantity editing
- Download/upload templates
- Branch filter for admins

**Sub-components Used:**
- `PageHeader` - Standard header
- `DropdownMenu` (Shadcn) - Excel operations
- XLSX library for Excel handling
- Custom `InventoryRow` component with inline editing

**API Endpoints Called:**
- `GET /api/inventory` - Current stock
- `GET /api/stock-movements` - Movement history
- `PUT /api/inventory/:id` - Update quantity
- `GET /api/machine-parameters` - Model list
- `GET /api/branches` - For admin filter

**State Management:**
- React Query: `useQuery(['inventory'])`, `useQuery(['stock-movements'])`
- Local state: `filterBranchId`, `activeTab`, `searchQuery`, `selectedModel`, `movementFilters`
- File input ref for Excel upload

**User Interface:**
- Tab navigation (Inventory / Movements)
- Table with sortable columns
- Search and filter inputs
- Excel operations dropdown
- Inline editing with save/cancel
- Export functionality

**Permissions:**
- **Required Role:** All except ADMIN_AFFAIRS
- **Admin Features:** Branch filter, import
- **Edit:** Inline quantity editing available

---

### 11. Machine Warehouse

**Route:** `/warehouse-machines`

**Page Overview:**
- **Purpose:** Physical machine inventory management
- **User Roles:** ADMIN_AFFAIRS, CENTER_MANAGER, Branch roles
- **Route Path:** `/warehouse-machines`

**Key Features:**
- Tab-based machine categories (NEW, STANDBY, DEFECTIVE, CLIENT_REPAIR, REPAIRED)
- Machine exchange with customers
- Machine sales (cash/installment)
- Machine transfers between branches
- Maintenance center transfers
- Repair workflow (defective → standby)
- Machine import from Excel
- Statistics cards for each category
- Logs view for tracking
- Kanban workflow view (for centers)

**Sub-components Used:**
- `MaintenanceKanban` - Workflow board (centers only)
- `AddMachineModal` - Add new machines
- `MachineExchangeModal` - Exchange process
- `MachineSaleModal` - Sales with installments
- `MachineRepairModal` - Repair completion
- `MachineReturnToCustomerModal` - Return to customer
- `TransferMachinesModal` - Inter-branch transfers
- `MaintenanceTransferModal` - Send to center
- `MachineWarehouseStats` - Statistics display
- `MachineImportModal` - Excel import
- `MachineLogsTable` - History view
- `DataTable` - Reusable table component

**API Endpoints Called:**
- `GET /api/warehouse-machines` - Machines by status
- `GET /api/warehouse-logs` - Movement history
- `GET /api/warehouse-machine-counts` - Statistics
- `GET /api/branches-lookup` - For transfers
- `GET /api/machine-parameters` - Model validation
- `POST /api/add-warehouse-machine` - Add machine
- `POST /api/exchange` - Exchange
- `POST /api/create-sale` - Sell machine
- `POST /api/create-transfer-order` - Transfer
- `POST /api/repair-machine` - Repair workflow
- `GET /api/pending-transfer-serials` - Prevent duplicates

**State Management:**
- React Query: Multiple queries for machines, logs, counts, branches
- Local state: `activeTab`, `filterBranchId`, `selectedMachines`, `modals`, `selectedItem`
- Tab configuration filtered by role
- Refetch interval: 60 seconds for counts

**User Interface:**
- Tab navigation with badge counts
- Role-based tab visibility
- Statistics cards row
- Data table with selection checkboxes
- Row actions based on status
- Multiple modal workflows

**Permissions:**
- **ADMIN_AFFAIRS:** NEW, DEFECTIVE, LOGS tabs only
- **CENTER_MANAGER:** DEFECTIVE, CLIENT_REPAIR, REPAIRED, WORKFLOW, LOGS
- **Branch roles:** All standard tabs (NEW, STANDBY, DEFECTIVE, CLIENT_REPAIR, REPAIRED, LOGS)
- **Note:** WORKFLOW tab only for center managers

---

### 12. SIM Warehouse

**Route:** `/warehouse-sims`

**Page Overview:**
- **Purpose:** SIM card inventory management
- **User Roles:** ADMIN_AFFAIRS, Branch roles (not centers)
- **Route Path:** `/warehouse-sims`

**Key Features:**
- SIM card CRUD operations
- Status management (ACTIVE, DEFECTIVE, IN_TRANSIT)
- Type classification and filtering
- Bulk transfer creation
- Excel import/export
- Statistics by status and type
- Search and filter functionality

**Sub-components Used:**
- `SimStatsCards` - Statistics display
- `SimTypeBreakdown` - Type distribution
- `SimTabs` - Status-based tabs
- `SimFilters` - Search and branch filters
- `SimTable` - Data table with selection
- `SimFormModal` - Add/edit SIM
- `SimTransferModal` - Transfer creation
- `ImportModal` - Excel import

**API Endpoints Called:**
- `GET /api/warehouse-sims` - SIM list
- `GET /api/warehouse-sims-counts` - Statistics
- `POST /api/warehouse-sims` - Create SIM
- `PUT /api/warehouse-sims/:id` - Update SIM
- `DELETE /api/warehouse-sims/:id` - Delete SIM
- `POST /api/transfer-warehouse-sims` - Transfer
- `GET /api/branches` - For transfers

**State Management:**
- React Query: Queries for SIMs, counts, branches
- Local state: `filterBranchId`, `searchTerm`, `activeTab`, `typeFilter`, `selectedSims`, modals
- Form state for add/edit

**User Interface:**
- Statistics cards at top
- Type breakdown with filter buttons
- Tab navigation by status
- Search and branch filter
- Data table with checkboxes
- Bulk transfer button when items selected

**Permissions:**
- **ADMIN_AFFAIRS:** Full access, bulk transfers
- **Branch roles:** View and manage own branch SIMs
- **Note:** Centers typically don't manage SIMs

---

## Transfer & Orders Pages

### 13. Receive Orders

**Route:** `/receive-orders`

**Page Overview:**
- **Purpose:** Receive incoming transfer orders from other branches
- **User Roles:** CENTER_MANAGER, Branch roles
- **Route Path:** `/receive-orders`

**Key Features:**
- Pending orders view
- History view (received/rejected)
- Order type indicators (SIM, MACHINE, MAINTENANCE, SPARE_PART)
- Status badges (Pending, Received, Partial, Rejected)
- Receive confirmation
- Reject with reason
- Order detail modal
- Highlight effect from notifications

**Sub-components Used:**
- Custom status mapping constants
- Modal for order details
- Reject reason textarea

**API Endpoints Called:**
- `GET /api/pending-transfer-orders` - Pending orders
- `GET /api/transfer-orders` - All orders (for history)
- `POST /api/receive-transfer-order/:id` - Receive order
- `POST /api/reject-transfer-order/:id` - Reject order

**State Management:**
- React Query: Queries for pending and all orders
- Local state: `activeTab`, `selectedOrder`, `rejectReason`, `showRejectModal`, `highlightedOrderId`
- URL params: Auto-open from notification via `orderId` param
- Settings context: `preferences.highlightEffect`

**User Interface:**
- Tab toggle (Pending / History)
- Card list for pending orders
- Table for history
- Action buttons per order
- Detail modal with item list
- Reject modal with reason input

**Permissions:**
- **Required Role:** Any branch user (to receive at their branch)
- **Notification Integration:** Auto-opens order from notification click

---

### 14. Transfer Orders

**Route:** `/transfer-orders`

**Page Overview:**
- **Purpose:** Create and manage inter-branch transfer orders
- **User Roles:** All except ADMIN_AFFAIRS
- **Route Path:** `/transfer-orders`

**Key Features:**
- List view with filtering (status, type, branch, search)
- Create new transfer order
- Excel import for bulk transfers
- Direction toggle (all/sent/received)
- Statistics summary
- Order detail view with actions
- Receive, reject, cancel operations

**Sub-components Used:**
- `TransferOrdersStats` - Summary statistics
- `TransferOrdersFilters` - Filter controls
- `TransferOrdersTable` - Data table
- `CreateTransferOrderForm` - Creation form
- `ViewTransferOrderModal` - Detail view

**API Endpoints Called:**
- `GET /api/transfer-orders` - Order list with filters
- `GET /api/transfer-orders-stats` - Statistics
- `POST /api/create-transfer-order` - Create order
- `POST /api/import-transfer-order` - Excel import
- `POST /api/receive-transfer-order` - Receive
- `POST /api/reject-transfer-order` - Reject
- `DELETE /api/cancel-transfer-order/:id` - Cancel

**State Management:**
- React Query: Queries for orders, stats, branches
- Local state: `activeTab`, multiple filters, `viewingOrder`, `highlightedOrderId`
- URL params: Auto-open from notification
- Filter direction: all/sent/received

**User Interface:**
- Tab navigation (List / Create)
- Statistics cards in header
- Filter bar with multiple inputs
- Direction toggle buttons
- Data table with actions
- Detail modal with receive/reject/cancel

**Permissions:**
- **Required Role:** All except ADMIN_AFFAIRS
- **Admin Features:** View all branches
- **Note:** Users can only create orders from their branch

---

## Financial Pages

### 15. Payments

**Route:** `/payments`

**Page Overview:**
- **Purpose:** Record and track miscellaneous payments
- **User Roles:** Branch roles
- **Route Path:** `/payments`

**Key Features:**
- Payment recording with customer name, reason, amount
- Payment place selection (Bank, Guarantor, Post, etc.)
- Receipt number tracking with duplicate check
- Statistics cards (total, today, month, count)
- Search functionality
- Delete payment
- Export to Excel

**Sub-components Used:**
- `PageHeader` - Standard header
- `PaymentFields` - Reusable payment form fields
- `usePaymentForm` - Shared form logic hook

**API Endpoints Called:**
- `GET /api/payments` - Payment list
- `GET /api/payment-stats` - Statistics
- `POST /api/payments` - Create payment
- `DELETE /api/payments/:id` - Delete payment
- `GET /api/check-receipt/:number` - Duplicate check

**State Management:**
- React Query: Queries for payments and stats
- Local state: `showAddForm`, `searchTerm`, form data
- Shared hook: `usePaymentForm` for amount/receipt/place
- Debounced receipt check

**User Interface:**
- Statistics cards at top
- Search input
- Data table with delete action
- Add payment modal
- Form with validation

**Permissions:**
- **Required Role:** Branch customer service roles
- **Delete:** Any user can delete (with confirmation)

---

### 16. Pending Payments

**Route:** `/pending-payments`

**Page Overview:**
- **Purpose:** Track and settle payments owed to/from maintenance centers
- **User Roles:** Branch supervisors, Center managers
- **Route Path:** `/pending-payments`

**Key Features:**
- View pending payments for center or branch
- Summary cards (total pending, context)
- Payment settlement with receipt number
- Filter by status (Pending, Paid)
- Parts details display
- Export to Excel

**Sub-components Used:**
- Shadcn Button, Dialog
- Lucide icons (Wallet, CheckCircle, Clock, Receipt, DollarSign, Package)

**API Endpoints Called:**
- `GET /api/pending-payments` - List with branch/center filter
- `GET /api/pending-payments/summary` - Statistics
- `PUT /api/pending-payments/:id/pay` - Record payment
- `GET /api/branches/:id` - Determine branch type

**State Management:**
- React Query: Queries for payments and summary
- Local state: `selectedPayment`, `showPayDialog`, `receiptNumber`, `paymentPlace`, `filterStatus`
- Dynamic view based on branch type

**User Interface:**
- Summary cards at top
- List view with payment info
- Pay button for branches
- Payment modal with receipt input
- Parts breakdown

**Permissions:**
- **Centers:** View what branches owe them
- **Branches:** View what they owe and settle payments
- **Required Role:** BRANCH_MANAGER, CS_SUPERVISOR for branches; CENTER_MANAGER for centers

---

### 17. Receipts

**Route:** `/receipts`

**Page Overview:**
- **Purpose:** Sales tracking and installment management
- **User Roles:** Branch roles
- **Route Path:** `/receipts`

**Key Features:**
- Dashboard view with installment overview
- Sales history table
- Installment tracking with payment
- Overdue filtering
- Group by customer or month
- Pay installment with receipt
- Edit installment count
- Cancel sale (with machine return)
- Print sale contract
- Export sales to Excel

**Sub-components Used:**
- `InstallmentsDashboard` - Overview dashboard
- `PaymentFields` - Payment form
- `usePaymentForm` - Shared hook
- Custom modals for payment and editing

**API Endpoints Called:**
- `GET /api/sales` - Sales list
- `GET /api/installments` - Installments with overdue filter
- `POST /api/pay-installment` - Pay installment
- `POST /api/recalculate-installments` - Edit count
- `DELETE /api/sales/:id` - Cancel sale
- `GET /api/check-receipt` - Receipt validation

**State Management:**
- React Query: Queries for sales and installments
- Local state: `activeTab`, `filterOverdue`, `groupBy`, `searchTerm`, modals
- Form state for payment and editing
- Memoized filtering and grouping

**User Interface:**
- Tab navigation (Dashboard / Sales / Installments)
- Dashboard with charts and stats
- Sales table with actions
- Installments with grouping options
- Payment modal
- Edit installments modal

**Permissions:**
- **Required Role:** Branch roles
- **Cancel Sale:** Confirmation required, deletes related records
- **Edit Installments:** Only for installment sales

---

## Reports & Analytics Pages

### 18. Reports

**Route:** `/reports`

**Page Overview:**
- **Purpose:** Strategic analytics and executive reporting
- **User Roles:** All except ADMIN_AFFAIRS
- **Route Path:** `/reports`

**Key Features:**
- Multiple report tabs (Financial, Branches, Inventory, AI Assistant)
- Date range filtering
- Branch filtering (admin only)
- Financial overview with charts
- Branch rankings comparison
- Inventory analytics
- AI strategic assistant

**Sub-components Used:**
- `ReportsTabs` - Tab navigation
- `ReportsFilters` - Filter bar
- `FinancialOverview` - Financial charts
- `BranchRankings` - Comparison table
- `InventoryAnalytics` - Stock analysis
- `AiStrategicAssistant` - AI insights
- `PageHeader` - Standard header

**API Endpoints Called:**
- `GET /api/executive-report` - Main report data
- `GET /api/branches` - For filter dropdown

**State Management:**
- React Query: `useQuery(['executive-report', filters])`
- Local state: `activeTab`, `filters` (startDate, endDate, branchId)
- Default dates: First of month to today
- Tab visibility based on permissions

**User Interface:**
- Tab-based navigation
- Filter bar with date pickers
- Branch selector (admin only)
- Chart components
- Responsive grid layout

**Permissions:**
- **VIEW_EXECUTIVE_SUMMARY:** SUPER_ADMIN, MANAGEMENT (Financial tab)
- **VIEW_BRANCH_RANKINGS:** SUPER_ADMIN, MANAGEMENT (Branches tab)
- **VIEW_INVENTORY_VALUATION:** SUPER_ADMIN, MANAGEMENT (Inventory tab)
- **AI Assistant:** Available to all

---

### 19. Production Reports

**Route:** `/production-reports`

**Page Overview:**
- **Purpose:** Detailed operational and sales reports
- **User Roles:** SUPER_ADMIN, MANAGEMENT
- **Route Path:** `/production-reports`

**Key Features:**
- Governorate performance analysis
- Inventory movement tracking
- POS stock levels
- Monthly sales reports
- Daily sales reports
- Date range filtering
- Branch filtering

**Sub-components Used:**
- `GovernoratePerformance` - Geographic analysis
- `InventoryMovementReport` - Stock flow
- `PosStockReport` - Current stock levels
- `PosSalesReport` - Sales analysis (monthly/daily)
- `ReportsFilters` - Filter bar

**API Endpoints Called:**
- `GET /api/governorate-performance` - Geographic data
- `GET /api/inventory-movement` - Movement data
- `GET /api/pos-stock` - Stock levels
- `GET /api/pos-sales-monthly` - Monthly sales
- `GET /api/pos-sales-daily` - Daily sales

**State Management:**
- React Query: Multiple queries based on active tab
- Local state: `activeTab`, `filters`
- Conditional query enabling based on tab
- Loading state aggregation

**User Interface:**
- Tab navigation with icons
- Filter bar
- Loading spinner during fetch
- Report-specific visualizations
- Data tables and charts

**Permissions:**
- **Required Role:** SUPER_ADMIN, MANAGEMENT
- **Central Access:** Full branch visibility

---

## Administration Pages

### 20. Users

**Route:** `/technicians` (legacy name, shows all users)

**Page Overview:**
- **Purpose:** User management and role assignment
- **User Roles:** SUPER_ADMIN only
- **Route Path:** `/technicians`

**Key Features:**
- User CRUD operations
- Role assignment with entity selection
- Password reset functionality
- Branch/center filter
- Role validation (branch required for certain roles)
- Edit user details
- Delete user with confirmation

**Sub-components Used:**
- `PageHeader` - Standard header
- `ConfirmDialog` - Delete confirmation
- Role display utilities

**API Endpoints Called:**
- `GET /api/users` - User list with branch filter
- `GET /api/branches` - All branches for dropdowns
- `POST /api/create-user` - Create user
- `PUT /api/update-user/:id` - Update user
- `DELETE /api/delete-user/:id` - Delete user

**State Management:**
- React Query: Queries for users and branches
- Local state: `filterBranchId`, `showAddForm`, `userToDelete`, `userToEdit`, form data
- Reset password state
- Derived lists: branchesOnly, maintenanceCenters, adminAffairs

**User Interface:**
- Filter dropdown for admins
- Data table with actions (Edit, Reset Password, Delete)
- Add user modal with validation
- Edit user modal
- Reset password modal
- Role-based entity selection

**Permissions:**
- **Required Role:** SUPER_ADMIN only
- **Note:** Route named `/technicians` for legacy compatibility

---

### 21. Branches Settings

**Route:** `/branches`

**Page Overview:**
- **Purpose:** Branch/location management
- **User Roles:** SUPER_ADMIN only
- **Route Path:** `/branches`

**Key Features:**
- Branch CRUD operations
- Branch type selection (BRANCH, MAINTENANCE_CENTER, ADMIN_AFFAIRS)
- Parent branch assignment (for regular branches)
- Active/inactive toggle
- Address management
- Delete with confirmation

**Sub-components Used:**
- `ConfirmDialog` - Delete confirmation
- Form inputs with icons

**API Endpoints Called:**
- `GET /api/branches` - All branches
- `POST /api/create-branch` - Create branch
- `PUT /api/update-branch/:id` - Update branch
- `DELETE /api/delete-branch/:id` - Delete branch

**State Management:**
- React Query: `useQuery(['branches'])`
- Local state: `isModalOpen`, `editingBranch`, `branchToDelete`, `formData`
- Form data: code, name, address, type, parentBranchId

**User Interface:**
- Header with add button
- Data table with type badges
- Active status toggle button
- Edit/Delete actions
- Modal form for create/edit
- Type-specific fields (parent branch for BRANCH type)

**Permissions:**
- **Required Role:** SUPER_ADMIN only

---

### 22. Settings

**Route:** `/settings`

**Page Overview:**
- **Purpose:** System configuration and preferences
- **User Roles:** SUPER_ADMIN, BRANCH_MANAGER, CS_SUPERVISOR
- **Route Path:** `/settings`

**Key Features:**
- Security settings (password, 2FA)
- Appearance settings (theme, fonts)
- Machine parameters management
- Spare parts catalog
- Client types configuration
- Permissions management
- Database administration (super admin only)

**Sub-components Used:**
- `SecurityTab` - Security settings
- `AppearanceTab` - UI customization
- `MachineParametersTab` - Machine specs
- `SparePartsTab` - Parts catalog
- `ClientTypesTab` - Customer classification
- `PermissionsTab` - Role permissions
- `DatabaseAdmin` - DB management (super admin)

**API Endpoints Called:**
- Various settings endpoints
- `/api/machine-parameters`
- `/api/spare-parts`
- `/api/client-types`
- `/api/database` (super admin)

**State Management:**
- Local state: `activeTab`
- Conditional tab visibility based on role
- Default tab based on admin status

**User Interface:**
- Tab buttons with icons and colors
- Conditional tab display
- Admin-only tabs (machines, parts, client-types, permissions)
- Super admin tab (database)
- Card-based content areas

**Permissions:**
- **SUPER_ADMIN:** All tabs including Database
- **BRANCH_MANAGER, CS_SUPERVISOR:** Security, Appearance, limited admin tabs
- **Regular users:** Security, Appearance only

---

## Authentication Pages

### 23. Login

**Route:** `/login`

**Page Overview:**
- **Purpose:** User authentication
- **User Roles:** Public (pre-authentication)
- **Route Path:** `/login`

**Key Features:**
- Email and password authentication
- Error display
- Loading state
- JWT token storage
- Automatic redirect on success
- RTL layout

**Sub-components Used:**
- Lucide icons (Lock, Mail, Loader2, AlertCircle)

**API Endpoints Called:**
- `POST /api/login` - Authentication

**State Management:**
- Local state: `email`, `password`, `error`, `isLoading`
- Auth context: `login()` function for token/user storage

**User Interface:**
- Centered card layout
- Logo display
- Form with icons
- Error alert
- Loading spinner on submit
- "Forgot password" hint

**Permissions:**
- **Access:** Public (unauthenticated)
- **Redirect:** Authenticated users redirected to dashboard

---

## Additional Service Pages

### 24. Shipment Detail

**Route:** `/maintenance/shipments/:id`

**Page Overview:**
- **Purpose:** Detailed processing of individual maintenance shipments
- **User Roles:** CENTER_MANAGER, CENTER_TECH
- **Route Path:** `/maintenance/shipments/:id`

**Key Features:**
- Shipment header with order number and origin
- Receive confirmation for pending shipments
- Progress tracking bar
- Machine list with current status
- Status-based action buttons per machine
- Processing modal for repairs
- Back navigation

**Sub-components Used:**
- Shadcn Button, Badge, Progress
- `ProcessingModal` - Repair workflow
- Lucide icons (ArrowLeft, Box, Wrench, AlertTriangle, CheckCircle)

**API Endpoints Called:**
- `GET /api/maintenance/shipments` - All shipments (filtered client-side)
- `POST /api/maintenance/shipments/:id/receive` - Receive shipment
- `POST /api/maintenance/machine/:serial/transition` - Status transitions

**State Management:**
- React Query: `useQuery(['shipment', id])`
- URL params: `useParams()` for shipment ID
- Local state: `selectedMachine`, `isProcessingModalOpen`
- Mutations: Receive, status transitions

**User Interface:**
- Back button to list
- Header with shipment info
- Receive confirmation section (if pending)
- Progress bar (if received)
- Machine cards with status badges
- Action buttons based on status

**Permissions:**
- **Required Role:** CENTER_MANAGER, CENTER_TECH
- **Protected Route:** Yes

---

### 25. Track Machines

**Route:** `/track-machines`

**Page Overview:**
- **Purpose:** Track machines sent to maintenance center from branch perspective
- **User Roles:** Branch roles
- **Route Path:** `/track-machines`

**Key Features:**
- List of machines at center from this branch
- Status filtering
- Summary cards by status
- Machine details (serial, model, technician, customer)
- Cost information
- Activity logs timeline
- Export to Excel

**Sub-components Used:**
- Status config with icons and colors
- Export utility

**API Endpoints Called:**
- `GET /api/track-machines` - Machines with branch filter
- `GET /api/track-machines/summary` - Status counts

**State Management:**
- React Query: Queries for machines and summary
- Local state: `filterStatus`
- Refetch interval: 30 seconds

**User Interface:**
- Header with filter
- Summary cards row
- List view with machine info
- Status badges with icons
- Action hints for pending approvals
- Collapsible logs section

**Permissions:**
- **Required Role:** Branch customer service roles
- **Scope:** Only shows machines from user's branch

---

### 26. Assignments

**Route:** `/assignments`

**Page Overview:**
- **Purpose:** Manage service assignments at maintenance center
- **User Roles:** CENTER_MANAGER, CENTER_TECH
- **Route Path:** `/assignments`

**Key Features:**
- Assignment list with status
- Start work action
- Add parts and complete workflow
- Status filtering
- Statistics cards
- Recent activity logs

**Sub-components Used:**
- `CloseRequestModal` - For parts and completion
- Shadcn Button, Dialog

**API Endpoints Called:**
- `GET /api/service-assignments` - Assignments with filter
- `GET /api/inventory` - Spare parts
- `PUT /api/service-assignments/:id/start` - Start work
- `PUT /api/service-assignments/:id/complete` - Complete
- `PUT /api/service-assignments/:id/update-parts` - Update parts
- `POST /api/service-assignments/:id/request-approval` - Request approval

**State Management:**
- React Query: Queries for assignments and inventory
- Local state: `selectedAssignment`, `showPartsModal`, `filterStatus`
- Mutations: Start, complete, update parts

**User Interface:**
- Filter dropdown
- Statistics cards
- List view with machine info
- Status badges
- Action buttons based on status
- Parts/cost display
- Logs section

**Permissions:**
- **Required Role:** CENTER_MANAGER, CENTER_TECH

---

### 27. Approvals

**Route:** `/approvals`

**Page Overview:**
- **Purpose:** General approval request management
- **User Roles:** SUPER_ADMIN, CENTER_MANAGER
- **Route Path:** `/approvals`

**Key Features:**
- Approval request list
- Status filtering (Pending, Approved, Rejected)
- Request details (amount, notes, from branch)
- Approve/Reject actions
- Response notes

**Sub-components Used:**
- Lucide icons (CheckCircle, XCircle, Clock, DollarSign, MessageSquare)

**API Endpoints Called:**
- `GET /api/approvals` - Approval list (assumed endpoint)
- `POST /api/respond-to-approval/:id` - Respond to request

**State Management:**
- React Query: Query for approvals
- Local state: `filterStatus`, `selectedApproval`, `responseNotes`, `showResponseModal`, `responseType`

**User Interface:**
- Filter buttons
- List view with request cards
- Amount and source info
- Notes display
- Action buttons for pending
- Response modal with notes

**Permissions:**
- **Required Role:** SUPER_ADMIN, CENTER_MANAGER

---

## Architecture Notes

### Route Protection

All pages except Login are wrapped in `ProtectedRoute` component which:
- Validates JWT token
- Checks role-based access via `canAccessRoute()`
- Redirects to login if unauthorized

### Data Fetching Strategy

- **React Query** used for all server state
- **Refetch intervals** for real-time data (30-60 seconds)
- **Optimistic updates** for better UX
- **Query invalidation** on mutations

### State Management Patterns

- **Server State:** React Query
- **Local State:** useState, useReducer
- **Form State:** Custom hooks (usePaymentForm, useCustomerData)
- **URL State:** useSearchParams for filters and deep linking
- **Global State:** AuthContext, SettingsContext

### UI Consistency

- **RTL Layout:** All pages support Arabic (RTL)
- **Shadcn UI:** Base component library
- **Lucide Icons:** Consistent iconography
- **Tailwind CSS:** Utility-first styling
- **Responsive Design:** Mobile-first approach
- **Animation:** Framer Motion for transitions

### Permission System

- **Route-level:** ProtectedRoute with allowedRoles
- **Menu-level:** MENU_PERMISSIONS object
- **Action-level:** canPerformAction() helper
- **UI-level:** Conditional rendering based on role

---

## File Structure

```
frontend/src/pages/
├── Dashboard.tsx              # Main operational dashboard
├── ExecutiveDashboard.tsx     # Management analytics
├── AdminDashboard.tsx         # System admin overview
├── TechnicianDashboard.tsx    # Center workflow (unused route)
├── Requests.tsx               # Maintenance requests
├── MaintenanceBoard.tsx       # Kanban board (unused route)
├── MaintenanceShipments.tsx   # Incoming shipments
├── MaintenanceApprovals.tsx   # Cost approvals
├── Customers.tsx              # CRM with CustomerDetailCard
├── Warehouse.tsx              # Spare parts
├── MachineWarehouse.tsx       # Machine storage
├── SimWarehouse.tsx           # SIM inventory
├── ReceiveOrders.tsx          # Incoming transfers
├── TransferOrders.tsx         # Transfer management
├── Payments.tsx               # Payment recording
├── PendingPayments.tsx        # Settlement tracking
├── Receipts.tsx               # Sales & installments
├── Reports.tsx                # Strategic analytics
├── ProductionReports.tsx      # Operational reports
├── Users.tsx                  # User management
├── BranchesSettings.tsx       # Branch configuration
├── Settings.tsx               # System settings
├── Login.tsx                  # Authentication
├── ShipmentDetail.tsx         # Shipment processing
├── TrackMachines.tsx          # Machine tracking
├── Assignments.tsx            # Service assignments
└── Approvals.tsx              # Approval management
```

---

*Documentation generated for Smart Enterprise Suite*
*Last updated: January 2026*
