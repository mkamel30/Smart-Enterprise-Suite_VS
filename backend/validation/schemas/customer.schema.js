const { z } = require('zod');

const createCustomerSchema = z.object({
  bkcode: z.string()
    .min(3, 'Customer code must be at least 3 characters')
    .max(20, 'Customer code cannot exceed 20 characters')
    .regex(/^[A-Z0-9\-]+$/, 'Invalid customer code format'),
  client_name: z.string()
    .min(2, 'Customer name must be at least 2 characters')
    .max(255, 'Customer name cannot exceed 255 characters'),
  supply_office: z.string().optional(),
  address: z.string()
    .max(500, 'Address cannot exceed 500 characters')
    .optional(),
  contact_person: z.string()
    .max(100, 'Contact person name cannot exceed 100 characters')
    .optional(),
  national_id: z.string()
    .regex(/^\d{10,15}$/, 'Invalid national ID format')
    .optional()
    .nullable(),
  telephone_1: z.string()
    .regex(/^\+?[\d\s\-\(\)]{10,20}$/, 'Invalid phone number')
    .optional(),
  telephone_2: z.string()
    .regex(/^\+?[\d\s\-\(\)]{10,20}$/, 'Invalid phone number')
    .optional(),
  dept: z.string().max(100).optional(),
  has_gates: z.boolean().default(false),
  bk_type: z.string().max(50).optional(),
  notes: z.string().max(1000).optional(),
  branchId: z.string()
    .regex(/^[a-z0-9]{25}$/, 'Invalid branch ID')
    .optional()
});

const updateCustomerSchema = createCustomerSchema.partial();

module.exports = {
  createCustomerSchema,
  updateCustomerSchema
};
