const db = require('../db');
const logger = require('../utils/logger');
const { ValidationError, NotFoundError, ForbiddenError, ConflictError } = require('../utils/errors');
const { createNotification } = require('../routes/notifications');
const { logAction } = require('../utils/logger');
const transferService = require('./transferService');
const { getBranchScope, checkEntityAccess, userHasGlobalRole } = require('../utils/branchSecurity');

// Threshold for automatic approval creation (in currency)
const APPROVAL_COST_THRESHOLD = 500;
/**
 * Get all machines at the maintenance center
 */
async function getMachines(query = {}, user) {
  const { status, technicianId, search } = query;

  let where = getBranchScope(user);

  // Status filter
  if (status) {
    where.status = status;
  } else {
    // Default: show machines at center (not returned or new)
    where.status = {
      in: ['UNDER_INSPECTION', 'REPAIRING', 'REPAIRED', 'WAITING_APPROVAL', 'APPROVED', 'REJECTED', 'TOTAL_LOSS']
    };
  }

  // Technician filter
  if (technicianId) {
    where.currentTechnicianId = technicianId;
  }

  // Search filter
  if (search) {
    where.OR = [
      { serialNumber: { contains: search, mode: 'insensitive' } },
      { model: { contains: search, mode: 'insensitive' } },
      { customerName: { contains: search, mode: 'insensitive' } }
    ];
  }

  const machines = await db.warehouseMachine.findMany({
    where,
    include: {
      serviceAssignments: {
        where: { status: { not: 'COMPLETED' } },
        orderBy: { assignedAt: 'desc' },
        take: 1,
        include: {
          logs: {
            orderBy: { performedAt: 'desc' },
            take: 5
          }
        }
      }
    },
    orderBy: { updatedAt: 'desc' }
  });

  // Optimization: Bulk fetch related data to avoid N+1 queries
  const requestIds = machines.map(m => m.requestId).filter(Boolean);
  const originBranchIds = machines.map(m => m.originBranchId).filter(Boolean);
  const serialNumbers = machines.map(m => m.serialNumber);

  // Fetch all maintenance requests in one query
  const maintenanceRequests = requestIds.length > 0
    ? await db.maintenanceRequest.findMany({
        where: { id: { in: requestIds } },
        select: {
          id: true,
          complaint: true,
          notes: true,
          technician: true,
          technicianId: true,
          status: true
        }
      })
    : [];

  // Fetch all origin branches in one query
  const originBranches = originBranchIds.length > 0
    ? await db.branch.findMany({
        where: { id: { in: originBranchIds } },
        select: { id: true, name: true, code: true }
      })
    : [];

  // Fetch all relevant transfer orders in one query
  // Note: This uses a raw-like approach via Prisma's where capability
  const transferOrders = await db.transferOrder.findMany({
    where: {
      toBranchId: where.branchId, // Only fetch orders for this center
      items: {
        some: { serialNumber: { in: serialNumbers } }
      }
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      createdAt: true,
      items: {
        select: { serialNumber: true }
      }
    }
  });

  // Create lookup maps for O(1) access
  const requestMap = new Map(maintenanceRequests.map(r => [r.id, r]));
  const branchMap = new Map(originBranches.map(b => [b.id, b]));
  const transferMap = new Map();

  // Map transfer orders to their serial numbers
  for (const order of transferOrders) {
    for (const item of order.items) {
      // Store the first (most recent) order for each serial
      if (!transferMap.has(item.serialNumber)) {
        transferMap.set(item.serialNumber, order);
      }
    }
  }

  // Enrich machines with related data
  const enrichedMachines = machines.map(machine => ({
    ...machine,
    problem: requestMap.get(machine.requestId)?.complaint || null,
    maintenanceRequest: requestMap.get(machine.requestId) || null,
    originBranch: branchMap.get(machine.originBranchId) || null,
    transferOrder: transferMap.get(machine.serialNumber) || null
  }));

  return enrichedMachines;
}

/**
 * Get single machine details
 */
async function getMachineById(machineId, user) {
  const where = { id: machineId, ...getBranchScope(user) };

  const machine = await db.warehouseMachine.findFirst({
    where,
    include: {
      serviceAssignments: {
        orderBy: { assignedAt: 'desc' },
        include: {
          logs: { orderBy: { performedAt: 'desc' } }
        }
      }
    }
  });

  if (!machine) {
    throw new NotFoundError('Machine not found');
  }

  // Fetch related data
  const [maintenanceRequest, originBranch, approvalRequests] = await Promise.all([
    machine.requestId
      ? db.maintenanceRequest.findUnique({ where: { id: machine.requestId } })
      : null,
    machine.originBranchId
      ? db.branch.findUnique({ where: { id: machine.originBranchId }, select: { id: true, name: true, code: true } })
      : null,
    db.maintenanceApprovalRequest.findMany({
      where: { machineSerial: machine.serialNumber },
      orderBy: { createdAt: 'desc' }
    })
  ]);

  return {
    ...machine,
    maintenanceRequest,
    originBranch,
    approvalRequests
  };
}

/**
 * Assign technician to machine
 */
async function assignTechnician(machineId, { technicianId, technicianName }, user) {
  const where = { id: machineId, ...getBranchScope(user) };

  const machine = await db.warehouseMachine.findFirst({ where });

  if (!machine) {
    throw new NotFoundError('Machine not found');
  }

  // Check if machine is already assigned to someone else
  if (machine.currentTechnicianId && machine.currentTechnicianId !== technicianId) {
    // Log reassignment
    logger.info({
      machineId,
      oldTechnicianId: machine.currentTechnicianId,
      newTechnicianId: technicianId
    }, 'Reassigning machine to different technician');
  }

  const result = await db.$transaction(async (tx) => {
    // Update machine
    await tx.warehouseMachine.updateMany({
      where: { id: machineId },
      data: {
        currentTechnicianId: technicianId,
        currentTechnicianName: technicianName,
        status: machine.status === 'NEW' ? 'UNDER_INSPECTION' : machine.status,
        updatedAt: new Date()
      }
    });

    // Create or update service assignment
    let assignment = await tx.serviceAssignment.findFirst({
      where: {
        machineId,
        status: { notIn: ['COMPLETED', 'RETURNED'] }
      }
    });

    if (assignment) {
      // Update existing assignment
      await tx.serviceAssignment.updateMany({
        where: { id: assignment.id },
        data: {
          technicianId,
          technicianName
        }
      });
    } else {
      // Create new assignment
      assignment = await tx.serviceAssignment.create({
        data: {
          machineId,
          serialNumber: machine.serialNumber,
          technicianId,
          technicianName,
          customerId: machine.customerId,
          customerName: machine.customerName,
          requestId: machine.requestId,
          branchId: machine.branchId,
          originBranchId: machine.originBranchId || machine.branchId,
          centerBranchId: machine.branchId,
          status: 'UNDER_INSPECTION'
        }
      });
    }

    // Log assignment
    await tx.serviceAssignmentLog.create({
      data: {
        assignmentId: assignment.id,
        action: 'ASSIGNED',
        details: `تم تعيين ${technicianName} للماكينة ${machine.serialNumber}`,
        performedBy: user.displayName || user.email,
        performedById: user.id
      }
    });

    // System log
    await tx.systemLog.create({
      data: {
        entityType: 'WAREHOUSE_MACHINE',
        entityId: machine.serialNumber,
        action: 'TECHNICIAN_ASSIGNED',
        details: JSON.stringify({ technicianId, technicianName }),
        performedBy: user.displayName || user.email,
        userId: user.id,
        branchId: machine.branchId
      }
    });

    return await tx.serviceAssignment.findUnique({
      where: { id: assignment.id },
      include: { machine: true }
    });
  });

  // Notify technician
  if (technicianId !== user.id) {
    await createNotification({
      userId: technicianId,
      branchId: machine.branchId,
      type: 'ASSIGNMENT',
      title: 'تعيين جديد',
      message: `تم تعيينك لصيانة الماكينة ${machine.serialNumber}`,
      link: '/maintenance-center'
    });
  }

  logger.event('maintenance.technician_assigned', {
    machineId,
    serialNumber: machine.serialNumber,
    technicianId,
    technicianName,
    userId: user.id
  });

  return result;
}

/**
 * Perform initial inspection on machine
 */
async function inspectMachine(machineId, { problemDescription, estimatedCost, requiredParts }, user) {
  const where = { id: machineId, ...getBranchScope(user) };

  const machine = await db.warehouseMachine.findFirst({ where });

  if (!machine) {
    throw new NotFoundError('Machine not found');
  }

  const result = await db.$transaction(async (tx) => {
    // Update machine with inspection details
    await tx.warehouseMachine.updateMany({
      where: { id: machineId },
      data: {
        proposedRepairNotes: problemDescription,
        proposedTotalCost: estimatedCost || 0,
        proposedParts: requiredParts ? JSON.stringify(requiredParts) : null,
        status: 'UNDER_INSPECTION',
        updatedAt: new Date()
      }
    });

    // Update or create service assignment
    let assignment = await tx.serviceAssignment.findFirst({
      where: {
        machineId,
        status: { notIn: ['COMPLETED', 'RETURNED'] }
      }
    });

    if (assignment) {
      await tx.serviceAssignment.updateMany({
        where: { id: assignment.id },
        data: {
          proposedParts: requiredParts ? JSON.stringify(requiredParts) : null,
          proposedTotal: estimatedCost || 0
        }
      });

      // Log inspection
      await tx.serviceAssignmentLog.create({
        data: {
          assignmentId: assignment.id,
          action: 'INSPECTED',
          details: `تم الفحص - ${problemDescription}`,
          performedBy: user.displayName || user.email,
          performedById: user.id
        }
      });
    }

    // Note: Approval request is NOT automatic - technician must manually request it
    // This gives the center manager full control over when to request approval
    let approvalRequest = null;

    // System log
    await tx.systemLog.create({
      data: {
        entityType: 'WAREHOUSE_MACHINE',
        entityId: machine.serialNumber,
        action: 'INSPECTION_COMPLETED',
        details: JSON.stringify({
          problemDescription,
          estimatedCost,
          requiredParts,
          approvalRequired: !!approvalRequest
        }),
        performedBy: user.displayName || user.email,
        userId: user.id,
        branchId: machine.branchId
      }
    });

    return {
      machine: await tx.warehouseMachine.findUnique({ where: { id: machineId } }),
      assignment,
      approvalRequest
    };
  });

  logger.event('maintenance.inspection_completed', {
    machineId,
    serialNumber: machine.serialNumber,
    estimatedCost,
    approvalRequired: !!result.approvalRequest,
    userId: user.id
  });

  return result;
}

/**
 * Start repair on machine
 */
async function startRepair(machineId, { repairType, parts, cost }, user) {
  const where = { id: machineId, ...getBranchScope(user) };

  const machine = await db.warehouseMachine.findFirst({ where });

  if (!machine) {
    throw new NotFoundError('Machine not found');
  }

  // Validate repair type
  const validTypes = ['FREE_NO_PARTS', 'FREE_WITH_PARTS', 'PAID_WITH_PARTS'];
  if (!validTypes.includes(repairType)) {
    throw new ValidationError(`Invalid repair type. Must be one of: ${validTypes.join(', ')}`);
  }

  const result = await db.$transaction(async (tx) => {
    // Get assignment
    let assignment = await tx.serviceAssignment.findFirst({
      where: {
        machineId,
        status: { notIn: ['COMPLETED', 'RETURNED'] }
      }
    });

    if (!assignment) {
      throw new ConflictError('No active service assignment found for this machine');
    }

    // For repairs with parts, deduct from inventory
    if (parts && parts.length > 0) {
      for (const part of parts) {
        const inventoryItem = await tx.inventoryItem.findFirst({
          where: {
            partId: part.partId,
            branchId: machine.branchId
          }
        });

        if (!inventoryItem || inventoryItem.quantity < part.quantity) {
          throw new ConflictError(
            `Insufficient stock for part ${part.name}. Available: ${inventoryItem?.quantity || 0}, Required: ${part.quantity}`
          );
        }

        // Deduct from inventory
        await tx.inventoryItem.updateMany({
          where: { id: inventoryItem.id, branchId: machine.branchId },
          data: {
            quantity: { decrement: part.quantity }
          }
        });

        // Log stock movement
        await tx.stockMovement.create({
          data: {
            partId: part.partId,
            type: 'OUT',
            quantity: part.quantity,
            reason: `صيانة ماكينة ${machine.serialNumber}`,
            requestId: machine.requestId,
            performedBy: user.displayName || user.email,
            userId: user.id,
            branchId: machine.branchId
          }
        });
      }
    }

    // Update assignment
    await tx.serviceAssignment.updateMany({
      where: { id: assignment.id },
      data: {
        usedParts: parts ? JSON.stringify(parts) : null,
        totalCost: cost || 0,
        status: 'IN_PROGRESS'
      }
    });

    // Update machine
    await tx.warehouseMachine.updateMany({
      where: { id: machineId },
      data: {
        status: 'REPAIRING',
        usedParts: parts ? JSON.stringify(parts) : null,
        totalCost: cost || 0,
        updatedAt: new Date()
      }
    });

    // Log repair start
    await tx.serviceAssignmentLog.create({
      data: {
        assignmentId: assignment.id,
        action: 'REPAIR_STARTED',
        details: `بدء الصيانة - النوع: ${repairType}${parts ? ' - قطع: ' + parts.map(p => p.name).join('، ') : ''}`,
        performedBy: user.displayName || user.email,
        performedById: user.id
      }
    });

    // Create debt record if PAID_WITH_PARTS
    let debtRecord = null;
    if (repairType === 'PAID_WITH_PARTS' && cost > 0) {
      debtRecord = await tx.branchDebt.create({
        data: {
          type: 'MAINTENANCE',
          referenceId: assignment.id,
          machineSerial: machine.serialNumber,
          customerId: machine.customerId || '',
          customerName: machine.customerName || '',
          amount: cost,
          remainingAmount: cost,
          partsDetails: parts ? JSON.stringify(parts) : '[]',
          creditorBranchId: machine.branchId,
          debtorBranchId: machine.originBranchId || machine.branchId,
          status: 'PENDING'
        }
      });
    }

    // System log
    await tx.systemLog.create({
      data: {
        entityType: 'WAREHOUSE_MACHINE',
        entityId: machine.serialNumber,
        action: 'REPAIR_STARTED',
        details: JSON.stringify({
          repairType,
          parts,
          cost,
          debtCreated: !!debtRecord
        }),
        performedBy: user.displayName || user.email,
        userId: user.id,
        branchId: machine.branchId
      }
    });

    return {
      machine: await tx.warehouseMachine.findUnique({ where: { id: machineId } }),
      assignment: await tx.serviceAssignment.findUnique({ where: { id: assignment.id } }),
      debtRecord
    };
  });

  logger.event('maintenance.repair_started', {
    machineId,
    serialNumber: machine.serialNumber,
    repairType,
    cost,
    userId: user.id
  });

  return result;
}

/**
 * Request approval from branch for costly repairs
 */
async function requestApproval(machineId, { cost, parts, notes }, user) {
  const where = { id: machineId, ...getBranchScope(user) };

  const machine = await db.warehouseMachine.findFirst({ where });

  if (!machine) {
    throw new NotFoundError('Machine not found');
  }

  const result = await db.$transaction(async (tx) => {
    // Get assignment
    let assignment = await tx.serviceAssignment.findFirst({
      where: {
        machineId,
        status: { notIn: ['COMPLETED', 'RETURNED'] }
      }
    });

    if (!assignment) {
      throw new ConflictError('No active service assignment found for this machine');
    }

    // Create approval request
    const approvalRequest = await tx.maintenanceApprovalRequest.create({
      data: {
        assignmentId: assignment.id,
        machineSerial: machine.serialNumber,
        customerId: machine.customerId || '',
        customerName: machine.customerName || '',
        proposedParts: JSON.stringify(parts || []),
        proposedTotal: cost,
        diagnosis: notes,
        centerBranchId: machine.branchId,
        originBranchId: machine.originBranchId || machine.branchId
      }
    });

    // Update assignment
    await tx.serviceAssignment.updateMany({
      where: { id: assignment.id },
      data: {
        status: 'WAITING_APPROVAL',
        needsApproval: true,
        proposedParts: JSON.stringify(parts || []),
        proposedTotal: cost
      }
    });

    // Update machine
    await tx.warehouseMachine.updateMany({
      where: { id: machineId },
      data: {
        status: 'WAITING_APPROVAL',
        proposedParts: JSON.stringify(parts || []),
        proposedTotalCost: cost,
        proposedRepairNotes: notes
      }
    });

    // Log
    await tx.serviceAssignmentLog.create({
      data: {
        assignmentId: assignment.id,
        action: 'APPROVAL_REQUESTED',
        details: `طلب موافقة بقيمة ${cost} ج.م - ${notes || ''}`,
        performedBy: user.displayName || user.email,
        performedById: user.id
      }
    });

    // System log
    await tx.systemLog.create({
      data: {
        entityType: 'WAREHOUSE_MACHINE',
        entityId: machine.serialNumber,
        action: 'APPROVAL_REQUESTED',
        details: JSON.stringify({ cost, parts, notes }),
        performedBy: user.displayName || user.email,
        userId: user.id,
        branchId: machine.branchId
      }
    });

    return {
      machine: await tx.warehouseMachine.findUnique({ where: { id: machineId } }),
      assignment: await tx.serviceAssignment.findUnique({ where: { id: assignment.id } }),
      approvalRequest
    };
  });

  // Notify origin branch
  const partsList = parts ? parts.map(p => p.name).join('، ') : '';
  await createNotification({
    branchId: machine.originBranchId || machine.branchId,
    type: 'APPROVAL_REQUEST',
    title: '⚠️ طلب موافقة صيانة',
    message: `الماكينة ${machine.serialNumber} تحتاج موافقة بقيمة ${cost} ج.م${partsList ? ' - القطع: ' + partsList : ''}`,
    link: '/maintenance-approvals',
    data: JSON.stringify({ machineId, serialNumber: machine.serialNumber })
  });

  logger.event('maintenance.approval_requested', {
    machineId,
    serialNumber: machine.serialNumber,
    cost,
    userId: user.id
  });

  return result;
}

/**
 * Mark machine as repaired
 */
async function markRepaired(machineId, { repairNotes, actionTaken }, user) {
  const where = { id: machineId, ...getBranchScope(user) };

  const machine = await db.warehouseMachine.findFirst({ where });

  if (!machine) {
    throw new NotFoundError('Machine not found');
  }

  const result = await db.$transaction(async (tx) => {
    // Get assignment
    let assignment = await tx.serviceAssignment.findFirst({
      where: {
        machineId,
        status: { notIn: ['COMPLETED', 'RETURNED'] }
      }
    });

    if (!assignment) {
      throw new ConflictError('No active service assignment found for this machine');
    }

    // Check if approval was needed
    if (assignment.needsApproval && assignment.proposedTotal > 0) {
      // Check if there's a pending approval request
      const pendingApproval = await tx.maintenanceApprovalRequest.findFirst({
        where: {
          assignmentId: assignment.id,
          status: 'PENDING'
        }
      });

      if (pendingApproval) {
        throw new ConflictError('Cannot mark as repaired: approval request is still pending');
      }
    }

    // Generate repair voucher code
    const voucherCode = await generateVoucherCode(tx);

    // Create repair voucher
    const voucher = await tx.repairVoucher.create({
      data: {
        code: voucherCode,
        requestId: machine.requestId || assignment.requestId || machineId,
        type: 'REPAIR',
        parts: assignment.usedParts || '[]',
        totalCost: assignment.totalCost || 0,
        branchId: machine.branchId,
        createdBy: user.displayName || user.email
      }
    });

    // Update assignment
    await tx.serviceAssignment.updateMany({
      where: { id: assignment.id },
      data: {
        status: 'COMPLETED',
        actionTaken: actionTaken || 'REPAIRED',
        resolution: 'REPAIRED',
        completedAt: new Date()
      }
    });

    // Update machine
    await tx.warehouseMachine.updateMany({
      where: { id: machineId },
      data: {
        status: 'REPAIRED',
        repairNotes: repairNotes || null,
        resolution: 'REPAIRED',
        updatedAt: new Date()
      }
    });

    // Log completion
    await tx.serviceAssignmentLog.create({
      data: {
        assignmentId: assignment.id,
        action: 'COMPLETED',
        details: `تم إكمال الصيانة - ${actionTaken || 'REPAIRED'} - سند: ${voucherCode}`,
        performedBy: user.displayName || user.email,
        performedById: user.id
      }
    });

    // System log
    await tx.systemLog.create({
      data: {
        entityType: 'WAREHOUSE_MACHINE',
        entityId: machine.serialNumber,
        action: 'REPAIR_COMPLETED',
        details: JSON.stringify({
          voucherCode,
          actionTaken,
          repairNotes,
          totalCost: assignment.totalCost
        }),
        performedBy: user.displayName || user.email,
        userId: user.id,
        branchId: machine.branchId
      }
    });

    return {
      machine: await tx.warehouseMachine.findUnique({ where: { id: machineId } }),
      assignment: await tx.serviceAssignment.findUnique({
        where: { id: assignment.id },
        include: { logs: true }
      }),
      voucher
    };
  });

  // Notify origin branch
  await createNotification({
    branchId: machine.originBranchId || machine.branchId,
    type: 'REPAIR_COMPLETED',
    title: '✅ تم إصلاح الماكينة',
    message: `تم إصلاح الماكينة ${machine.serialNumber} بنجاح ورقم السند ${result.voucher.code}`,
    link: `/maintenance-center/${machineId}`
  });

  logger.event('maintenance.repair_completed', {
    machineId,
    serialNumber: machine.serialNumber,
    voucherCode: result.voucher.code,
    userId: user.id
  });

  return result;
}

/**
 * Mark machine as total loss
 */
async function markTotalLoss(machineId, { reason, notes }, user) {
  const where = { id: machineId, ...getBranchScope(user) };

  const machine = await db.warehouseMachine.findFirst({ where });

  if (!machine) {
    throw new NotFoundError('Machine not found');
  }

  const result = await db.$transaction(async (tx) => {
    // Get assignment
    let assignment = await tx.serviceAssignment.findFirst({
      where: {
        machineId,
        status: { notIn: ['COMPLETED', 'RETURNED'] }
      }
    });

    // Update assignment if exists
    if (assignment) {
      await tx.serviceAssignment.updateMany({
        where: { id: assignment.id },
        data: {
          status: 'COMPLETED',
          actionTaken: 'TOTAL_LOSS',
          resolution: 'TOTAL_LOSS',
          completedAt: new Date()
        }
      });

      await tx.serviceAssignmentLog.create({
        data: {
          assignmentId: assignment.id,
          action: 'TOTAL_LOSS',
          details: `تم التصنيف كخسارة كلية - السبب: ${reason}${notes ? ' - ' + notes : ''}`,
          performedBy: user.displayName || user.email,
          performedById: user.id
        }
      });
    }

    // Update machine
    await tx.warehouseMachine.updateMany({
      where: { id: machineId },
      data: {
        status: 'TOTAL_LOSS',
        resolution: 'TOTAL_LOSS',
        repairNotes: notes || null,
        updatedAt: new Date()
      }
    });

    // Note: Return order is NOT created automatically
    // Center manager will include this machine in bulk return shipment later
    const returnOrder = null;

    // System log
    await tx.systemLog.create({
      data: {
        entityType: 'WAREHOUSE_MACHINE',
        entityId: machine.serialNumber,
        action: 'TOTAL_LOSS_DECLARED',
        details: JSON.stringify({ reason, notes, returnOrderId: returnOrder.id }),
        performedBy: user.displayName || user.email,
        userId: user.id,
        branchId: machine.branchId
      }
    });

    return {
      machine: await tx.warehouseMachine.findUnique({ where: { id: machineId } }),
      assignment,
      returnOrder
    };
  });

  // Notify origin branch
  await createNotification({
    branchId: machine.originBranchId || machine.branchId,
    type: 'TOTAL_LOSS',
    title: '⚠️ خسارة كلية',
    message: `تم تصنيف الماكينة ${machine.serialNumber} كخسارة كلية - السبب: ${reason}`,
    link: `/maintenance-center/${machineId}`
  });

  logger.event('maintenance.total_loss_declared', {
    machineId,
    serialNumber: machine.serialNumber,
    reason,
    userId: user.id
  });

  return result;
}

/**
 * Create return transfer order for total loss machines
 */
async function createReturnTransferOrder(tx, machine, user, reason) {
  const orderNumber = await generateReturnOrderNumber(tx);

  const order = await tx.transferOrder.create({
    data: {
      orderNumber,
      fromBranchId: machine.branchId,
      toBranchId: machine.originBranchId || machine.branchId,
      type: 'RETURN_TO_BRANCH',
      status: 'PENDING',
      notes: `إرجاع ماكينة مصنفة كخسارة كلية - السبب: ${reason}`,
      createdBy: user.displayName || user.email,
      createdByUserId: user.id,
      items: {
        create: [{
          serialNumber: machine.serialNumber,
          type: 'MACHINE',
          model: machine.model,
          manufacturer: machine.manufacturer
        }]
      }
    },
    include: { items: true }
  });

  return order;
}

/**
 * Return machine to origin branch
 */
async function returnToBranch(machineId, { notes, driverName, driverPhone }, user) {
  const where = { id: machineId, ...getBranchScope(user) };

  const machine = await db.warehouseMachine.findFirst({ where });

  if (!machine) {
    throw new NotFoundError('Machine not found');
  }

  if (!machine.originBranchId) {
    throw new ValidationError('Machine has no origin branch defined');
  }

  // Check if machine is ready to return
  if (!['REPAIRED', 'REPAIR_REJECTED', 'TOTAL_LOSS'].includes(machine.status)) {
    throw new ConflictError(`Machine must be in REPAIRED, REPAIR_REJECTED, or TOTAL_LOSS status to return. Current status: ${machine.status}`);
  }

  const result = await db.$transaction(async (tx) => {
    // Get assignment
    let assignment = await tx.serviceAssignment.findFirst({
      where: {
        machineId,
        status: { notIn: ['RETURNED'] }
      }
    });

    // Create return transfer order
    const orderNumber = await generateReturnOrderNumber(tx);
    const returnOrder = await tx.transferOrder.create({
      data: {
        orderNumber,
        branchId: machine.originBranchId, // CRITICAL: Set branchId for query filtering
        fromBranchId: machine.branchId,
        toBranchId: machine.originBranchId,
        type: 'RETURN_TO_BRANCH',
        status: 'PENDING',
        notes: notes || `إرجاع ماكينة بعد الصيانة - الحالة: ${machine.status}`,
        driverName,
        driverPhone,
        createdBy: user.displayName || user.email,
        createdByUserId: user.id,
        items: {
          create: [{
            serialNumber: machine.serialNumber,
            type: 'MACHINE',
            model: machine.model,
            manufacturer: machine.manufacturer
          }]
        }
      },
      include: { items: true }
    });

    // Update assignment
    if (assignment) {
      await tx.serviceAssignment.updateMany({
        where: { id: assignment.id },
        data: {
          status: 'RETURNED'
        }
      });

      await tx.serviceAssignmentLog.create({
        data: {
          assignmentId: assignment.id,
          action: 'RETURNED',
          details: `تم إرجاع الماكينة للفرع - أمر التحويل: ${orderNumber}`,
          performedBy: user.displayName || user.email,
          performedById: user.id
        }
      });
    }

    // Update machine status
    await tx.warehouseMachine.updateMany({
      where: { id: machineId },
      data: {
        status: 'READY_FOR_RETURN',
        updatedAt: new Date()
      }
    });

    // System log
    await tx.systemLog.create({
      data: {
        entityType: 'WAREHOUSE_MACHINE',
        entityId: machine.serialNumber,
        action: 'RETURNED_TO_BRANCH',
        details: JSON.stringify({
          returnOrderId: returnOrder.id,
          orderNumber,
          destinationBranchId: machine.originBranchId,
          notes
        }),
        performedBy: user.displayName || user.email,
        userId: user.id,
        branchId: machine.branchId
      }
    });

    return {
      machine: await tx.warehouseMachine.findUnique({ where: { id: machineId } }),
      assignment,
      returnOrder
    };
  });

  // Notify origin branch
  await createNotification({
    branchId: machine.originBranchId,
    type: 'RETURN_SCHEDULED',
    title: '📦 إرجاع ماكينة',
    message: `تم تجهيز الماكينة ${machine.serialNumber} للإرجاع - رقم أمر التحويل: ${result.returnOrder.orderNumber}`,
    link: `/transfer-orders/${result.returnOrder.id}`
  });

  logger.event('maintenance.return_scheduled', {
    machineId,
    serialNumber: machine.serialNumber,
    returnOrderId: result.returnOrder.id,
    orderNumber: result.returnOrder.orderNumber,
    userId: user.id
  });

  return result;
}

/**
 * Generate unique voucher code
 */
async function generateVoucherCode(tx) {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

  const lastVoucher = await tx.repairVoucher.findFirst({
    where: {
      code: { startsWith: `RV-${dateStr}` }
    },
    orderBy: { code: 'desc' }
  });

  let seq = 1;
  if (lastVoucher) {
    const parts = lastVoucher.code.split('-');
    seq = parseInt(parts[2] || '0') + 1;
  }

  return `RV-${dateStr}-${seq.toString().padStart(4, '0')}`;
}

/**
 * Generate unique return order number
 */
async function generateReturnOrderNumber(tx) {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

  const lastOrder = await tx.transferOrder.findFirst({
    where: {
      orderNumber: { startsWith: `RET-${dateStr}` }
    },
    orderBy: { orderNumber: 'desc' }
  });

  let seq = 1;
  if (lastOrder) {
    const parts = lastOrder.orderNumber.split('-');
    seq = parseInt(parts[2] || '0') + 1;
  }

  return `RET-${dateStr}-${seq.toString().padStart(3, '0')}`;
}

/**
 * Get maintenance center statistics
 */
async function getStats(user) {
  let where = getBranchScope(user);

  const [
    totalMachines,
    underInspection,
    repairing,
    repaired,
    waitingApproval,
    totalLoss,
    pendingApprovals
  ] = await Promise.all([
    db.warehouseMachine.count({ where }),
    db.warehouseMachine.count({ where: { ...where, status: 'UNDER_INSPECTION' } }),
    db.warehouseMachine.count({ where: { ...where, status: 'REPAIRING' } }),
    db.warehouseMachine.count({ where: { ...where, status: 'REPAIRED' } }),
    db.warehouseMachine.count({ where: { ...where, status: 'WAITING_APPROVAL' } }),
    db.warehouseMachine.count({ where: { ...where, status: 'TOTAL_LOSS' } }),
    db.maintenanceApprovalRequest.count({
      where: {
        centerBranchId: user.branchId,
        status: 'PENDING'
      }
    })
  ]);

  return {
    totalMachines,
    underInspection,
    repairing,
    repaired,
    waitingApproval,
    totalLoss,
    pendingApprovals,
    readyForReturn: repaired
  };
}

/**
 * Get pending approval requests for center
 */
async function getPendingApprovals(user) {
  checkEntityAccess({ branchId: user.branchId }, user, 'Maintenance Approvals');

  const where = {
    centerBranchId: user.branchId,
    status: 'PENDING'
  };

  const approvals = await db.maintenanceApprovalRequest.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      assignment: {
        include: {
          machine: true
        }
      }
    }
  });

  return approvals;
}

/**
 * Get machines from a specific branch that are at the maintenance center
 * For branch users to track their machines
 */
async function getBranchMachinesAtCenter(branchId) {
  if (!branchId) {
    throw new ValidationError('Branch ID is required');
  }

  // Find all machines that originated from this branch and are at center
  const machines = await db.warehouseMachine.findMany({
    where: {
      originBranchId: branchId,
      status: {
        in: ['UNDER_INSPECTION', 'REPAIRING', 'REPAIRED', 'WAITING_APPROVAL', 'TOTAL_LOSS', 'READY_FOR_RETURN', 'IN_RETURN_TRANSIT']
      }
    },
    include: {
      branch: {
        select: { id: true, name: true, code: true }
      },
      serviceAssignments: {
        where: { status: { not: 'COMPLETED' } },
        orderBy: { assignedAt: 'desc' },
        take: 1
      }
    },
    orderBy: { updatedAt: 'desc' }
  });

  // Optimization: Bulk fetch maintenance requests to avoid N+1 queries
  const serialNumbers = machines.map(m => m.serialNumber);
  const maintenanceRequests = serialNumbers.length > 0
    ? await db.maintenanceRequest.findMany({
        where: {
          serialNumber: { in: serialNumbers },
          branchId: branchId,
          status: { in: ['Open', 'In Progress', 'PENDING_TRANSFER', 'PENDING_APPROVAL', 'Waiting for Payment'] }
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          serialNumber: true,
          customerName: true,
          complaint: true,
          notes: true,
          createdAt: true,
          customer: {
            select: {
              bkcode: true
            }
          }
        }
      })
    : [];

  // Create lookup map for maintenance requests by serialNumber
  const requestMap = new Map(maintenanceRequests.map(r => [r.serialNumber, r]));

  // Enrich machines with customer info
  const enrichedMachines = machines.map(machine => {
    const maintenanceRequest = requestMap.get(machine.serialNumber);
    const assignment = machine.serviceAssignments?.[0];

    return {
      id: machine.id,
      serialNumber: machine.serialNumber,
      model: machine.model,
      manufacturer: machine.manufacturer,
      centerName: machine.branch?.name || 'مركز الصيانة',
      centerId: machine.branchId,
      status: machine.status,
      problem: maintenanceRequest?.complaint || maintenanceRequest?.notes || 'غير محدد',
        customerName: maintenanceRequest?.customerName || 'غير محدد',
        customerCode: maintenanceRequest?.customer?.bkcode || '',
        assignedAt: assignment?.assignedAt || machine.updatedAt,
        daysAtCenter: Math.floor((Date.now() - new Date(machine.updatedAt).getTime()) / (1000 * 60 * 60 * 24)),
        lastUpdate: machine.updatedAt,
        lastUpdateAction: machine.status,
        technicianName: assignment?.technicianName || null,
        approvalStatus: assignment?.needsApproval ? 'PENDING' : null,
        progress: machine.status === 'REPAIRED' ? 100 : 
                  machine.status === 'REPAIRING' ? 75 :
                  machine.status === 'UNDER_INSPECTION' ? 25 : 10
      };
    });

  return enrichedMachines;
}

/**
 * Get summary statistics for branch machines at center
 */
async function getBranchMachinesSummary(branchId) {
  if (!branchId) {
    throw new ValidationError('Branch ID is required');
  }

  const baseWhere = {
    originBranchId: branchId,
    status: {
      in: ['UNDER_INSPECTION', 'REPAIRING', 'REPAIRED', 'WAITING_APPROVAL', 'TOTAL_LOSS', 'READY_FOR_RETURN', 'IN_RETURN_TRANSIT']
    }
  };

  const [
    total,
    underInspection,
    inRepair,
    waitingApproval,
    completed,
    inReturnTransit
  ] = await Promise.all([
    db.warehouseMachine.count({ where: baseWhere }),
    db.warehouseMachine.count({ where: { ...baseWhere, status: 'UNDER_INSPECTION' } }),
    db.warehouseMachine.count({ where: { ...baseWhere, status: 'REPAIRING' } }),
    db.warehouseMachine.count({ where: { ...baseWhere, status: 'WAITING_APPROVAL' } }),
    db.warehouseMachine.count({ where: { ...baseWhere, status: { in: ['REPAIRED', 'TOTAL_LOSS'] } } }),
    db.warehouseMachine.count({ where: { ...baseWhere, status: 'IN_RETURN_TRANSIT' } })
  ]);

  return {
    total,
    underInspection,
    inRepair,
    waitingApproval,
    completed,
    inReturnTransit
  };
}

/**
 * Create a return package (transfer) to send machines back to origin branch
 * Called from maintenance center to return machines to their originating branch
 */
async function createReturnPackage({ machineIds, notes, driverName, driverPhone }, user) {
  if (!machineIds || machineIds.length === 0) {
    throw new ValidationError('يرجى اختيار ماكينة واحدة على الأقل');
  }

  // Fetch all machines and validate
  const machines = await db.warehouseMachine.findMany({
    where: {
      id: { in: machineIds },
      branchId: user.branchId, // Must be at current center
      originBranchId: { not: null } // Must have origin branch
    },
    include: {
      serviceAssignments: {
        where: { status: { not: 'COMPLETED' } },
        orderBy: { assignedAt: 'desc' },
        take: 1
      }
    }
  });

  if (machines.length === 0) {
    throw new NotFoundError('لم يتم العثور على ماكينات صالحة للإرجاع');
  }

  // Validate machines are ready for return
  const invalidMachines = machines.filter(m => 
    !['REPAIRED', 'TOTAL_LOSS', 'READY_FOR_RETURN'].includes(m.status)
  );

  if (invalidMachines.length > 0) {
    throw new ValidationError(
      `الماكينة التالية غير صالحة للإرجاع: ${invalidMachines.map(m => m.serialNumber).join(', ')}`
    );
  }

  // Group machines by their origin branch
  const machinesByBranch = machines.reduce((acc, machine) => {
    const branchId = machine.originBranchId;
    if (!acc[branchId]) {
      acc[branchId] = [];
    }
    acc[branchId].push(machine);
    return acc;
  }, {});

  // Calculate total costs per branch
  const branchCosts = {};
  for (const [branchId, branchMachines] of Object.entries(machinesByBranch)) {
    let totalCost = 0;
    let totalPartsCost = 0;
    let freeRepairs = 0;
    let paidRepairs = 0;

    for (const machine of branchMachines) {
      const assignment = machine.serviceAssignments?.[0];
      const cost = machine.totalCost || assignment?.totalCost || 0;
      totalCost += cost;
      totalPartsCost += machine.usedParts ? JSON.parse(machine.usedParts).reduce((sum, p) => sum + (p.totalCost || 0), 0) : 0;

      if (cost > 0) {
        paidRepairs++;
      } else {
        freeRepairs++;
      }
    }

    branchCosts[branchId] = {
      totalCost,
      totalPartsCost,
      laborCost: totalCost - totalPartsCost,
      freeRepairs,
      paidRepairs,
      machineCount: branchMachines.length
    };
  }

  // Create transfer orders for each origin branch
  const createdOrders = [];
  
  for (const [originBranchId, branchMachines] of Object.entries(machinesByBranch)) {
    const costs = branchCosts[originBranchId];
    const orderNumber = await transferService.generateOrderNumber();
    
    const order = await db.$transaction(async (tx) => {
      // Create transfer order
      const transferOrder = await tx.transferOrder.create({
        data: {
          orderNumber,
          fromBranchId: user.branchId, // Current center
          toBranchId: originBranchId, // Origin branch
          branchId: originBranchId,
          type: 'RETURN_TO_BRANCH',
          notes: notes || '',
          createdBy: user.displayName || user.email,
          createdByUserId: user.id,
          driverName,
          driverPhone,
          items: {
            create: branchMachines.map(m => ({
              serialNumber: m.serialNumber,
              type: m.model || 'Unknown',
              manufacturer: m.manufacturer || 'Unknown',
              isReceived: false,
              // Include maintenance cost in item notes for tracking
              notes: `التكلفة: ${costs.totalCost} ج.م | ${m.status === 'TOTAL_LOSS' ? 'فقدان كلي' : 'تم الإصلاح'}`
            }))
          }
        },
        include: { items: true, fromBranch: true, toBranch: true }
      });

      // Update machines status to IN_RETURN_TRANSIT
      await tx.warehouseMachine.updateMany({
        where: { id: { in: branchMachines.map(m => m.id) } },
        data: {
          status: 'IN_RETURN_TRANSIT',
          originBranchId: null, // Clear origin as it's in transit
          notes: `طرد إرجاع رقم ${orderNumber}`
        }
      });

      // Log movements for each machine
      for (const machine of branchMachines) {
        await tx.machineMovementLog.create({
          data: {
            machineId: machine.id,
            serialNumber: machine.serialNumber,
            action: 'RETURN_TO_BRANCH',
            details: JSON.stringify({
              orderNumber,
              orderType: 'RETURN_TO_BRANCH',
              toBranchId: originBranchId,
              status: 'IN_RETURN_TRANSIT',
              maintenanceCost: costs.totalCost,
              maintenanceDetails: {
                freeRepairs: costs.freeRepairs,
                paidRepairs: costs.paidRepairs,
                partsCost: costs.totalPartsCost,
                laborCost: costs.laborCost,
                totalCost: costs.totalCost,
                resolution: machine.status === 'TOTAL_LOSS' ? 'فقدان كلي' : 'تم الإصلاح'
              }
            }),
            performedBy: user.displayName || user.email,
            branchId: user.branchId // Log belongs to center
          }
        });
      }

      // Create branch debt record for maintenance costs
      if (costs.totalCost > 0) {
        await tx.branchDebt.create({
          data: {
            type: 'MAINTENANCE_COST',
            referenceId: transferOrder.id,
            machineSerial: branchMachines.map(m => m.serialNumber).join(', '),
            customerId: null,
            customerName: branchMachines.map(m => m.customerName).filter(Boolean).join(', '),
            amount: costs.totalCost,
            paidAmount: 0,
            remainingAmount: costs.totalCost,
            partsDetails: JSON.stringify({
              partsCost: costs.totalPartsCost,
              laborCost: costs.laborCost,
              machineCount: costs.machineCount,
              freeRepairs: costs.freeRepairs,
              paidRepairs: costs.paidRepairs
            }),
            status: 'PENDING',
            creditorBranchId: user.branchId, // Center is creditor
            debtorBranchId: originBranchId, // Origin branch is debtor
            receiptNumber: orderNumber
          }
        });
      }

      return transferOrder;
    });

    createdOrders.push({
      ...order,
      costs: costs,
      machineCount: branchMachines.length
    });

    // Notify origin branch
    try {
      await createNotification({
        branchId: originBranchId,
        type: 'RETURN_SHIPMENT',
        title: '📦 شحنة إرجاع من الصيانة',
        message: `تم إرسال شحنة إرجاع ${branchMachines.length} ماكينة من مركز الصيانة - إذن رقم ${orderNumber}`,
        data: { orderId: order.id, orderNumber, machineCount: branchMachines.length },
        link: `/receive-orders?orderId=${order.id}`
      });
    } catch (e) {
      console.warn('Failed to create notification for return shipment', e);
    }
  }

  return {
    message: `تم إنشاء ${createdOrders.length} إذن إرجاع`,
    orders: createdOrders,
    summary: {
      totalMachines: machines.length,
      totalCost: Object.values(branchCosts).reduce((sum, c) => sum + c.totalCost, 0),
      branchBreakdown: Object.entries(branchCosts).map(([branchId, costs]) => ({
        branchId,
        machineCount: costs.machineCount,
        totalCost: costs.totalCost
      }))
    }
  };
}

/**
 * Get machines ready for return to origin branch
 */
async function getMachinesReadyForReturn(user) {
  const machines = await db.warehouseMachine.findMany({
    where: {
      branchId: user.branchId, // At current center
      originBranchId: { not: null },
      status: { in: ['REPAIRED', 'TOTAL_LOSS', 'READY_FOR_RETURN'] }
    },
    include: {
      serviceAssignments: {
        where: { status: { not: 'COMPLETED' } },
        orderBy: { assignedAt: 'desc' },
        take: 1,
        select: {
          technicianName: true,
          totalCost: true,
          actionTaken: true,
          resolution: true
        }
      }
    },
    orderBy: { updatedAt: 'desc' }
  });

  // Calculate costs per machine
  return machines.map(m => {
    const assignment = m.serviceAssignments?.[0];
    const usedParts = m.usedParts ? JSON.parse(m.usedParts) : [];
    const partsCost = Array.isArray(usedParts) 
      ? usedParts.reduce((sum, p) => sum + (p.totalCost || 0), 0)
      : 0;
    const laborCost = (m.totalCost || assignment?.totalCost || 0) - partsCost;

    return {
      ...m,
      maintenanceCost: m.totalCost || assignment?.totalCost || 0,
      partsCost,
      laborCost,
      resolution: m.status === 'TOTAL_LOSS' ? 'فقدان كلي' : (assignment?.resolution || assignment?.actionTaken || 'تم الإصلاح'),
      technicianName: assignment?.technicianName || m.currentTechnicianName
    };
  });
}

module.exports = {
  getMachines,
  getMachineById,
  assignTechnician,
  inspectMachine,
  startRepair,
  requestApproval,
  markRepaired,
  markTotalLoss,
  returnToBranch,
  getStats,
  getPendingApprovals,
  getBranchMachinesAtCenter,
  getBranchMachinesSummary,
  createReturnPackage,
  getMachinesReadyForReturn,
  APPROVAL_COST_THRESHOLD
};
