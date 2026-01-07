const express = require('express');
const router = express.Router();
const { z } = require('zod');

// Database and services
const db = require('../db');
const requestService = require('../services/requestService');

// Middleware
const { authenticateToken, requireManager } = require('../middleware/auth');
const { getBranchFilter } = require('../middleware/permissions');
const { validateRequest, validateQuery } = require('../middleware/validation');
const { createLimiter, analyticsLimiter } = require('../middleware/rateLimits');

// Utilities
const { asyncHandler, AppError, NotFoundError } = require('../utils/errorHandler');
const { logAction } = require('../utils/logger');

// Schemas
const {
  createRequestSchema,
  updateRequestSchema,
  closeRequestSchema,
  monthlyCountQuerySchema
} = require('../validation/schemas/request.schema');

// ===================== VALIDATION SCHEMAS =====================

const listQuerySchema = z.object({
