/**
 * SWAGGER/OPENAPI DOCUMENTATION EXAMPLES
 * 
 * **Last Updated**: January 1, 2026  
 * **Status**: ✅ COMPLETE (12/12 Phases) - Including Structured Logging
 * 
 * Add JSDoc comments above route handlers to auto-generate Swagger documentation.
 * The server.js file runs swaggerJsdoc to parse these comments.
 * 
 * Swagger docs are available at: http://localhost:5000/api-docs
 * 
 * NOTE: Logging is handled automatically by pino-http middleware.
 *       No need to add logging to JSDoc comments unless documenting
 *       specific audit log entries created by logAction().
 */

// ============================================
// GET ENDPOINTS EXAMPLES
// ============================================

/**
 * @route GET /api/customers
 * @group Customers
 * @summary Retrieve all customers with pagination
 * @security bearerAuth
 * @param {number} skip.query - Number of records to skip (default: 0)
 * @param {number} take.query - Number of records to return (default: 20, max: 100)
 * @returns {Array<Object>} 200 - List of customers
 * @returns {Object} 401 - Unauthorized
 * @returns {Object} 500 - Server error
 * @example
 * GET /api/customers?skip=0&take=20
 */

/**
 * @route GET /api/customers/:id
 * @group Customers
 * @summary Get a single customer by ID
 * @security bearerAuth
 * @param {string} id.path.required - Customer code (bkcode)
 * @returns {Object} 200 - Customer details
 * @returns {Object} 404 - Customer not found
 * @returns {Object} 403 - Access denied
 * @returns {Object} 401 - Unauthorized
 */

/**
 * @route GET /api/machines
 * @group Machines
 * @summary List all machines with optional filtering
 * @security bearerAuth
 * @param {string} status.query - Filter by status (ACTIVE, INACTIVE, REPAIR)
 * @param {string} model.query - Filter by machine model
 * @param {number} skip.query - Pagination offset
 * @param {number} take.query - Pagination limit
 * @returns {Array<Object>} 200 - Machine list with pagination metadata
 * @returns {Object} 400 - Invalid filter parameters
 * @returns {Object} 401 - Unauthorized
 */

// ============================================
// POST ENDPOINTS EXAMPLES
// ============================================

/**
 * @route POST /api/customers
 * @group Customers
 * @summary Create a new customer
 * @security bearerAuth
 * @param {Object} body.body.required - Customer data
 * @param {string} body.bkcode.required - Unique customer code
 * @param {string} body.client_name.required - Customer name
 * @param {string} body.email - Customer email
 * @param {string} body.phone - Customer phone
 * @param {string} body.address - Customer address
 * @returns {Object} 201 - Created customer object
 * @returns {Object} 400 - Validation error (invalid input)
 * @returns {Object} 401 - Unauthorized
 * @returns {Object} 409 - Conflict (duplicate customer code)
 * @example
 * POST /api/customers
 * {
 *   "bkcode": "CUST001",
 *   "client_name": "Ahmed's Store",
 *   "email": "ahmed@example.com",
 *   "phone": "01234567890",
 *   "address": "Cairo, Egypt"
 * }
 */

/**
 * @route POST /api/transfer-orders
 * @group Transfer Orders
 * @summary Create a new transfer order
 * @security bearerAuth
 * @param {Object} body.body.required - Transfer order data
 * @param {string} body.sourceWarehouseId.required - Source warehouse ID
 * @param {string} body.destinationWarehouseId.required - Destination warehouse ID
 * @param {Array<Object>} body.items.required - Array of items to transfer
 * @param {string} body.items[].machineId.required - Machine ID
 * @param {number} body.items[].quantity.required - Quantity to transfer
 * @returns {Object} 201 - Created transfer order
 * @returns {Object} 400 - Invalid input data
 * @returns {Object} 422 - Insufficient inventory
 * @example
 * POST /api/transfer-orders
 * {
 *   "sourceWarehouseId": "WH001",
 *   "destinationWarehouseId": "WH002",
 *   "items": [
 *     { "machineId": "MACH001", "quantity": 5 },
 *     { "machineId": "MACH002", "quantity": 3 }
 *   ]
 * }
 */

/**
 * @route POST /api/customers/:id/machines
 * @group Machines
 * @summary Add a machine to a customer
 * @security bearerAuth
 * @param {string} id.path.required - Customer ID
 * @param {Object} body.body.required - Machine data
 * @param {string} body.serialNumber.required - Machine serial number
 * @param {string} body.model.required - Machine model
 * @param {string} body.machineType - Type of machine (POS, SIM, etc)
 * @returns {Object} 201 - Created machine record
 * @returns {Object} 400 - Validation error
 * @returns {Object} 404 - Customer not found
 */

// ============================================
// PUT/PATCH ENDPOINTS EXAMPLES
// ============================================

/**
 * @route PUT /api/customers/:id
 * @group Customers
 * @summary Update a customer
 * @security bearerAuth
 * @param {string} id.path.required - Customer code (bkcode)
 * @param {Object} body.body - Fields to update (all optional)
 * @param {string} body.client_name - Updated customer name
 * @param {string} body.email - Updated email
 * @param {string} body.phone - Updated phone
 * @returns {Object} 200 - Updated customer
 * @returns {Object} 400 - Validation error
 * @returns {Object} 404 - Customer not found
 * @returns {Object} 403 - Access denied
 * @example
 * PUT /api/customers/CUST001
 * {
 *   "client_name": "Ahmed's Updated Store",
 *   "phone": "01029384756"
 * }
 */

/**
 * @route PATCH /api/machines/:id/status
 * @group Machines
 * @summary Update machine status
 * @security bearerAuth
 * @param {string} id.path.required - Machine ID
 * @param {Object} body.body.required
 * @param {string} body.status.required - New status (ACTIVE, INACTIVE, REPAIR, DECOMMISSIONED)
 * @param {string} body.reason - Reason for status change
 * @returns {Object} 200 - Updated machine
 * @returns {Object} 400 - Invalid status value
 * @returns {Object} 404 - Machine not found
 */

// ============================================
// DELETE ENDPOINTS EXAMPLES
// ============================================

/**
 * @route DELETE /api/customers/:id
 * @group Customers
 * @summary Delete a customer
 * @security bearerAuth
 * @param {string} id.path.required - Customer code
 * @returns {Object} 200 - Success message
 * @returns {Object} 404 - Customer not found
 * @returns {Object} 403 - Access denied
 * @returns {Object} 409 - Cannot delete (has active orders)
 */

/**
 * @route DELETE /api/machines/:id
 * @group Machines
 * @summary Delete a machine
 * @security bearerAuth
 * @param {string} id.path.required - Machine ID
 * @returns {Object} 200 - Success message
 * @returns {Object} 404 - Machine not found
 * @returns {Object} 409 - Cannot delete (has active transfers)
 */

// ============================================
// FILE UPLOAD ENDPOINTS
// ============================================

/**
 * @route POST /api/customers/import
 * @group Customers
 * @summary Import customers from Excel file
 * @security bearerAuth
 * @param {file} file.formData.required - Excel file (.xlsx or .xls)
 * @returns {Object} 200 - Import result with count and errors
 * @returns {Object} 400 - No file uploaded or invalid format
 * @returns {Object} 413 - File too large (max 50MB)
 * @example
 * POST /api/customers/import
 * Content-Type: multipart/form-data
 * file: @customers.xlsx
 */

/**
 * @route GET /api/machines/template
 * @group Machines
 * @summary Download machine import template
 * @security bearerAuth
 * @returns {file} 200 - Excel template file
 */

// ============================================
// ERROR RESPONSE EXAMPLES
// ============================================

/**
 * Error Response Format (standardized by errorHandler middleware):
 * {
 *   "error": "Descriptive error message",
 *   "code": "ERROR_CODE (e.g., VALIDATION_ERROR, NOT_FOUND)",
 *   "timestamp": "2024-01-01T12:00:00Z",
 *   "details": {} // Optional - validation error details
 * }
 * 
 * Common Error Codes:
 * - VALIDATION_ERROR (400)
 * - UNAUTHORIZED (401)
 * - FORBIDDEN (403)
 * - NOT_FOUND (404)
 * - CONFLICT (409)
 * - INTERNAL_ERROR (500)
 */

// ============================================
// AUTHENTICATION
// ============================================

/**
 * Bearer Token Authentication:
 * 
 * All endpoints marked with @security bearerAuth require a JWT token
 * 
 * Headers:
 * Authorization: Bearer <JWT_TOKEN>
 * 
 * Token expires in: 7 days (configurable in config/index.js)
 * 
 * 401 Response: { "error": "Invalid or expired token", "code": "UNAUTHORIZED" }
 */

// ============================================
// PAGINATION
// ============================================

/**
 * Query Parameters for List Endpoints:
 * 
 * - skip: number (default: 0) - Records to skip
 * - take: number (default: 20, max: 100) - Records to return
 * 
 * Response metadata:
 * {
 *   "data": [...],
 *   "pagination": {
 *     "total": 1234,
 *     "skip": 0,
 *     "take": 20,
 *     "hasNext": true,
 *     "hasPrev": false
 *   }
 * }
 */

module.exports = {};
