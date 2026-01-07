const { z } = require('zod');

const loginSchema = z.object({
  identifier: z.string()
    .min(3, 'Username/email must be at least 3 characters')
    .max(255, 'Username/email cannot exceed 255 characters'),
  email: z.string().email('Invalid email format').optional(),
  userId: z.string().optional(),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password cannot exceed 128 characters'),
  branchId: z.string()
    .regex(/^[a-z0-9]{25}$/, 'Invalid branch ID')
    .optional()
});

const changePasswordSchema = z.object({
  currentPassword: z.string()
    .min(8, 'Current password is required'),
  newPassword: z.string()
    .min(8, 'New password must be at least 8 characters')
    .max(128, 'Password cannot exceed 128 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  confirmPassword: z.string()
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword']
}).refine((data) => data.currentPassword !== data.newPassword, {
  message: 'New password must be different from current password',
  path: ['newPassword']
});

const updatePreferencesSchema = z.object({
  theme: z.enum(['light', 'dark']).optional(),
  language: z.enum(['ar', 'en']).optional(),
  font: z.string().max(50).optional(),
  notifications: z.object({
    email: z.boolean(),
    push: z.boolean(),
    sms: z.boolean()
  }).optional()
});

module.exports = {
  loginSchema,
  changePasswordSchema,
  updatePreferencesSchema
};
