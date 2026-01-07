const { z } = require('zod');

const createRequestSchema = z.object({
  customerId: z.string()
    .min(1, 'Customer ID is required')
    .regex(/^[a-z0-9]{25}$/, 'Invalid customer ID format'),
  machineId: z.string()
    .regex(/^[a-z0-9]{25}$/, 'Invalid machine ID format')
    .optional()
    .nullable(),
  problemDescription: z.string()
    .min(5, 'Description must be at least 5 characters')
    .max(1000, 'Description cannot exceed 1000 characters')
    .trim(),
  branchId: z.string()
    .regex(/^[a-z0-9]{25}$/, 'Invalid branch ID format')
    .optional()
    .nullable(),
  technicianId: z.string()
    .regex(/^[a-z0-9]{25}$/, 'Invalid technician ID format')
    .optional()
    .nullable(),
  status: z.enum(['Open', 'In Progress', 'Closed', 'PENDING_TRANSFER', 'AT_CENTER', 'WAITING_APPROVAL'])
    .default('Open'),
  takeMachine: z.boolean().default(false)
});

const updateRequestSchema = createRequestSchema.partial();

const closeRequestSchema = z.object({
  actionTaken: z.string()
    .min(10, 'Action description must be at least 10 characters')
    .max(500, 'Action description cannot exceed 500 characters'),
  usedParts: z.array(
    z.object({
      partId: z.string().regex(/^[a-z0-9]{25}$/),
      quantity: z.number().int().min(1, 'Quantity must be at least 1'),
      cost: z.number().min(0, 'Cost cannot be negative')
    })
  ).optional(),
  receiptNumber: z.string()
    .regex(/^[A-Z0-9\-]{5,20}$/, 'Invalid receipt number format')
    .optional()
    .nullable()
});

const monthlyCountQuerySchema = z.object({
  date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .transform(str => new Date(str))
    .refine(date => !isNaN(date.getTime()), 'Invalid date')
    .refine(date => date <= new Date(), 'Date cannot be in the future')
    .optional()
});

module.exports = {
  createRequestSchema,
  updateRequestSchema,
  closeRequestSchema,
  monthlyCountQuerySchema
};
