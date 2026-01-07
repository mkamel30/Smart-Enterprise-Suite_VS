# Backend Quality Assurance & Testing Guide

This document is the **single source of truth** for backend QA, serving as the definitive guide for routes, metrics, logging standards, and testing procedures.

## 1. API Sanity Check & Route Map

Below is the verified map of active API endpoints. All routes are prefixed with the base URL (e.g., `http://localhost:5000`).

| Feature | Base Path | Router File | Notes |
|---------|-----------|-------------|-------|
| **Auth** | `/api/auth` | `routes/auth.js` | Login, Profile, Preferences |
| **Dashboard** | `/api/dashboard` | `routes/dashboard.js` | Metrics, Stats, Search |
| **Executive** | `/api/executive-dashboard` | `routes/executive-dashboard.js` | Admin analytics |
| **Users** | `/api/users` | `routes/users.js` | User management |
| **Customers** | `/api/customers` | `routes/customers.js` | Client CRUD, `/lite` dropdown |
| **Technicians** | `/api/technicians` | `routes/technicians.js` | Technician list & stats |
| **Machines** | `/api/machines` | `routes/machines.js` | Machine ops (Import/Export) |
| **Machine History** | `/api/machines/:sn/history` | `routes/machine-history.js` | Machine timeline view |
| **Requests** | `/api/requests` | `routes/requests.js` | Maintenance requests (Mounted at `/api`) |
| **Repair Count** | `/api/requests/...` | `routes/repair-count.js` | Monthly repair stats |
| **Workflow** | `/api/machine-workflow` | `routes/machine-workflow.js` | Kanban & State Transitions |
| **Stats** | `/api/stats/dashboard` | `routes/stats.js` | General statistics |
| **Sales** | `/api/sales` | `routes/sales.js` | Sales operations |
| **Inventory** | `/api/spare-parts` | `routes/warehouse.js` | Spare parts management |
| **Warehouse** | `/api/warehouse-machines` | `routes/warehouse-machines.js` | Machine inventory |

### Recent Fixes:
- **`/api/technicians`**: Previously 404. Fixed by mounting `routes/technicians.js` correctly.
- **`/api/customers/lite`**: Previously 404. Added simplified endpoint for dropdowns.
- **`/api/machines`**: Fixed double-prefix issue (`/api/machines/machines` -> `/api/machines`).
- **`/api/settings`**: Removed redundant mount to prevent confusion. Access machine parameters via `/api/machine-parameters`.

## 2. Dashboard Accuracy & Metrics

Accuracy is ensured by calculating metrics directly from the database using `prisma.aggregate` and `count`, scoped by `branchId` where applicable.

| Metric | Source Table | Filter Logic | Notes |
|--------|--------------|--------------|-------|
| **Daily Operations** | `SystemLog` | `createdAt >= today` | Activity pulse |
| **Monthly Revenue** | `Payment` | `currentMonth` | SUM of amounts |
| **Open Requests** | `MaintenanceRequest` | `status='Open'` | Workload indicator |
| **Inventory Health** | `InventoryItem` | `quantity < minLevel` | Stock alerts |
| **Active Branches** | `Branch` | `isActive=true` | Global count |

*See `/api/dashboard/metrics-reference` for live definitions.*

## 3. Logging Standard

The system uses **Pino** for structured logging.
- **HTTP/Network**: Handled by `pino-http` middleware in `server.js`. Redacts sensitive headers/body.
- **Application Logic**: Use the global logger or `asyncHandler` wrapper.
- **Error Handling**: `asyncHandler` automatically captures and logs errors with stack traces and user context.

**Pattern:**
```javascript
const { asyncHandler } = require('../utils/errorHandler');
// Route is automatically protected with logging
router.get('/', asyncHandler(async (req, res) => {
    // Business logic
}));
```

## 4. Automated Testing

An integration test suite is set up using **Jest** and **Supertest**.
Tests are located in `backend/tests/integration.test.js`.

### Prerequisites
- Node.js dependencies installed (`npm install`)
- Valid `.env` file (or relies on defaults)

### Running Tests
To run the full integration suite:

```powershell
# Run from backend directory
npm test
```

### Test Scope
1.  **Health Check**: Verifies server is up (`GET /health`).
2.  **Auth Bypass**: **Mocked Authentication** is used to test protected routes without needing valid credentials or tokens.
3.  **Dashboard Data**: Validates structure of dashboard response.
4.  **Data Lists**: Checks `/api/machines`, `/api/technicians`, `/api/customers/lite` return arrays.
5.  **Environment**: Ensures `JWT_SECRET` and other configs function in test mode.
6.  **Seeded Data**: Tests assume the presence of standard roles (e.g., `SUPER_ADMIN`) and basic data but do not modify database state.

## 5. Maintenance Commands

**Clean Start (Dev):**
```bash
npm run dev
```

**Run Tests:**
```bash
npm test
```

**Reset Database (If needed for testing):**
*Note: This wipes data! Use with caution.*
```bash
npx prisma migrate reset
```
