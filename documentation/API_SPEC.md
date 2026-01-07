# API Specification (Internal)

## Authentication
All requests (except `/auth/login`) require a Bearer token.
`Authorization: Bearer <token>`

---

## Core Endpoints

### 1. Warehouse (Machines)
- `GET /api/warehouse-machines`: List all machines in current branch.
- `GET /api/warehouse-machines/counts`: Grouped counts by status.
- `POST /api/warehouse-machines/import`: Bulk import from Excel/JSON.
- `POST /api/warehouse-machines/bulk-transfer`: Bulk transfer machines (with waybill).
- `POST /api/warehouse-machines/exchange`: Perform machine swap for customer.

### 2. Transfer Orders (Inter-branch)
- `GET /api/transfer-orders`: List all transfer orders (filtered by branch/status/type)
- `GET /api/transfer-orders/pending`: View incoming pending transfers
- `GET /api/transfer-orders/pending-serials`: Get serial numbers in pending transfers (for validation)
- `GET /api/transfer-orders/:id`: Get single transfer order details
- `POST /api/transfer-orders`: Create new transfer order (**with comprehensive validation**)
- `POST /api/transfer-orders/import`: Import transfer from Excel file
- `POST /api/transfer-orders/:id/receive`: Confirm receipt of items
- `GET /api/transfer-orders/template/:type`: Download Excel template (MACHINE/SIM)

**🛡️ Validation (v3.1.0):**
- ✅ Validates items not in pending transfers (ANY branch)
- ✅ Validates items exist in source branch with valid status
- ✅ Prevents status: `IN_TRANSIT`, `SOLD`, `ASSIGNED`, `UNDER_MAINTENANCE`
- ✅ Validates user permissions and branch access
- ✅ Auto-freezes items by setting status to `IN_TRANSIT`
- ✅ Detailed Arabic error messages

### 3. Inventory (Spare Parts)
- `GET /api/inventory`: Current stock levels.
- `GET /api/spare-parts`: List all parts in law.
- `GET /api/spare-parts/:id/price-logs`: History of cost changes for a part.
- `POST /api/inventory/transfer`: Move parts to another branch.

### 4. Maintenance Requests
- `POST /api/requests`: Create request (param `takeMachine: boolean` for receipt).

### 5. Settings, Permissions & Reports
- `GET /api/settings/client-types`: List all customer categories.
- `GET /api/permissions`: Get full permissions matrix.
- `POST /api/permissions/bulk`: Update multiple permissions at once.
- `GET /api/reports/executive`: High-level financial and performance analytics.
- `GET /api/dashboard/admin-summary`: System-wide stats (`SUPER_ADMIN` only).
- `GET /api/auth/profile`: Get user profile with `theme` and `fontFamily`.
- `PUT /api/auth/preferences`: Update `theme` or `fontFamily`.

---

## Response Formats

### Success
```json
{
  "id": "cmj...",
  "status": "SUCCESS",
  "data": { ... }
}
```

### Error (4xx, 5xx)
```json
{
  "error": "Short description of error",
  "details": "Extended debugging info (optional)"
}
```
