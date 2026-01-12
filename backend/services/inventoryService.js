const { getBranchFilter } = require('../middleware/permissions');
const db = require('../db');
const { logAction } = require('../utils/logger');
const { roundMoney } = require('./paymentService');
const { ensureBranchWhere } = require('../prisma/branchHelpers');

async function getInventory(req) {
  const branchFilter = getBranchFilter(req);
  // If admin and no specific branch filter, allow seeing all inventory items
  if (Object.keys(branchFilter).length === 0 && ['SUPER_ADMIN', 'MANAGEMENT'].includes(req.user?.role)) {
    branchFilter._skipBranchEnforcer = true;
  }

  const parts = await db.sparePart.findMany({
    include: { inventoryItems: { where: branchFilter } }
  });

  return parts.map(part => ({
    id: part.id,
    partNumber: part.partNumber,
    name: part.name,
    compatibleModels: part.compatibleModels,
    defaultCost: part.defaultCost,
    quantity: part.inventoryItems.reduce((sum, item) => sum + item.quantity, 0),
    minLevel: part.inventoryItems[0]?.minLevel || 0,
    allowsMultiple: part.allowsMultiple,
    inventoryItemId: part.inventoryItems[0]?.id
  }));
}

async function stockIn(req, { partId, quantity, reason, branchId }) {
  const bId = branchId || req.user.branchId;
  if (!bId) throw new Error('Branch ID required');

  let inventoryItem = await db.inventoryItem.findFirst(ensureBranchWhere({ where: { partId, branchId: bId } }, req));

  if (inventoryItem) {
    await db.inventoryItem.updateMany({
      where: { id: inventoryItem.id, branchId: bId },
      data: { quantity: inventoryItem.quantity + quantity }
    });
  } else {
    inventoryItem = await db.inventoryItem.create({ data: { branchId: bId, partId, quantity, minLevel: 0 } });
  }

  try {
    await db.stockMovement.create({ data: { branchId: bId, partId, type: 'IN', quantity, reason: reason || 'تحويل من الإدارة', createdAt: new Date(), userId: req.user?.id, performedBy: req.user?.displayName || 'System' } });
  } catch (e) { /* ignore logging failures */ }

  return { newQuantity: inventoryItem.quantity };
}

async function importStock(req, items, branchId) {
  const bId = branchId || req.user.branchId;
  if (!bId) throw new Error('Branch ID required');
  let updated = 0;
  for (const item of items) {
    if (item.quantity <= 0) continue;
    let inventoryItem = await db.inventoryItem.findFirst(ensureBranchWhere({ where: { partId: item.partId, branchId: bId } }, req));
    if (inventoryItem) {
      await db.inventoryItem.updateMany({
        where: { id: inventoryItem.id, branchId: bId },
        data: { quantity: inventoryItem.quantity + item.quantity }
      });
    } else {
      await db.inventoryItem.create({ data: { branchId: bId, partId: item.partId, quantity: item.quantity, minLevel: 0 } });
    }
    try {
      await db.stockMovement.create({ data: { branchId: bId, partId: item.partId, type: 'IN', quantity: item.quantity, reason: 'استيراد من ملف Excel', createdAt: new Date(), performedBy: req.user?.displayName || 'System' } });
    } catch (e) { }
    updated++;
  }
  return { updated };
}

async function updateQuantity(req, partId, quantity, branchId) {
  const bId = branchId || req.user.branchId;
  if (!bId) throw new Error('Branch ID required');

  let inventoryItem = await db.inventoryItem.findFirst(ensureBranchWhere({ where: { partId, branchId: bId } }, req));
  let oldQuantity = 0;
  if (inventoryItem) {
    oldQuantity = inventoryItem.quantity;
    await db.inventoryItem.updateMany({
      where: { id: inventoryItem.id, branchId: bId },
      data: { quantity }
    });
  } else {
    inventoryItem = await db.inventoryItem.create({ data: { branchId: bId, partId, quantity, minLevel: 0 } });
  }

  await logAction({ entityType: 'PART', entityId: partId, action: 'UPDATE', details: `Manual inventory adjustment for branch ${bId}. Quantity changed from ${oldQuantity} to ${quantity}`, userId: req.user?.id, performedBy: req.user?.displayName || 'System', branchId: bId });

  return inventoryItem;
}

async function stockOut(req, { partId, quantity, reason, requestId, cost, customerId, customerName, userId, userName }, branchId) {
  const bId = branchId || req.user.branchId;
  if (!bId) throw new Error('Branch ID required');

  const inventoryItem = await db.inventoryItem.findFirst(ensureBranchWhere({ where: { partId, branchId: bId } }, req));
  if (!inventoryItem || inventoryItem.quantity < quantity) throw new Error('الكمية غير كافية');

  const result = await db.$transaction(async (tx) => {
    await tx.inventoryItem.updateMany({
      where: { id: inventoryItem.id, branchId: bId },
      data: { quantity: inventoryItem.quantity - quantity }
    });
    try {
      await tx.stockMovement.create({ data: { branchId: bId, partId, type: 'OUT', quantity, reason: reason || 'صيانة ماكينة', requestId, createdAt: new Date(), userId, performedBy: userName } });
    } catch (e) { }

    let payment = null;
    if (cost && cost > 0 && customerId) {
      payment = await tx.payment.create({ data: { branchId: bId, customerId, customerName, requestId, amount: roundMoney(cost), type: 'MAINTENANCE', reason: 'قطع غيار صيانة', paymentPlace: 'ضامن', notes: reason || 'قطع غيار صيانة', userId, userName } });
    }

    return { newQuantity: inventoryItem.quantity - quantity, payment };
  });

  return result;
}

async function transferStock(req, { partId, quantity, fromBranchId, toBranchId, reason }) {
  const userId = req.user?.id; const userName = req.user?.displayName || 'System';
  if (!partId || !quantity || !fromBranchId || !toBranchId) throw new Error('Components required (Part, Qty, From, To)');
  if (quantity <= 0) throw new Error('Quantity must be positive');

  await db.$transaction(async (tx) => {
    const sourceItem = await tx.inventoryItem.findFirst(ensureBranchWhere({ where: { partId, branchId: fromBranchId } }, req));
    if (!sourceItem || sourceItem.quantity < quantity) throw new Error(`Insufficient stock in source branch. Available: ${sourceItem?.quantity || 0}`);

    await tx.inventoryItem.updateMany({
      where: { id: sourceItem.id, branchId: fromBranchId },
      data: { quantity: sourceItem.quantity - quantity }
    });
    await tx.stockMovement.create({ data: { branchId: fromBranchId, partId, type: 'OUT', quantity, reason: reason || `Transfer to ${toBranchId}`, createdAt: new Date(), userId, performedBy: userName } });

    let destItem = await tx.inventoryItem.findFirst(ensureBranchWhere({ where: { partId, branchId: toBranchId } }, req));
    if (destItem) {
      await tx.inventoryItem.updateMany({
        where: { id: destItem.id, branchId: toBranchId },
        data: { quantity: destItem.quantity + quantity }
      });
    } else {
      await tx.inventoryItem.create({ data: { branchId: toBranchId, partId, quantity, minLevel: 0 } });
    }

    await tx.stockMovement.create({ data: { branchId: toBranchId, partId, type: 'IN', quantity, reason: reason || `Transfer from ${fromBranchId}`, createdAt: new Date(), userId, performedBy: userName } });
  });

  return { success: true };
}

async function getMovements(req) {
  const branchFilter = getBranchFilter(req);
  if (!db.stockMovement) return [];

  const { startDate, endDate, search, requestId } = req.query || {};

  // Build the where clause
  const where = { ...branchFilter };
  if (requestId) where.requestId = requestId;

  // Date filtering
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      where.createdAt.lte = end;
    }
  }

  // Fetch movements
  const movements = await db.stockMovement.findMany(ensureBranchWhere({
    where,
    orderBy: { createdAt: 'desc' },
    take: search ? undefined : 200 // Only limit if not searching/filtering extensively
  }, req));

  // Extract reference IDs
  const partIds = [...new Set(movements.map(m => m.partId))];
  const requestIds = [...new Set(movements.filter(m => m.requestId).map(m => m.requestId))];

  // Fetch Parts
  const parts = await db.sparePart.findMany({
    where: { id: { in: partIds } },
    select: { id: true, name: true, partNumber: true }
  });
  const partMap = Object.fromEntries(parts.map(p => [p.id, p]));

  // Fetch Requests for BK code and Serials
  const requests = await db.maintenanceRequest.findMany(ensureBranchWhere({
    where: { id: { in: requestIds } },
    select: {
      id: true,
      serialNumber: true,
      customer: {
        select: { bkcode: true, client_name: true }
      }
    }
  }, req));
  const requestMap = Object.fromEntries(requests.map(r => [r.id, r]));

  // Combine and Apply Smart Search if provided
  let results = movements.map(m => {
    const reqData = m.requestId ? requestMap[m.requestId] : null;
    return {
      ...m,
      partName: partMap[m.partId]?.name || 'غير معروف',
      partNumber: partMap[m.partId]?.partNumber || '',
      customerBkCode: reqData?.customer?.bkcode || null,
      customerName: reqData?.customer?.client_name || null,
      machineSerial: reqData?.serialNumber || null
    };
  });

  if (search) {
    const s = search.toLowerCase();
    results = results.filter(r =>
      r.partName.toLowerCase().includes(s) ||
      r.partNumber.toLowerCase().includes(s) ||
      (r.reason && r.reason.toLowerCase().includes(s)) ||
      (r.performedBy && r.performedBy.toLowerCase().includes(s)) ||
      (r.customerBkCode && r.customerBkCode.toLowerCase().includes(s)) ||
      (r.machineSerial && r.machineSerial.toLowerCase().includes(s))
    );
  }

  return results;
}

// Note: `db` is declared at top of the file; ensure single export at bottom.

/**
 * Deduct parts from inventory with validation
 * @param {Array} parts - Array of {partId, name, quantity, reason}
 * @param {String} requestId - Request ID for logging
 * @param {String} performedBy - User name
 * @param {Object} tx - Optional transaction object
 * @returns {Promise<Array>} Array of stock movements
 * @throws {Error} If part not found or insufficient quantity
 */
async function deductParts(parts, requestId, performedBy, branchId, tx = null) {
  console.log('DEBUG: deductParts called with:', { partsCount: parts.length, requestId, performedBy, branchId, txType: typeof tx });
  const txOrDb = tx || db;
  console.log('DEBUG: txOrDb keys:', Object.keys(txOrDb));
  console.log('DEBUG: txOrDb.stockMovement:', !!txOrDb.stockMovement);

  if (!branchId) {
    throw new Error('Branch ID is required for deducting parts');
  }

  const movements = [];

  for (const part of parts) {
    // 1. Get current stock for THIS BRANCH
    const invItem = await txOrDb.inventoryItem.findFirst({
      where: {
        partId: part.partId,
        branchId: branchId
      },
      include: { part: true }
    });

    if (!invItem) {
      throw new Error(`القطعة "${part.name}" غير موجودة في المخزن`);
    }

    // 2. VALIDATE quantity
    if (invItem.quantity < part.quantity) {
      throw new Error(
        `الكمية المتاحة من "${part.name}" غير كافية. ` +
        `متوفر: ${invItem.quantity}، مطلوب: ${part.quantity}`
      );
    }

    // 3. Deduct - RULE 1
    await txOrDb.inventoryItem.updateMany({
      where: { id: invItem.id, branchId: branchId },
      data: {
        quantity: {
          decrement: part.quantity
        }
      }
    });

    // 4. Log movement
    const movement = await txOrDb.stockMovement.create({
      data: {
        partId: part.partId,
        type: 'OUT',
        quantity: part.quantity,
        reason: part.reason || 'قطع غيار صيانة',
        requestId: requestId,
        performedBy: performedBy,
        branchId: branchId
      }
    });

    movements.push(movement);
  }

  return movements;
}

/**
 * Add stock to inventory
 * @param {String} partId - Part ID
 * @param {Number} quantity - Quantity to add
 * @param {String} reason - Reason for addition
 * @param {String} performedBy - User name
 * @returns {Promise<Object>} Updated inventory item
 */
async function addStock(partId, quantity, reason, performedBy, branchId) {
  return await db.$transaction(async (tx) => {
    // Find or create inventory item for THIS branch
    let invItem = await tx.inventoryItem.findFirst({
      where: { partId, branchId },
      include: { part: true }
    });

    if (!invItem) {
      // Create new inventory item
      invItem = await tx.inventoryItem.create({
        data: {
          partId,
          quantity: quantity,
          minLevel: 0,
          branchId: branchId
        },
        include: { part: true }
      });
    } else {
      // Update existing - RULE 1
      invItem = await tx.inventoryItem.updateMany({
        where: { id: invItem.id, branchId: branchId },
        data: {
          quantity: {
            increment: quantity
          }
        }
      });
    }

    // Log movement
    await tx.stockMovement.create({
      data: {
        partId,
        type: 'IN',
        quantity,
        reason,
        performedBy,
        branchId: branchId
      }
    });

    return invItem;
  });
}

/**
 * Get current stock level for a part
 * @param {String} partId - Part ID
 * @returns {Promise<Object>} Inventory item with part details
 */
async function getCurrentStock(partId, branchId) {
  const invItem = await db.inventoryItem.findFirst({
    where: {
      partId,
      branchId: branchId || undefined
    },
    include: { part: true }
  });

  if (!invItem) {
    return null;
  }

  return {
    partId: invItem.partId,
    quantity: invItem.quantity,
    minLevel: invItem.minLevel,
    part: invItem.part
  };
}

/**
 * Get all inventory items with low stock warning
 * @returns {Promise<Array>} Array of inventory items
 */
async function getLowStockItems(branchId) {
  const where = {
    branchId: branchId || undefined,
    OR: [
      { quantity: { lte: 5 } }, // Default threshold
      { quantity: { lt: 2 } } // Low threshold
    ]
  };

  const items = await db.inventoryItem.findMany({
    where,
    include: { part: true }
  });

  return items;
}

module.exports = {
  getInventory,
  stockIn,
  importStock,
  updateQuantity,
  stockOut,
  transferStock,
  getMovements,
  deductParts,
  addStock,
  getCurrentStock,
  getLowStockItems
};
