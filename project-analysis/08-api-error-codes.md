# API Error Codes Reference

Complete reference for all error scenarios in Smart Enterprise Suite API.

## Table of Contents

1. [Error Response Format](#1-error-response-format)
2. [HTTP Status Codes](#2-http-status-codes)
3. [Custom Error Classes](#3-custom-error-classes)
4. [Error Codes Reference](#4-error-codes-reference)
5. [Common Error Scenarios](#5-common-error-scenarios)
6. [Troubleshooting Guide](#6-troubleshooting-guide)

---

## 1. Error Response Format

### Standard Error JSON Structure

All API errors follow a consistent JSON structure:

```json
{
  "error": {
    "message": "Human-readable error description",
    "code": "ERROR_CODE",
    "timestamp": "2026-01-31T12:34:56.789Z",
    "details": {}, // Optional: Additional error context
    "retryAfter": 60 // Optional: For rate limit errors (seconds)
  }
}
```

### Field-Level Validation Errors

When validation fails, the `details` field contains field-specific errors:

```json
{
  "error": {
    "message": "Validation failed",
    "code": "VALIDATION_ERROR",
    "timestamp": "2026-01-31T12:34:56.789Z",
    "fields": {
      "email": "Invalid email format",
      "branchId": "Branch ID is required",
      "serialNumber": "Serial number must be at least 8 characters"
    }
  }
}
```

### Stack Traces: Development vs Production

| Environment | Stack Traces | Debug Info |
|-------------|--------------|------------|
| **Development** | ✅ Full stack trace included in `debug.stack` | All error details exposed |
| **Production** | ❌ Stack traces hidden | Generic messages only |

**Example (Development):**
```json
{
  "error": {
    "message": "Validation failed",
    "code": "VALIDATION_ERROR",
    "timestamp": "2026-01-31T12:34:56.789Z",
    "fields": { "email": "Required" },
    "debug": {
      "stack": "ValidationError: Validation failed\n    at validateRequest (middleware/validation.js:35)"
    }
  }
}
```

**Example (Production):**
```json
{
  "error": {
    "message": "Validation failed",
    "code": "VALIDATION_ERROR",
    "timestamp": "2026-01-31T12:34:56.789Z"
  }
}
```

---

## 2. HTTP Status Codes

| Status Code | Meaning | Usage |
|-------------|---------|-------|
| **400** | Bad Request | Validation errors, malformed requests |
| **401** | Unauthorized | Missing/invalid authentication |
| **403** | Forbidden | Insufficient permissions |
| **404** | Not Found | Resource doesn't exist |
| **409** | Conflict | Duplicate data, concurrent modification |
| **422** | Unprocessable Entity | Semantic errors (rarely used) |
| **429** | Too Many Requests | Rate limit exceeded |
| **500** | Internal Server Error | Server-side errors |

### Status Code by Category

| Category | Status Codes |
|----------|-------------|
| **Client Errors** | 400, 401, 403, 404, 409, 422, 429 |
| **Server Errors** | 500, 502, 503, 504 |

---

## 3. Custom Error Classes

### Error Class Hierarchy

```
Error (Node.js base)
  └── AppError (base custom error)
        ├── ValidationError (400)
        ├── NotFoundError (404)
        ├── UnauthorizedError (401)
        ├── ForbiddenError (403)
        ├── ConflictError (409)
        └── RateLimitError (429)
```

### Class Definitions

| Class | File | Status | Default Message |
|-------|------|--------|-----------------|
| `AppError` | `utils/errors.js` | 500 | Custom message |
| `ValidationError` | `utils/errors.js` | 400 | Validation failed |
| `NotFoundError` | `utils/errors.js` | 404 | {Resource} not found |
| `UnauthorizedError` | `utils/errors.js` | 401 | Unauthorized |
| `ForbiddenError` | `utils/errors.js` | 403 | Access denied |
| `ConflictError` | `utils/errors.js` | 409 | Custom message |
| `RateLimitError` | `utils/errorHandler.js` | 429 | Too many requests |

### Usage Examples

```javascript
const { AppError, NotFoundError, ValidationError } = require('../utils/errorHandler');

// Throw basic error
throw new AppError('Branch ID is required', 400, 'MISSING_BRANCH');

// Throw not found
throw new NotFoundError('Machine');
// Results in: "Machine not found"

// Throw validation with details
throw new ValidationError('Invalid input', { 
  email: 'Invalid format',
  phone: 'Required' 
});
```

---

## 4. Error Codes Reference

### 4.1 Authentication & Authorization Errors

| Error Code | HTTP Status | Description | Example Message | Common Causes |
|------------|-------------|-------------|-----------------|---------------|
| `NO_TOKEN` | 401 | Missing JWT token | "Access token required" | No Authorization header, malformed header |
| `TOKEN_EXPIRED` | 401 | JWT token expired | "Token expired" | Session timeout, token expiry reached |
| `INVALID_TOKEN` | 401 | Invalid JWT token | "Invalid token" | Tampered token, wrong secret |
| `REFRESH_TOKEN_EXPIRED` | 401 | Refresh token expired | "Refresh token expired" | Long inactive session |
| `INVALID_REFRESH_TOKEN` | 401 | Invalid refresh token | "Invalid refresh token" | Refresh token rotation |
| `UNAUTHORIZED` | 401 | General auth failure | "Unauthorized" | Login failed, wrong credentials |
| `NO_AUTH` | 401 | No authentication | "Authentication required" | Missing token in protected route |
| `FORBIDDEN` | 403 | Insufficient permissions | "Admin access required" | Wrong role, no permission |

### 4.2 Validation Errors

| Error Code | HTTP Status | Description | Example Message | Common Causes |
|------------|-------------|-------------|-----------------|---------------|
| `VALIDATION_ERROR` | 400 | Request body validation | "Validation failed" | Missing required fields, invalid formats |
| `QUERY_VALIDATION_ERROR` | 400 | Query params validation | "Invalid query parameters" | Invalid filters, wrong data types |
| `PARAM_VALIDATION_ERROR` | 400 | URL params validation | "Invalid parameters" | Wrong ID format, missing route params |

### 4.3 Resource Errors

| Error Code | HTTP Status | Description | Example Message | Common Causes |
|------------|-------------|-------------|-----------------|---------------|
| `NOT_FOUND` | 404 | Resource doesn't exist | "Machine not found" | Wrong ID, deleted resource |
| `ROUTE_NOT_FOUND` | 404 | API endpoint not found | "Route /api/unknown not found" | Wrong URL, removed endpoint |
| `DUPLICATE_RECORD` | 409 | Unique constraint violation | "Record with this email already exists" | Duplicate email, serial number |
| `CONFLICT` | 409 | Business logic conflict | "Machine is already sold" | Invalid state transitions |

### 4.4 Database Errors

| Error Code | HTTP Status | Description | Example Message | Common Causes |
|------------|-------------|-------------|-----------------|---------------|
| `FOREIGN_KEY_ERROR` | 400 | Referential integrity | "Cannot delete record: used by other records" | Deleting referenced records |
| `INVALID_RELATION` | 400 | Invalid relation | "Invalid relation reference" | Wrong foreign key |
| `RELATION_REQUIRED` | 400 | Missing required relation | "Required relation not found" | Missing parent record |

### 4.5 Rate Limiting Errors

| Error Code | HTTP Status | Description | Retry After | Common Causes |
|------------|-------------|-------------|-------------|---------------|
| `RATE_LIMIT_EXCEEDED` | 429 | General rate limit | 60s | Too many API calls |
| `LOGIN_RATE_LIMIT_EXCEEDED` | 429 | Login attempts exceeded | 15min | Brute force attempts |
| `PASSWORD_RESET_RATE_LIMIT_EXCEEDED` | 429 | Password reset limit | 1hr | Too many reset requests |
| `CREATE_RATE_LIMIT_EXCEEDED` | 429 | Creation limit | 15min | Bulk creation abuse |
| `UPDATE_RATE_LIMIT_EXCEEDED` | 429 | Update limit | 15min | Bulk update abuse |
| `DELETE_RATE_LIMIT_EXCEEDED` | 429 | Deletion limit | 15min | Bulk deletion abuse |
| `UPLOAD_RATE_LIMIT_EXCEEDED` | 429 | File upload limit | 1hr | Too many uploads |

### 4.6 Server Errors

| Error Code | HTTP Status | Description | Example Message | Common Causes |
|------------|-------------|-------------|-----------------|---------------|
| `INTERNAL_ERROR` | 500 | Generic server error | "Internal Server Error" | Unexpected exceptions |
| `AUTH_ERROR` | 500 | Auth system failure | "Authentication failed" | JWT secret issues, crypto errors |
| `DATABASE_ERROR` | 500 | Database failure | "Database connection failed" | DB down, network issues |

---

## 5. Common Error Scenarios

### 5.1 Authentication Failures

**Scenario 1: Missing Token**
```javascript
// Request
GET /api/machines
// No Authorization header

// Response (401)
{
  "error": {
    "message": "Access token required",
    "code": "NO_TOKEN",
    "timestamp": "2026-01-31T12:34:56.789Z"
  }
}

// Solution: Include Authorization: Bearer <token> header
```

**Scenario 2: Expired Token**
```javascript
// Request
GET /api/machines
Authorization: Bearer eyJhbGciOiJIUzI1NiIs... (expired)

// Response (401)
{
  "error": {
    "message": "Token expired",
    "code": "TOKEN_EXPIRED",
    "timestamp": "2026-01-31T12:34:56.789Z"
  }
}

// Solution: Refresh token or re-login
```

**Scenario 3: Invalid Credentials**
```javascript
// Request
POST /api/auth/login
{
  "identifier": "user@example.com",
  "password": "wrongpassword"
}

// Response (401)
{
  "error": {
    "message": "Unauthorized",
    "code": "UNAUTHORIZED",
    "timestamp": "2026-01-31T12:34:56.789Z"
  }
}

// Solution: Check username/email and password
```

### 5.2 Permission Denied

**Scenario 1: Role Restriction**
```javascript
// User role: TECHNICIAN
// Request
POST /api/admin/users

// Response (403)
{
  "error": {
    "message": "Admin access required",
    "code": "FORBIDDEN",
    "timestamp": "2026-01-31T12:34:56.789Z"
  }
}

// Solution: Contact admin to upgrade role
```

**Scenario 2: Missing Specific Permission**
```javascript
// Request
POST /api/transfer-orders
// User lacks 'transfers:send:new' permission

// Response (403)
{
  "error": {
    "message": "Permission denied",
    "required": ["transfers:send:new"],
    "userRole": "CS_AGENT"
  }
}

// Solution: Request permission from supervisor
```

**Scenario 3: Branch Access Denied**
```javascript
// User branchId: 1
// Request
GET /api/machines?branchId=2

// Response (403)
{
  "error": {
    "message": "Access denied for this branch",
    "code": "FORBIDDEN",
    "timestamp": "2026-01-31T12:34:56.789Z"
  }
}

// Solution: Only access your assigned branch
```

### 5.3 Resource Not Found

**Scenario 1: Invalid Machine ID**
```javascript
// Request
GET /api/machines/99999

// Response (404)
{
  "error": {
    "message": "Machine not found",
    "code": "NOT_FOUND",
    "timestamp": "2026-01-31T12:34:56.789Z"
  }
}

// Solution: Verify machine ID exists
```

**Scenario 2: Missing Route**
```javascript
// Request
GET /api/nonexistent

// Response (404)
{
  "error": {
    "message": "Route /api/nonexistent not found",
    "code": "ROUTE_NOT_FOUND",
    "timestamp": "2026-01-31T12:34:56.789Z"
  }
}

// Solution: Check API documentation for correct endpoint
```

### 5.4 Validation Failures

**Scenario 1: Create Sale - Missing Fields**
```javascript
// Request
POST /api/sales
{
  "customerId": "123",
  // Missing: branchId, machineSerial, price
}

// Response (400)
{
  "error": {
    "message": "Validation failed",
    "code": "VALIDATION_ERROR",
    "fields": {
      "branchId": "Required",
      "machineSerial": "Required",
      "price": "Must be a positive number"
    },
    "timestamp": "2026-01-31T12:34:56.789Z"
  }
}

// Solution: Include all required fields
```

**Scenario 2: Invalid Query Parameters**
```javascript
// Request
GET /api/customers?page=abc&limit=-1

// Response (400)
{
  "error": {
    "message": "Invalid query parameters",
    "code": "QUERY_VALIDATION_ERROR",
    "fields": {
      "page": "Must be a positive integer",
      "limit": "Must be between 1 and 100"
    },
    "timestamp": "2026-01-31T12:34:56.789Z"
  }
}

// Solution: Use valid pagination values
```

### 5.5 Conflict Errors

**Scenario 1: Duplicate Serial Number**
```javascript
// Request
POST /api/machines
{
  "serialNumber": "POS12345678",
  // ... other fields
}

// Response (409)
{
  "error": {
    "message": "Record with this serialNumber already exists",
    "code": "DUPLICATE_RECORD",
    "timestamp": "2026-01-31T12:34:56.789Z"
  }
}

// Solution: Use unique serial number
```

**Scenario 2: Duplicate Receipt Number**
```javascript
// Request
POST /api/sales/installments/123/pay
{
  "receiptNumber": "RCP001",
  "amount": 500
}

// Response (409)
{
  "error": {
    "message": "Receipt number already exists",
    "code": "CONFLICT",
    "timestamp": "2026-01-31T12:34:56.789Z"
  }
}

// Solution: Use unique receipt number
```

**Scenario 3: Invalid State Transition**
```javascript
// Request
POST /api/warehouse-machines/123/receive-return
// Machine status: AVAILABLE (not RETURNING)

// Response (400)
{
  "error": {
    "message": "Machine is not in 'returning' status. Current: AVAILABLE",
    "code": "CONFLICT",
    "timestamp": "2026-01-31T12:34:56.789Z"
  }
}

// Solution: Only receive machines in RETURNING status
```

### 5.6 Rate Limit Exceeded

**Scenario 1: Too Many Login Attempts**
```javascript
// Request (10th failed attempt in 15 minutes)
POST /api/auth/login

// Response (429)
{
  "error": {
    "message": "Too many login attempts, please try again in 15 minutes",
    "code": "LOGIN_RATE_LIMIT_EXCEEDED",
    "retryAfter": "2026-01-31T12:49:56.789Z",
    "timestamp": "2026-01-31T12:34:56.789Z"
  }
}

// Solution: Wait for cooldown period
```

**Scenario 2: API Rate Limit**
```javascript
// Response Headers
RateLimit-Limit: 1000
RateLimit-Remaining: 0
RateLimit-Reset: 1643624096

// Response (429)
{
  "error": {
    "message": "Too many requests, please try again later",
    "code": "RATE_LIMIT_EXCEEDED",
    "retryAfter": 60,
    "timestamp": "2026-01-31T12:34:56.789Z"
  }
}

// Solution: Implement request throttling
```

### 5.7 Database Errors

**Scenario 1: Foreign Key Constraint**
```javascript
// Request
DELETE /api/customers/123
// Customer has active machines

// Response (400)
{
  "error": {
    "message": "Cannot delete record: used by other records",
    "code": "FOREIGN_KEY_ERROR",
    "timestamp": "2026-01-31T12:34:56.789Z"
  }
}

// Solution: Delete related records first or use soft delete
```

**Scenario 2: Invalid Relation**
```javascript
// Request
POST /api/sales
{
  "customerId": "99999", // Doesn't exist
  "machineSerial": "POS12345678"
}

// Response (400)
{
  "error": {
    "message": "Invalid relation reference",
    "code": "INVALID_RELATION",
    "timestamp": "2026-01-31T12:34:56.789Z"
  }
}

// Solution: Verify customer ID exists
```

---

## 6. Troubleshooting Guide

### 6.1 Error Code Quick Reference

| Error Code | First Check | Likely Fix |
|------------|-------------|------------|
| `NO_TOKEN` | Authorization header present? | Add `Authorization: Bearer <token>` |
| `TOKEN_EXPIRED` | Token age | Refresh token or re-login |
| `INVALID_TOKEN` | Token format | Regenerate token |
| `FORBIDDEN` | User role/permissions | Check `middleware/permissions.js` |
| `NOT_FOUND` | Resource ID | Verify ID exists in database |
| `VALIDATION_ERROR` | Request body | Check required fields in schema |
| `DUPLICATE_RECORD` | Unique fields | Use different value for unique field |
| `RATE_LIMIT_EXCEEDED` | Request frequency | Add delays between requests |
| `INTERNAL_ERROR` | Server logs | Check application logs |

### 6.2 Debugging Tips

**Enable Debug Mode**
```bash
# Set environment to development for stack traces
NODE_ENV=development npm start
```

**Check Request/Response**
```javascript
// Add logging in your client
fetch('/api/endpoint', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
})
.then(async res => {
  if (!res.ok) {
    const error = await res.json();
    console.error('API Error:', error);
    console.error('Status:', res.status);
    console.error('Headers:', Object.fromEntries(res.headers));
  }
});
```

**Validate Request Format**
```javascript
// Always set Content-Type for POST/PUT
headers: {
  'Content-Type': 'application/json'
}

// Stringify JSON body
body: JSON.stringify(data)
```

**Check Rate Limit Headers**
```javascript
// Monitor your rate limit status
const remaining = response.headers.get('RateLimit-Remaining');
const reset = response.headers.get('RateLimit-Reset');
console.log(`Requests remaining: ${remaining}, resets at: ${new Date(reset * 1000)}`);
```

### 6.3 Common Fixes by Endpoint Category

**Authentication Endpoints**
| Issue | Fix |
|-------|-----|
| 401 on login | Check username/email and password |
| Token rejected | Verify token hasn't expired |
| Can't access protected route | Ensure `authenticateToken` middleware is passed |

**CRUD Endpoints**
| Issue | Fix |
|-------|-----|
| 400 validation error | Check all required fields in request schema |
| 404 not found | Verify resource ID exists |
| 403 forbidden | Check user role has required permission |
| 409 duplicate | Use unique values for unique fields |

**File Upload Endpoints**
| Issue | Fix |
|-------|-----|
| 400 no file | Include file in multipart/form-data |
| 429 rate limit | Wait between uploads |
| 413 payload too large | Compress file or split into chunks |

### 6.4 Error Logs Location

| Environment | Log Location | Access |
|-------------|--------------|--------|
| Development | Console output | Terminal |
| Production | File system / CloudWatch | `/var/log/smart-enterprise/` |
| Docker | Container logs | `docker logs <container>` |

**Log Format**
```json
{
  "level": "error",
  "code": "INTERNAL_ERROR",
  "message": "Database connection failed",
  "statusCode": 500,
  "path": "/api/machines",
  "method": "GET",
  "userId": "123",
  "userRole": "ADMIN",
  "ip": "192.168.1.100",
  "timestamp": "2026-01-31T12:34:56.789Z",
  "err": { /* Full error object */ }
}
```

### 6.5 Getting Help

When reporting an error, include:

1. **Error Response**: Full JSON response body
2. **Request Details**: Method, URL, headers (without token)
3. **Timestamp**: When error occurred
4. **User Info**: Role, branch (not credentials)
5. **Steps to Reproduce**: Minimal reproducible example

**Example Support Request:**
```
Error Code: VALIDATION_ERROR
Endpoint: POST /api/sales
Status: 400
Timestamp: 2026-01-31T12:34:56.789Z
User Role: BRANCH_MANAGER
Branch: 2
Request Body: { "customerId": "123", "price": 1000 }
Error: { "fields": { "machineSerial": "Required", "branchId": "Required" } }
```

---

## Appendix: Error Codes Summary Table

| Code | Status | Description | File Location |
|------|--------|-------------|---------------|
| NO_TOKEN | 401 | Missing authentication | `middleware/auth.js:31` |
| TOKEN_EXPIRED | 401 | JWT expired | `middleware/auth.js:54` |
| INVALID_TOKEN | 401 | Invalid JWT | `middleware/auth.js:64` |
| REFRESH_TOKEN_EXPIRED | 401 | Refresh expired | `middleware/auth.js:232` |
| UNAUTHORIZED | 401 | Auth failure | `utils/errors.js:30` |
| NO_AUTH | 401 | Missing auth | `middleware/auth.js:98` |
| FORBIDDEN | 403 | No permission | `utils/errors.js:36` |
| VALIDATION_ERROR | 400 | Validation failed | `utils/errors.js:17` |
| QUERY_VALIDATION_ERROR | 400 | Query invalid | `middleware/validation.js:85` |
| PARAM_VALIDATION_ERROR | 400 | Params invalid | `middleware/validation.js:131` |
| NOT_FOUND | 404 | Resource missing | `utils/errors.js:24` |
| ROUTE_NOT_FOUND | 404 | Endpoint missing | `utils/errorHandler.js:181` |
| CONFLICT | 409 | Business conflict | `utils/errors.js:42` |
| DUPLICATE_RECORD | 409 | Unique violation | `utils/errorHandler.js:82` |
| FOREIGN_KEY_ERROR | 400 | Referential integrity | `utils/errorHandler.js:99` |
| INVALID_RELATION | 400 | Bad relation | `utils/errorHandler.js:94` |
| RELATION_REQUIRED | 400 | Missing relation | `utils/errorHandler.js:104` |
| RATE_LIMIT_EXCEEDED | 429 | Rate limited | `utils/errorHandler.js:48` |
| LOGIN_RATE_LIMIT_EXCEEDED | 429 | Login blocked | `middleware/rateLimits.js:86` |
| INTERNAL_ERROR | 500 | Server error | `utils/errors.js:6` |

---

*Document Version: 1.0*  
*Last Updated: 2026-01-31*  
*Compatible with: Smart Enterprise Suite v1.0+*