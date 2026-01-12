# Production Report APIs - Reference Guide

## Overview

5 production-ready report APIs for Smart Enterprise Suite analytics dashboard matching the detailed specification.

---

## Endpoints Summary

| Endpoint | Description | Key Params |
|----------|-------------|------------|
| `/api/reports/governorate-performance` | Branch/geographic analytics | `from`, `to`, `branchId`, `page`, `pageSize` |
| `/api/reports/inventory-movement` | Monthly spare parts tracking | `from`, `to`, `branchId`, `warehouseId`, `groupBy`, `page` |
| `/api/reports/pos-stock` | Warehouse inventory snapshot | `branchId`, `model`, `sortBy`, `includeOutOfStock` |
| `/api/reports/pos-sales-monthly` | Monthly sales by status | `from`, `to`, `branchId`, `status`, `page` |
| `/api/reports/pos-sales-daily` | Daily sales with breakdowns | `from`, `to`, `branchId`, `model`, `segment`, `agentId`, `sortBy` |

---

## Response Format (All Endpoints)

```json
{
  "rows": [...],        // or "timeline" for time-series
  "summary": {...},     // Aggregated totals
  "branchBreakdown": [...],  // Per-branch data (where applicable)
  "pagination": {
    "page": 1,
    "pageSize": 50,
    "totalRows": 28,
    "totalPages": 1,
    "hasNextPage": false
  },
  "metadata": {
    "generatedAt": "2026-01-10T01:15:00Z",
    "timezone": "Africa/Cairo",
    "currency": "EGP",
    "executionTimeMs": 245,
    "dateRange": { "from": "...", "to": "...", "days": 365 },
    "filters": {...}
  }
}
```

---

## 1. Governorate Performance

```bash
GET /api/reports/governorate-performance?from=2025-01-01&to=2025-12-31
```

**Response includes:**
- `metrics`: activities, officesServed, machineCount, closedRequests, closureRate
- `organization`: financeDeptsCount, requiredFinanceOffices, requiredCenters, shariaOfficesCount
- `summary`: totals across all branches

---

## 2. Inventory Movement

```bash
GET /api/reports/inventory-movement?from=2024-01-01&to=2025-12-31&groupBy=month
```

**Response includes:**
- `timeline`: monthly allocation (paid vs free/warranty)
- `branchBreakdown`: per-warehouse totals
- `movement`: inbound, outbound, netChange

---

## 3. POS Stock

```bash
GET /api/reports/pos-stock?model=Pax%20D230&sortBy=stock
```

**Response includes:**
- `rows`: per-branch stock with model breakdown
- `modelSummary`: total stock per model
- Stock status: NORMAL, LOW, CRITICAL

---

## 4. POS Sales Monthly

```bash
GET /api/reports/pos-sales-monthly?from=2025-01-01&to=2025-12-31
```

**Response includes:**
- `timeline`: monthly machine counts by status (cash, review, financed)
- `revenue`: estimated totals per period
- `branchBreakdown`: top/lowest performers

---

## 5. POS Sales Daily

```bash
GET /api/reports/pos-sales-daily?from=2026-01-01&to=2026-01-10&sortBy=date
```

**Response includes:**
- `timeline`: daily breakdown with dayOfWeek
- `modelDistribution`: sales by machine model
- `segmentDistribution`: sales by customer segment

---

## Branch Isolation

All endpoints enforce branch isolation:
- **SUPER_ADMIN / MANAGEMENT**: See all branches
- **Other roles**: Automatically filtered to user's branch

---

## Frontend Integration

```typescript
const response = await api.get('/api/reports/pos-sales-monthly', {
  params: { from: '2025-01-01', to: '2025-12-31' }
});
const { timeline, branchBreakdown, summary, pagination, metadata } = response.data;
```
