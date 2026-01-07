const { z } = require('zod');

/**
 * Customer validation schemas
 */
const createCustomerSchema = z.object({
  bkcode: z.string().trim().min(1, 'Customer code is required'),
  client_name: z.string().trim().min(1, 'Customer name is required'),
  email: z.string().email('Invalid email format').optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  branchId: z.string().optional().or(z.literal(''))
});

const updateCustomerSchema = createCustomerSchema.partial();

/**
 * Machine validation schemas
 */
const createMachineSchema = z.object({
  serialNumber: z.string().trim().min(1, 'Serial number is required'),
  model: z.string().trim().min(1, 'Model is required'),
  bkcode: z.string().trim().min(1, 'Customer code is required'),
  machineType: z.enum(['POS', 'SIM'], { errorMap: () => ({ message: 'Machine type must be POS or SIM' }) }).optional(),
  simCardId: z.string().optional().or(z.literal(''))
});

const updateMachineSchema = createMachineSchema.partial();

/**
 * Payment validation schemas
 */
const createPaymentSchema = z.object({
  customerId: z.string().trim().min(1, 'Customer ID is required'),
  amount: z.number().positive('Amount must be greater than 0'),
  paymentDate: z.string().datetime('Invalid date format').optional(),
  paymentMethod: z.enum(['CASH', 'CHEQUE', 'BANK_TRANSFER'], { errorMap: () => ({ message: 'Invalid payment method' }) }).optional(),
  notes: z.string().optional().or(z.literal(''))
});

/**
 * Transfer order validation schemas
 */
const createTransferOrderSchema = z.object({
  sourceWarehouseId: z.string().trim().min(1, 'Source warehouse is required'),
  destinationWarehouseId: z.string().trim().min(1, 'Destination warehouse is required'),
  items: z.array(
    z.object({
      machineId: z.string().min(1, 'Machine ID is required'),
      quantity: z.number().int().positive('Quantity must be positive')
    })
  ).min(1, 'At least one item is required')
});

/**
 * Request validation schemas
 */
const createRequestSchema = z.object({
  customerId: z.string().trim().min(1, 'Customer ID is required'),
  machineId: z.string().trim().min(1, 'Machine ID is required'),
  description: z.string().trim().min(5, 'Description must be at least 5 characters'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH'], { errorMap: () => ({ message: 'Invalid priority' }) }).optional(),
  notes: z.string().optional().or(z.literal(''))
});

/**
 * Pagination validation
 */
const paginationSchema = z.object({
  skip: z.coerce.number().int().nonnegative().default(0),
  take: z.coerce.number().int().positive().max(100).default(20)
});

/**
 * Query filters
 */
const dateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional()
});

module.exports = {
  customer: { create: createCustomerSchema, update: updateCustomerSchema },
  machine: { create: createMachineSchema, update: updateMachineSchema },
  payment: { create: createPaymentSchema },
  transferOrder: { create: createTransferOrderSchema },
  request: { create: createRequestSchema },
  pagination: paginationSchema,
  dateRange: dateRangeSchema
};
