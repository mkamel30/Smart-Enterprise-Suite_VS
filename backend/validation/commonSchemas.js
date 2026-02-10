/**
 * Common Validation Schemas
 * 
 * Shared Zod validation schemas to reduce duplication across route files.
 * These schemas cover common patterns like pagination, IDs, dates, etc.
 */

const { z } = require('zod');

// ==========================================
// ID Schemas
// ==========================================

/**
 * CUID format validation (25 alphanumeric characters)
 */
const cuidSchema = z.string().regex(/^[a-z0-9]{25}$/, 'Invalid ID format');

/**
 * Optional CUID schema
 */
const optionalCuidSchema = z.string().regex(/^[a-z0-9]{25}$/, 'Invalid ID format').optional().nullable();

/**
 * ID parameter schema for route parameters
 */
const idParamSchema = z.object({
  id: cuidSchema
});

// ==========================================
// Pagination Schemas
// ==========================================

/**
 * Standard pagination query schema
 */
const paginationSchema = z.object({
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0)
});

/**
 * Extended pagination with search
 */
const listQuerySchema = z.object({
  search: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0)
});

/**
 * Pagination with sorting
 */
const paginatedQuerySchema = z.object({
  limit: z.string().regex(/^\d+$/).transform(Number).refine(n => n > 0 && n <= 100, 'Limit must be between 1 and 100').optional().default('50'),
  offset: z.string().regex(/^\d+$/).transform(Number).refine(n => n >= 0, 'Offset must be non-negative').optional().default('0'),
  sortBy: z.string().optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  search: z.string().optional()
});

// ==========================================
// Date Schemas
// ==========================================

/**
 * ISO date string schema
 */
const dateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
  .transform(str => new Date(str))
  .refine(date => !isNaN(date.getTime()), 'Invalid date');

/**
 * Optional date schema with validation
 */
const optionalDateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
  .transform(str => new Date(str))
  .refine(date => !isNaN(date.getTime()), 'Invalid date')
  .optional();

/**
 * Date range schema
 */
const dateRangeSchema = z.object({
  fromDate: optionalDateSchema,
  toDate: optionalDateSchema
});

/**
 * Monthly count query schema
 */
const monthlyCountQuerySchema = z.object({
  date: z.string().optional().transform(s => s ? new Date(s) : undefined),
  months: z.string().regex(/^\d+$/).transform(Number).optional().default('6')
});

// ==========================================
// Branch & Status Schemas
// ==========================================

/**
 * Branch ID schema (optional, for admin filtering)
 */
const branchIdSchema = z.string().regex(/^[a-z0-9]{25}$/).optional();

/**
 * Common status enums
 */
const requestStatusEnum = z.enum(['Open', 'In Progress', 'Closed', 'PENDING_TRANSFER', 'AT_CENTER', 'WAITING_APPROVAL']);
const transferStatusEnum = z.enum(['PENDING', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED']);
const transferTypeEnum = z.enum(['MACHINE', 'SIM', 'SPARE_PART']);

// ==========================================
// Customer Schemas
// ==========================================

const customerIdSchema = z.object({
  customerId: z.string().min(1, 'Customer ID required')
});

const customerSearchSchema = z.object({
  customerId: z.string().optional(),
  customerName: z.string().optional()
});

// ==========================================
// Receipt & Payment Schemas
// ==========================================

const receiptNumberSchema = z.string()
  .regex(/^[A-Z0-9\-]{5,20}$/, 'Invalid receipt number format')
  .optional()
  .nullable();

const usedPartSchema = z.object({
  partId: z.string().regex(/^[a-z0-9]{25}$/),
  name: z.string(),
  quantity: z.number().positive(),
  cost: z.number().nonnegative(),
  isPaid: z.boolean()
});

// ==========================================
// Contact Info Schemas
// ==========================================

const phoneSchema = z.string()
  .regex(/^\+?[\d\s\-\(\)]{10,20}$/, 'Invalid phone number')
  .optional();

const nationalIdSchema = z.string()
  .regex(/^\d{10,15}$/, 'Invalid national ID format')
  .optional()
  .nullable();

// ==========================================
// Generic Text Schemas
// ==========================================

const notesSchema = z.string().max(1000).optional();

const rejectionReasonSchema = z.string().min(5, 'Reason must be at least 5 characters');

// ==========================================
// Export all schemas
// ==========================================

module.exports = {
  // ID schemas
  cuidSchema,
  optionalCuidSchema,
  idParamSchema,
  
  // Pagination schemas
  paginationSchema,
  listQuerySchema,
  paginatedQuerySchema,
  
  // Date schemas
  dateSchema,
  optionalDateSchema,
  dateRangeSchema,
  monthlyCountQuerySchema,
  
  // Branch & status schemas
  branchIdSchema,
  requestStatusEnum,
  transferStatusEnum,
  transferTypeEnum,
  
  // Customer schemas
  customerIdSchema,
  customerSearchSchema,
  
  // Receipt & payment schemas
  receiptNumberSchema,
  usedPartSchema,
  
  // Contact info schemas
  phoneSchema,
  nationalIdSchema,
  
  // Generic text schemas
  notesSchema,
  rejectionReasonSchema
};
