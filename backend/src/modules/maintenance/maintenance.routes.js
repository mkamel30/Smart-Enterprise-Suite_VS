const express = require('express');
const router = express.Router();
const { z } = require('zod');
const db = require('../../../db');
const { authenticateToken } = require('../../../middleware/auth');
const { validateRequest } = require('../../../middleware/validation');
const { success, error, paginated } = require('../../../utils/apiResponse');
const { logAction } = require('../../../utils/logger');
const asyncHandler = require('../../../utils/asyncHandler');
const requestService = require('./maintenance.service.js');

// Use individual assignments for clarity and to avoid any potential destructuring issues
const rateLimits = require('../../../middleware/rateLimits');
const createLimiter = rateLimits.createLimiter;
const updateLimiter = rateLimits.updateLimiter;
const deleteLimiter = rateLimits.deleteLimiter;

// ===================== VALIDATION SCHEMAS =====================

const idParamSchema = z.object({
  id: z.string().regex(/^[a-z0-9]{25}$/)
});

const createRequestSchema = z.object({
  customerId: z.string().min(1, 'العميل مطلوب'),
  posMachineId: z.string().optional().nullable(),
  complaint: z.string().min(1, 'الشكوى مطلوبة'),
  serialNumber: z.string().optional(),
  machineModel: z.string().optional(),
  machineManufacturer: z.string().optional(),
  notes: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM')
});

const updateRequestSchema = z.object({
  status: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  complaint: z.string().optional(),
  notes: z.string().optional(),
  technicianId: z.string().optional()
});

const statusUpdateSchema = z.object({
  status: z.string().min(1, 'الحالة مطلوبة'),
  notes: z.string().optional(),
  actionTaken: z.string().optional()
});

const listQuerySchema = z.object({
  status: z.string().optional(),
  priority: z.string().optional(),
  technicianId: z.string().optional(),
  customerId: z.string().optional(),
  q: z.string().optional(),
  limit: z.string().transform(v => parseInt(v)).optional(),
  offset: z.string().transform(v => parseInt(v)).optional(),
  branchId: z.string().optional(),
  includeRelations: z.string().transform(v => v === 'true').optional(),
  search: z.string().optional()
});

// ===================== ROUTES =====================

/**
 * @route GET /api/requests
 * @summary Get all maintenance requests
 * @security bearerAuth
 */
router.get(
  '/requests',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const filters = listQuerySchema.parse(req.query);
    const result = await requestService.getRequests(filters, req.user);
    return paginated(res, result.requests, result.total, filters.limit || 50, filters.offset || 0);
  })
);

/**
 * @route GET /api/requests/stats
 * @summary Get request statistics
 * @security bearerAuth
 */
router.get(
  '/requests/stats',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const stats = await requestService.getRequestStats(req.user);
    return success(res, stats);
  })
);

/**
 * @route GET /api/requests/:id
 * @summary Get request details
 * @security bearerAuth
 * @param {string} id - Request ID
 */
router.get(
  '/requests/:id',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const request = await requestService.getRequestById(id, req.user);
    return success(res, request);
  })
);

/**
 * @route POST /api/requests
 * @summary Create a new maintenance request
 * @security bearerAuth
 */
router.post(
  '/requests',
  authenticateToken,
  createLimiter,
  validateRequest(createRequestSchema),
  asyncHandler(async (req, res) => {
    // Translate field names from frontend to service
    const data = {
      ...req.body,
      complaint: req.body.problemDescription || req.body.complaint,
      posMachineId: req.body.machineId || req.body.posMachineId
    };
    const request = await requestService.createRequest(data, req.user);
    return success(res, request, 201);
  })
);

/**
 * @route PUT /api/requests/:id
 * @summary Update a maintenance request
 * @security bearerAuth
 * @param {string} id - Request ID
 */
router.put(
  '/requests/:id',
  authenticateToken,
  updateLimiter,
  validateRequest(updateRequestSchema),
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const request = await requestService.updateRequest(id, req.body, req.user);
    return success(res, request);
  })
);

/**
 * @route PATCH /api/requests/:id/status
 * @summary Update request status
 * @security bearerAuth
 * @param {string} id - Request ID
 */
router.patch(
  '/requests/:id/status',
  authenticateToken,
  validateRequest(statusUpdateSchema),
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const request = await requestService.updateRequestStatus(id, req.body, req.user);
    return success(res, request);
  })
);

/**
 * @route POST /api/requests/:id/assign
 * @summary Assign technician to request
 * @security bearerAuth
 * @param {string} id - Request ID
 */
router.post(
  '/requests/:id/assign',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const { technicianId } = z.object({ technicianId: z.string() }).parse(req.body);
    const request = await requestService.assignTechnician(id, technicianId, req.user);
    return success(res, request);
  })
);

/**
 * @route DELETE /api/requests/:id
 * @summary Delete maintenance request
 * @security bearerAuth
 * @param {string} id - Request ID
 * @returns {Object} Success message
 */
/**
 * @route PUT /api/requests/:id/close
 * @summary Close maintenance request with parts and payment
 * @security bearerAuth
 * @param {string} id - Request ID
 */
router.put(
  '/requests/:id/close',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    // Translate field names from frontend to service
    const data = {
      ...req.body,
      actionTaken: req.body.actionTaken,
      usedParts: req.body.usedParts,
      receiptNumber: req.body.receiptNumber
    };
    const request = await requestService.closeRequest(id, data.actionTaken, data.usedParts, req.user, data.receiptNumber);
    return success(res, request);
  })
);

router.delete(
  '/requests/:id',
  authenticateToken,
  deleteLimiter,
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    await requestService.deleteRequest(id, req.user);
    return success(res, { message: 'Request deleted successfully' });
  })
);

module.exports = router;
