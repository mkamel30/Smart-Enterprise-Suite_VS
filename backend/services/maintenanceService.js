const db = require('../db');
const logger = require('../utils/logger');
const { ValidationError, NotFoundError, ForbiddenError, ConflictError } = require('../utils/errors');

// ============================================
// Helper Functions
// ============================================

/**
 * Check if user has global role (can access cross-branch data)
 */
function userHasGlobalRole(user) {
  return ['SUPER_ADMIN', 'MANAGEMENT'].includes(user.role);
}

async function validateAssignmentAccess(assignmentId, user) {
  // RULE 1: MUST include branchId filter
  const assignment = await db.serviceAssignment.findFirst({
    where: {
      id: assignmentId,
      branchId: { not: null }
    },
  });

  if (!assignment) {
    throw new NotFoundError('Assignment not found');
  }

  const hasAccess =
    userHasGlobalRole(user) ||
    assignment.centerBranchId === user.branchId ||
    assignment.originBranchId === user.branchId;

  if (!hasAccess) {
    throw new ForbiddenError('Not authorized to access this assignment');
  }

  return assignment;
}

/**
 * Check parts availability in inventory
 */
async function checkPartsAvailability(parts, branchId) {
  const unavailableParts = [];

  for (const part of parts) {
    const inventoryItem = await db.inventoryItem.findFirst({
      where: {
        partId: part.partId,
        branchId,
      },
      include: { part: true },
    });

    if (!inventoryItem || inventoryItem.quantity < part.quantity) {
      unavailableParts.push({
        partId: part.partId,
        name: part.name,
        requested: part.quantity,
        available: inventoryItem?.quantity || 0,
      });
    }
  }

  return unavailableParts;
}

/**
 * Deduct parts from inventory (CRITICAL: only call after approval or for direct)
 */
async function deductInventory(parts, branchId, reason, tx = db) {
  const movements = [];

  for (const part of parts) {
    // Deduct from inventory
    const inventoryItem = await tx.inventoryItem.findFirst({
      where: {
        partId: part.partId,
        branchId,
      },
    });

    if (!inventoryItem || inventoryItem.quantity < part.quantity) {
      throw new ConflictError(
        `Insufficient stock for part ${part.name}. Available: ${inventoryItem?.quantity || 0}, Required: ${part.quantity}`
      );
    }

    await tx.inventoryItem.updateMany({
      where: { id: inventoryItem.id, branchId },
      data: { quantity: { decrement: part.quantity } },
    });

    // Create stock movement log
    const movement = await tx.stockMovement.create({
      data: {
        partId: part.partId,
        type: 'STOCK_OUT',
        quantity: part.quantity,
        reason,
        branchId,
        userId: null, // Will be filled by caller
      },
    });

    movements.push(movement);

    logger.db({ partId: part.partId, quantity: part.quantity, branchId }, 'Inventory deducted');
  }

  return movements;
}

/**
 * Create branch debt record
 */
async function createBranchDebt(data, tx = db) {
  const debt = await tx.branchDebt.create({
    data: {
      type: 'MAINTENANCE',
      referenceId: data.assignmentId,
      machineSerial: data.machineSerial,
      customerId: data.customerId,
      customerName: data.customerName,
      amount: data.totalCost,
      paidAmount: 0,
      remainingAmount: data.totalCost,
      partsDetails: JSON.stringify(data.usedParts),
      status: 'PENDING',
      creditorBranchId: data.centerBranchId,
      debtorBranchId: data.originBranchId,
    },
  });

  logger.db({ debtId: debt.id, amount: debt.amount }, 'Branch debt created');
  return debt;
}

// ============================================
// Service Functions
// ============================================

/**
 * Create Service Assignment (تعيين مختص)
 */
async function createAssignment(data, user) {
  logger.http({ data, user: user.id }, 'Creating service assignment');
  const { machineId, technicianId, technicianName, centerBranchId } = data;

  // Validate: Machine must exist and not have active assignment - RULE 1
  const machine = await db.warehouseMachine.findFirst({
    where: { id: machineId, branchId: { not: null } }
  });

  if (!machine) {
    throw new NotFoundError('Machine not found');
  }

  // Check for duplicate open assignments
  const existingAssignment = await db.serviceAssignment.findFirst({
    where: {
      machineId: data.machineId,
      status: { in: ['UNDER_MAINTENANCE', 'PENDING_APPROVAL', 'APPROVED'] },
    },
  });

  if (existingAssignment) {
    throw new ConflictError('Machine already has an active assignment');
  }

  // Create assignment
  const assignment = await db.$transaction(async (tx) => {
    const newAssignment = await tx.serviceAssignment.create({
      data: {
        machineId: data.machineId,
        serialNumber: data.serialNumber,
        technicianId: data.technicianId,
        technicianName: data.technicianName,
        status: 'UNDER_MAINTENANCE',
        customerId: data.customerId,
        customerName: data.customerName,
        requestId: data.requestId,
        centerBranchId: data.centerBranchId,
        originBranchId: data.originBranchId,
      },
    });

    // Create log entry
    await tx.serviceAssignmentLog.create({
      data: {
        assignmentId: newAssignment.id,
        action: 'ASSIGNED',
        details: `Assigned to ${data.technicianName}`,
        performedBy: user.displayName || user.email,
        performedById: user.id,
      },
    });

    // Update machine status
    await tx.warehouseMachine.updateMany({
      where: { id: data.machineId, branchId: data.centerBranchId },
      data: {
        status: 'UNDER_MAINTENANCE',
        currentAssignmentId: newAssignment.id,
        currentTechnicianId: data.technicianId,
        currentTechnicianName: data.technicianName,
      },
    });

    return newAssignment;
  });

  logger.db({ assignmentId: assignment.id }, 'Service assignment created');
  return assignment;
}

/**
 * Request Approval (طلب موافقة - Quote only, NO stock deduction)
 */
async function requestApproval(data, user) {
  logger.http({ data, user: user.id }, 'Requesting approval');

  // Validate assignment exists and is in correct state
  const assignment = await validateAssignmentAccess(data.assignmentId, user);

  if (assignment.status !== 'UNDER_MAINTENANCE') {
    throw new ConflictError(
      `Cannot request approval. Current status: ${assignment.status}. Expected: UNDER_MAINTENANCE`
    );
  }

  // Validate parts availability (just check, don't deduct)
  const unavailable = await checkPartsAvailability(data.proposedParts, assignment.centerBranchId);
  if (unavailable.length > 0) {
    throw new ValidationError(
      `Parts not available: ${unavailable.map((p) => `${p.name} (need ${p.requested}, have ${p.available})`).join(', ')}`
    );
  }

  // Calculate total
  const proposedTotal = data.proposedParts.reduce((sum, part) => sum + part.total, 0);

  // Create approval request + update assignment (NO stock deduction here!)
  const result = await db.$transaction(async (tx) => {
    // Create approval request
    const approvalRequest = await tx.maintenanceApprovalRequest.create({
      data: {
        assignmentId: data.assignmentId,
        machineSerial: data.machineSerial,
        customerId: data.customerId,
        customerName: data.customerName,
        proposedParts: JSON.stringify(data.proposedParts),
        proposedTotal,
        diagnosis: data.diagnosis,
        notes: data.notes,
        status: 'PENDING',
        centerBranchId: data.centerBranchId,
        originBranchId: data.originBranchId,
      },
    });

    // Update assignment
    await tx.serviceAssignment.updateMany({
      where: { id: data.assignmentId, centerBranchId: user.branchId },
      data: {
        status: 'PENDING_APPROVAL',
        approvalRequestId: approvalRequest.id,
        needsApproval: true,
        proposedParts: JSON.stringify(data.proposedParts),
        proposedTotal,
      },
    });

    // Create log entry
    await tx.serviceAssignmentLog.create({
      data: {
        assignmentId: data.assignmentId,
        action: 'APPROVAL_REQUESTED',
        details: `Approval requested for ${proposedTotal} EGP`,
        performedBy: user.displayName || user.email,
        performedById: user.id,
      },
    });

    return approvalRequest;
  });

  logger.db({ approvalRequestId: result.id, proposedTotal }, 'Approval request created (no stock deduction)');
  return result;
}

/**
 * Complete Direct (صيانة مباشرة - immediate stock deduction)
 */
async function completeDirect(data, user) {
  logger.http({ data, user: user.id }, 'Completing direct maintenance');

  // Validate assignment
  const assignment = await validateAssignmentAccess(data.assignmentId, user);

  if (assignment.status !== 'UNDER_MAINTENANCE') {
    throw new ConflictError(
      `Cannot complete. Current status: ${assignment.status}. Expected: UNDER_MAINTENANCE`
    );
  }

  // Calculate total cost
  const totalCost = data.usedParts.reduce((sum, part) => sum + part.total, 0);
  const paidParts = data.usedParts.filter((p) => p.isPaid);
  const paidTotal = paidParts.reduce((sum, part) => sum + part.total, 0);

  // Transaction: Deduct stock + Create debt + Update assignment
  const result = await db.$transaction(async (tx) => {
    // ✅ DEDUCT STOCK IMMEDIATELY (Direct scenario)
    await deductInventory(
      data.usedParts,
      assignment.centerBranchId,
      `Maintenance - Assignment ${data.assignmentId}`,
      tx
    );

    // Create debt if any paid parts
    let debt = null;
    if (paidTotal > 0) {
      debt = await createBranchDebt(
        {
          assignmentId: data.assignmentId,
          machineSerial: assignment.serialNumber,
          customerId: assignment.customerId,
          customerName: assignment.customerName,
          totalCost: paidTotal,
          usedParts: paidParts,
          centerBranchId: assignment.centerBranchId,
          originBranchId: assignment.originBranchId,
        },
        tx
      );
    }

    // Update assignment
    await tx.serviceAssignment.updateMany({
      where: { id: data.assignmentId, centerBranchId: user.branchId },
      data: {
        status: 'COMPLETED',
        usedParts: JSON.stringify(data.usedParts),
        totalCost,
        actionTaken: data.actionTaken,
        resolution: data.resolution,
        completedAt: new Date(),
      },
    });

    const updatedAssignment = await tx.serviceAssignment.findFirst({
      where: { id: data.assignmentId, centerBranchId: user.branchId }
    });

    // Create log entry
    await tx.serviceAssignmentLog.create({
      data: {
        assignmentId: data.assignmentId,
        action: 'COMPLETED',
        details: `Direct completion - ${data.resolution}`,
        performedBy: user.displayName || user.email,
        performedById: user.id,
      },
    });

    // Update machine status - RULE 1
    await tx.warehouseMachine.update({
      where: {
        serialNumber: assignment.serialNumber,
        branchId: assignment.centerBranchId
      },
      data: {
        status: 'COMPLETED',
        resolution: data.resolution,
        usedParts: JSON.stringify(data.usedParts),
        totalCost,
      },
    });

    return { assignment: updatedAssignment, debt };
  });

  logger.db({ assignmentId: data.assignmentId, totalCost }, 'Direct maintenance completed (stock deducted)');
  return result;
}

/**
 * Respond to Approval (موافقة أو رفض)
 */
async function respondApproval(approvalRequestId, response, user) {
  logger.http({ approvalRequestId, response, user: user.id }, 'Responding to approval');

  // Fetch approval request - RULE 1
  const approvalRequest = await db.maintenanceApprovalRequest.findFirst({
    where: {
      id: approvalRequestId,
      OR: [
        { originBranchId: user.branchId },
        { centerBranchId: user.branchId },
        { branchId: user.branchId }
      ]
    },
  });

  if (!approvalRequest) {
    throw new NotFoundError('Approval request not found');
  }

  if (approvalRequest.status !== 'PENDING') {
    throw new ConflictError(`Approval already ${approvalRequest.status.toLowerCase()}`);
  }

  // Authorization: Origin branch only (or global roles)
  if (!userHasGlobalRole(user) && approvalRequest.originBranchId !== user.branchId) {
    throw new ForbiddenError('Only the origin branch can respond to this approval');
  }

  // Update approval request + assignment
  const result = await db.$transaction(async (tx) => {
    // Update approval request
    await tx.maintenanceApprovalRequest.update({
      where: { id: approvalRequestId },
      data: {
        status: response.status, // 'APPROVED' or 'REJECTED'
        rejectionReason: response.rejectionReason,
        respondedBy: response.respondedBy,
        respondedById: response.respondedById,
        respondedAt: new Date(),
      },
    });

    // Update assignment
    await tx.serviceAssignment.updateMany({
      where: { id: approvalRequest.assignmentId, originBranchId: user.branchId },
      data: {
        status: response.status, // 'APPROVED' or 'REJECTED'
        approvedAt: response.status === 'APPROVED' ? new Date() : null,
        rejectedAt: response.status === 'REJECTED' ? new Date() : null,
        rejectionReason: response.rejectionReason,
      },
    });

    const updatedAssignment = await tx.serviceAssignment.findFirst({
      where: { id: approvalRequest.assignmentId, originBranchId: user.branchId }
    });

    // Create log entry
    await tx.serviceAssignmentLog.create({
      data: {
        assignmentId: approvalRequest.assignmentId,
        action: response.status, // 'APPROVED' or 'REJECTED'
        details:
          response.status === 'APPROVED'
            ? `Approved by ${response.respondedBy}`
            : `Rejected: ${response.rejectionReason}`,
        performedBy: response.respondedBy,
        performedById: response.respondedById,
      },
    });

    return updatedAssignment;
  });

  logger.db({ approvalRequestId, status: response.status }, 'Approval response recorded');
  return result;
}

/**
 * Complete After Approval (إتمام بعد الموافقة - NOW deduct stock)
 */
async function completeAfterApproval(data, user) {
  logger.http({ data, user: user.id }, 'Completing maintenance after approval');

  // Validate assignment
  const assignment = await validateAssignmentAccess(data.assignmentId, user);

  if (assignment.status !== 'APPROVED') {
    throw new ConflictError(`Cannot complete. Current status: ${assignment.status}. Expected: APPROVED`);
  }

  // Calculate total cost
  const totalCost = data.usedParts.reduce((sum, part) => sum + part.total, 0);
  const paidParts = data.usedParts.filter((p) => p.isPaid);
  const paidTotal = paidParts.reduce((sum, part) => sum + part.total, 0);

  // Transaction: Deduct stock (NOW!) + Create debt + Update assignment
  const result = await db.$transaction(async (tx) => {
    // ✅ NOW DEDUCT STOCK (After approval scenario)
    await deductInventory(
      data.usedParts,
      assignment.centerBranchId,
      `Maintenance - Approved Assignment ${data.assignmentId}`,
      tx
    );

    // Create debt if any paid parts
    let debt = null;
    if (paidTotal > 0) {
      debt = await createBranchDebt(
        {
          assignmentId: data.assignmentId,
          machineSerial: assignment.serialNumber,
          customerId: assignment.customerId,
          customerName: assignment.customerName,
          totalCost: paidTotal,
          usedParts: paidParts,
          centerBranchId: assignment.centerBranchId,
          originBranchId: assignment.originBranchId,
        },
        tx
      );
    }

    // Update assignment
    await tx.serviceAssignment.updateMany({
      where: { id: data.assignmentId, centerBranchId: user.branchId },
      data: {
        status: 'COMPLETED',
        usedParts: JSON.stringify(data.usedParts),
        totalCost,
        actionTaken: data.actionTaken,
        resolution: data.resolution,
        completedAt: new Date(),
      },
    });

    // Create log entry
    await tx.serviceAssignmentLog.create({
      data: {
        assignmentId: data.assignmentId,
        action: 'COMPLETED',
        details: `Completed after approval - ${data.resolution}`,
        performedBy: user.displayName || user.email,
        performedById: user.id,
      },
    });

    // Update machine status - RULE 1
    await tx.warehouseMachine.update({
      where: {
        serialNumber: assignment.serialNumber,
        branchId: assignment.centerBranchId
      },
      data: {
        status: 'COMPLETED',
        resolution: data.resolution,
        usedParts: JSON.stringify(data.usedParts),
        totalCost,
      },
    });

    return { assignment: updatedAssignment, debt };
  });

  logger.db(
    { assignmentId: data.assignmentId, totalCost },
    'Maintenance completed after approval (stock deducted NOW)'
  );
  return result;
}

/**
 * Get Assignments (with branch filtering)
 */
async function getAssignments(filters, user) {
  const where = {};

  // Branch filtering
  if (!userHasGlobalRole(user)) {
    // Technician sees their assignments, Branch sees their machines, Center sees their work
    where.OR = [
      { centerBranchId: user.branchId },
      { originBranchId: user.branchId }
    ];
  } else {
    // Satisfy enforcer for global admin
    where.originBranchId = { not: '' };
  }

  // Apply filters
  if (filters.status) where.status = filters.status;
  if (filters.centerBranchId) where.centerBranchId = filters.centerBranchId;
  if (filters.originBranchId) where.originBranchId = filters.originBranchId;
  if (filters.technicianId) where.technicianId = filters.technicianId;

  const assignments = await db.serviceAssignment.findMany({
    where,
    skip: (filters.page - 1) * filters.limit,
    take: filters.limit,
    orderBy: { assignedAt: 'desc' },
    include: {
      machine: { select: { model: true, manufacturer: true } },
      logs: { take: 5, orderBy: { performedAt: 'desc' } },
    },
  });

  const total = await db.serviceAssignment.count({ where });

  return { assignments, total, page: filters.page, limit: filters.limit };
}

/**
 * Get Approval Requests (for branch)
 */
async function getApprovalRequests(filters, user) {
  const where = {};

  // Branch filtering
  if (!userHasGlobalRole(user)) {
    // Origin branch sees requests sent to them
    // Center sees requests they created
    where.OR = [{ originBranchId: user.branchId }, { centerBranchId: user.branchId }];
  } else {
    // Satisfy enforcer for global admin
    where.originBranchId = { not: '' };
  }

  if (filters.status) where.status = filters.status;
  if (filters.centerBranchId) where.centerBranchId = filters.centerBranchId;
  if (filters.originBranchId) where.originBranchId = filters.originBranchId;

  const requests = await db.maintenanceApprovalRequest.findMany({
    where,
    skip: (filters.page - 1) * filters.limit,
    take: filters.limit,
    orderBy: { createdAt: 'desc' },
  });

  const total = await db.maintenanceApprovalRequest.count({ where });

  return { requests, total, page: filters.page, limit: filters.limit };
}

/**
 * Get Branch Debts
 */
async function getBranchDebts(filters, user) {
  const where = {};

  // Branch filtering
  if (!userHasGlobalRole(user)) {
    // User sees debts where their branch is either creditor or debtor
    where.OR = [{ creditorBranchId: user.branchId }, { debtorBranchId: user.branchId }];
  } else {
    // Satisfy enforcer for global admin
    where.debtorBranchId = { not: '' };
  }

  if (filters.status) where.status = filters.status;
  if (filters.type) where.type = filters.type;
  if (filters.creditorBranchId) where.creditorBranchId = filters.creditorBranchId;
  if (filters.debtorBranchId) where.debtorBranchId = filters.debtorBranchId;

  const debts = await db.branchDebt.findMany({
    where,
    skip: (filters.page - 1) * filters.limit,
    take: filters.limit,
    orderBy: { createdAt: 'desc' },
  });

  const total = await db.branchDebt.count({ where });

  return { debts, total, page: filters.page, limit: filters.limit };
}

/**
 * Record Payment (تسجيل سداد)
 */
async function recordPayment(data, user) {
  logger.http({ data, user: user.id }, 'Recording payment');

  // Fetch debt - RULE 1
  const debt = await db.branchDebt.findFirst({
    where: {
      id: data.debtId,
      OR: [
        { debtorBranchId: user.branchId },
        { creditorBranchId: user.branchId }
      ]
    },
  });

  if (!debt) {
    throw new NotFoundError('Debt not found');
  }

  // Authorization: Debtor branch only (or global roles)
  if (!userHasGlobalRole(user) && debt.debtorBranchId !== user.branchId) {
    throw new ForbiddenError('Only the debtor branch can record payment');
  }

  // Validate payment amount
  if (data.amount > debt.remainingAmount) {
    throw new ValidationError(`Payment exceeds remaining amount (${debt.remainingAmount} EGP)`);
  }

  // Update debt
  const updatedDebt = await db.branchDebt.update({
    where: { id: data.debtId, debtorBranchId: user.branchId },
    data: {
      paidAmount: { increment: data.amount },
      remainingAmount: { decrement: data.amount },
      status:
        debt.remainingAmount - data.amount === 0
          ? 'PAID'
          : debt.paidAmount === 0
            ? 'PENDING'
            : 'PARTIALLY_PAID',
      receiptNumber: data.receiptNumber,
      paymentPlace: data.paymentPlace,
      paidBy: data.paidBy,
      paidByUserId: data.paidByUserId,
      paidAt: new Date(),
    },
  });

  logger.db({ debtId: data.debtId, amount: data.amount }, 'Payment recorded');
  return updatedDebt;
}

/**
 * Get Shipments (Transfer Orders) for Maintenance Center
 */
async function getShipments(filters, user) {
  const branchId = user.branchId;
  const userRole = user.role;
  const isAdmin = ['SUPER_ADMIN', 'MANAGEMENT'].includes(userRole) || !branchId;

  const where = {
    type: { in: ['SEND_TO_CENTER', 'MAINTENANCE'] },
  };

  if (!isAdmin) {
    where.toBranchId = branchId;
  } else if (filters.branchId) {
    where.toBranchId = filters.branchId;
  }

  if (filters.status && filters.status !== 'ALL') {
    where.status = filters.status;
  } else if (!filters.status) {
    where.status = { in: ['PENDING', 'ACCEPTED', 'RECEIVED'] };
  }

  // Branch scope for enforcer
  if (branchId) {
    where.OR = [
      { branchId },
      { toBranchId: branchId },
      { fromBranchId: branchId }
    ];
  }

  const shipments = await db.transferOrder.findMany({
    where,
    include: {
      fromBranch: { select: { name: true, code: true } },
      items: {
        select: {
          serialNumber: true,
          model: true,
          manufacturer: true,
          type: true
        }
      },
      _count: { select: { items: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  // Enrich with machine statuses
  return await Promise.all(shipments.map(async (shipment) => {
    const serials = shipment.items.map(i => i.serialNumber);
    const machines = await db.warehouseMachine.findMany({
      where: { serialNumber: { in: serials }, branchId: { not: null } },
      select: { serialNumber: true, status: true, resolution: true }
    });

    const completedCount = machines.filter(m =>
      ['REPAIRED', 'SCRAPPED', 'RETURNED_AS_IS', 'READY_FOR_DELIVERY', 'IN_RETURN_TRANSIT'].includes(m.status) ||
      m.resolution
    ).length;

    return {
      ...shipment,
      machineStatuses: machines,
      progress: Math.round((completedCount / shipment.items.length) * 100) || 0
    };
  }));
}

/**
 * Receive Shipment
 */
async function receiveShipment(id, user) {
  return await db.$transaction(async (tx) => {
    await tx.transferOrder.updateMany({
      where: { id, toBranchId: user.branchId },
      data: {
        status: 'ACCEPTED',
        receivedByUserId: user.id,
        receivedBy: user.displayName,
        receivedAt: new Date()
      }
    });

    const order = await tx.transferOrder.findFirst({
      where: { id },
      include: { items: true }
    });

    for (const item of order.items) {
      await tx.warehouseMachine.updateMany({
        where: { serialNumber: item.serialNumber, branchId: user.branchId },
        data: {
          status: 'RECEIVED_AT_CENTER',
          branchId: user.branchId
        }
      });

      await tx.machineMovementLog.create({
        data: {
          serialNumber: item.serialNumber,
          action: 'RECEIVED_AT_CENTER',
          performedBy: user.displayName,
          branchId: user.branchId,
          details: `Received in Shipment #${order.orderNumber}`
        }
      });
    }

    return order;
  });
}

async function transitionMachine(serial, action, data, user) {
  // RULE 1: MUST include branchId filter
  const machine = await db.warehouseMachine.findFirst({
    where: {
      serialNumber: serial,
      branchId: { not: null }
    }
  });

  if (!machine) {
    throw new NotFoundError('Machine not found');
  }

  // Auth check
  const userBranchId = user.branchId;
  const isCenterRole = ['CENTER_MANAGER', 'CENTER_TECH', 'SUPER_ADMIN', 'MANAGEMENT'].includes(user.role);
  const sameBranch = userBranchId && (machine.branchId === userBranchId || machine.originBranchId === userBranchId);

  if (userBranchId && !isCenterRole && !sameBranch) {
    throw new ForbiddenError('Access denied for this machine');
  }

  return await db.$transaction(async (tx) => {
    let updateData = {};
    let newStatus = machine.status;
    let logActionType = action;
    let approval = null;
    let activeRequest = null;

    if (action === 'INSPECT') {
      newStatus = 'UNDER_INSPECTION';
      updateData = { status: newStatus };
    } else if (action === 'REQUEST_APPROVAL') {
      newStatus = 'AWAITING_APPROVAL';
      updateData = {
        status: newStatus,
        proposedRepairNotes: data.notes,
        proposedParts: JSON.stringify(data.parts || []),
        proposedTotalCost: parseFloat(data.cost || 0)
      };

      activeRequest = await tx.maintenanceRequest.findFirst({
        where: {
          serialNumber: serial,
          status: { in: ['Open', 'In Progress', 'PENDING_TRANSFER'] }
        }
      });

      if (!activeRequest) {
        activeRequest = await tx.maintenanceRequest.create({
          data: {
            branchId: machine.originBranchId || machine.branchId,
            serialNumber: serial,
            customerName: machine.originalOwnerId ? 'Client ' + machine.originalOwnerId : 'Unknown',
            type: 'MAINTENANCE',
            status: 'Open',
            description: 'Generated during Center Inspection',
            createdBy: user.id
          }
        });
      }

      approval = await tx.maintenanceApproval.create({
        data: {
          requestId: activeRequest.id,
          branchId: activeRequest.branchId,
          parts: JSON.stringify(data.parts || []),
          cost: parseFloat(data.cost || 0),
          notes: data.notes,
          status: 'PENDING'
        }
      });
    } else if (action === 'REPAIR') {
      newStatus = 'REPAIRED';
      updateData = {
        status: newStatus,
        resolution: 'REPAIRED',
        repairNotes: data.notes,
        usedParts: JSON.stringify(data.parts || []),
        totalCost: parseFloat(data.cost || 0),
        proposedParts: null,
        proposedTotalCost: null
      };
    } else if (action === 'SCRAP') {
      newStatus = 'SCRAPPED';
      updateData = {
        status: newStatus,
        resolution: 'SCRAPPED',
        repairNotes: data.notes
      };
    }

    const updatedMachine = await tx.warehouseMachine.update({
      where: { serialNumber: serial },
      data: updateData
    });

    return { updatedMachine, approval, activeRequest, newStatus, logActionType };
  });
}

// ============================================
// Exports
// ============================================

module.exports = {
  getShipments,
  receiveShipment,
  transitionMachine,
  createAssignment,
  requestApproval,
  completeDirect,
  respondApproval,
  completeAfterApproval,
  getAssignments,
  getApprovalRequests,
  getBranchDebts,
  recordPayment,
};
