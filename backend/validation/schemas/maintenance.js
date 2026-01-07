const { z } = require('zod');

// ============================================
// Enums (matching Prisma schema)
// ============================================

const ServiceAssignmentStatus = z.enum([
  'UNDER_MAINTENANCE',
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'COMPLETED'
]);

const ApprovalStatus = z.enum([
  'PENDING',
  'APPROVED',
  'REJECTED'
]);

const DebtType = z.enum([
  'MAINTENANCE',
  'TRANSFER',
  'OTHER'
]);

const DebtStatus = z.enum([
  'PENDING',
  'PARTIALLY_PAID',
  'PAID',
  'WAIVED'
]);

const ResolutionType = z.enum([
  'REPAIRED',
  'SCRAPPED',
  'RETURNED_AS_IS'
]);

// ============================================
// Part Schema (used in both proposed & used parts)
// ============================================

const PartSchema = z.object({
  partId: z.string().min(1, 'Part ID required'),
  name: z.string().min(1, 'Part name required'),
  quantity: z.number().int().positive('Quantity must be positive'),
  unitPrice: z.number().nonnegative('Unit price cannot be negative'),
  total: z.number().nonnegative('Total cannot be negative'),
  isPaid: z.boolean().default(true), // true = ط¨ظ…ظ‚ط§ط¨ظ„, false = ظ…ط¬ط§ظ†ظٹ
});

// ============================================
// Request Quote Schema (ط·ظ„ط¨ ظ…ظˆط§ظپظ‚ط©)
// ============================================

const RequestQuoteSchema = z.object({
  assignmentId: z.string().cuid('Invalid assignment ID'),
  machineSerial: z.string().min(1, 'Machine serial required'),
  customerId: z.string().optional(),
  customerName: z.string().min(1, 'Customer name required'),
  
  // Proposed parts (Quote)
  proposedParts: z.array(PartSchema).min(1, 'At least one part required'),
  
  // Technician notes
  diagnosis: z.string().optional(),
  notes: z.string().optional(),
  
  // Branch references
  centerBranchId: z.string().cuid('Invalid center branch ID'),
  originBranchId: z.string().cuid('Invalid origin branch ID'),
}).refine(
  (data) => {
    // Calculate proposedTotal from parts
    const total = data.proposedParts.reduce((sum, part) => sum + part.total, 0);
    return total > 0;
  },
  { message: 'Total cost must be greater than 0', path: ['proposedParts'] }
);

// ============================================
// Complete Direct Schema (طµظٹط§ظ†ط© ظ…ط¨ط§ط´ط±ط©)
// ============================================

const CompleteDirectSchema = z.object({
  assignmentId: z.string().cuid('Invalid assignment ID'),
  
  // Used parts (actual consumption)
  usedParts: z.array(PartSchema).min(1, 'At least one part required'),
  
  // Resolution details
  actionTaken: z.string().min(1, 'Action taken required'),
  resolution: ResolutionType,
  
  // Optional notes
  notes: z.string().optional(),
});

// ============================================
// Approve Schema (ظ…ظˆط§ظپظ‚ط© ط¹ظ„ظ‰ ط·ظ„ط¨)
// ============================================

const ApproveSchema = z.object({
  approvalRequestId: z.string().cuid('Invalid approval request ID'),
  status: z.literal('APPROVED'),  // Enum validation: must be APPROVED
  respondedBy: z.string().min(1, 'Responder name required'),
  respondedById: z.string().cuid('Invalid responder user ID'),
  notes: z.string().optional(),
});

// ============================================
// Reject Schema (ط±ظپط¶ ط·ظ„ط¨)
// ============================================

const RejectSchema = z.object({
  approvalRequestId: z.string().cuid('Invalid approval request ID'),
  status: z.literal('REJECTED'),  // Enum validation: must be REJECTED
  rejectionReason: z.string().min(1, 'Rejection reason required'),
  respondedBy: z.string().min(1, 'Responder name required'),
  respondedById: z.string().cuid('Invalid responder user ID'),
});

// ============================================
// Complete After Approval Schema (ط¥طھظ…ط§ظ… ط¨ط¹ط¯ ط§ظ„ظ…ظˆط§ظپظ‚ط©)
// ============================================

const CompleteAfterApprovalSchema = z.object({
  assignmentId: z.string().cuid('Invalid assignment ID'),
  
  // Used parts (must match approved parts or be subset)
  usedParts: z.array(PartSchema).min(1, 'At least one part required'),
  
  // Resolution details
  actionTaken: z.string().min(1, 'Action taken required'),
  resolution: ResolutionType,
  
  // Optional notes
  notes: z.string().optional(),
});

// ============================================
// Create Assignment Schema (طھط¹ظٹظٹظ† ظ…ط®طھطµ)
// ============================================

const CreateAssignmentSchema = z.object({
  machineId: z.string().cuid('Invalid machine ID'),
  serialNumber: z.string().min(1, 'Serial number required'),
  technicianId: z.string().cuid('Invalid technician ID'),
  technicianName: z.string().min(1, 'Technician name required'),
  
  // Customer info
  customerId: z.string().optional(),
  customerName: z.string().optional(),
  requestId: z.string().optional(),
  
  // Branch references
  centerBranchId: z.string().cuid('Invalid center branch ID'),
  originBranchId: z.string().cuid('Invalid origin branch ID'),
});

// ============================================
// Record Payment Schema (طھط³ط¬ظٹظ„ ط³ط¯ط§ط¯)
// ============================================

const RecordPaymentSchema = z.object({
  debtId: z.string().cuid('Invalid debt ID'),
  amount: z.number().positive('Payment amount must be positive'),
  receiptNumber: z.string().min(1, 'Receipt number required'),
  paymentPlace: z.string().optional(),
  paidBy: z.string().min(1, 'Payer name required'),
  paidByUserId: z.string().cuid('Invalid payer user ID'),
});

// ============================================
// Query Schemas (for filtering/searching)
// ============================================

const GetAssignmentsQuerySchema = z.object({
  status: ServiceAssignmentStatus.optional(),
  centerBranchId: z.string().cuid().optional(),
  originBranchId: z.string().cuid().optional(),
  technicianId: z.string().cuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

const GetDebtsQuerySchema = z.object({
  status: DebtStatus.optional(),
  type: DebtType.optional(),
  debtorBranchId: z.string().cuid().optional(),
  creditorBranchId: z.string().cuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

const GetApprovalRequestsQuerySchema = z.object({
  status: ApprovalStatus.optional(),
  centerBranchId: z.string().cuid().optional(),
  originBranchId: z.string().cuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// ============================================
// Exports
// ============================================

module.exports = {
  // Enums
  ServiceAssignmentStatus,
  ApprovalStatus,
  DebtType,
  DebtStatus,
  ResolutionType,
  
  // Schemas
  PartSchema,
  RequestQuoteSchema,
  CompleteDirectSchema,
  ApproveSchema,
  RejectSchema,
  CompleteAfterApprovalSchema,
  CreateAssignmentSchema,
  RecordPaymentSchema,
  
  // Query Schemas
  GetAssignmentsQuerySchema,
  GetDebtsQuerySchema,
  GetApprovalRequestsQuerySchema,
};
