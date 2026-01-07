const db = require('../db');

/**
 * Helper to round money values (2 decimal places) - CRITICAL for financial precision
 * Prevents floating point errors like 3000 becoming 2999.98
 * @param {number|string} value - The value to round
 * @returns {number} Rounded value to 2 decimal places
 */
const roundMoney = (value) => Math.round(parseFloat(value || 0) * 100) / 100;

/**
 * Create SINGLE payment for multiple parts (sum of costs)
 * @param {Array} parts - Array of parts with {name, quantity, cost, isPaid}
 * @param {String} requestId - Request ID
 * @param {Object} customer - {id, name}
 * @param {Object} user - {id, name}
 * @param {Object} tx - Optional transaction object
 * @returns {Promise<Object|null>} Created payment or null if no paid parts
 */
async function createMaintenancePayment(parts, requestId, customer, user, receiptNumber = null, tx = null, branchId) {
    const txOrDb = tx || db;

    // Filter paid parts
    const paidParts = parts.filter(p => p.isPaid && p.cost > 0);

    if (paidParts.length === 0) {
        return null; // No payment needed
    }

    // Calculate total cost with proper rounding
    const totalCost = roundMoney(paidParts.reduce((sum, p) => {
        return sum + roundMoney(parseFloat(p.cost) * p.quantity);
    }, 0));

    // Build detailed reason string
    const partsList = paidParts
        .map(p => `${p.name} (${p.quantity}أ—${p.cost})`)
        .join(' + ');

    // Create payment
    const payment = await txOrDb.payment.create({
        data: {
            customerId: customer.id,
            customerName: customer.name,
            requestId: requestId,
            amount: totalCost,
            type: 'MAINTENANCE',
            reason: `ظ‚ط·ط¹ ط؛ظٹط§ط±: ${partsList}`,
            paymentPlace: 'ط¶ط§ظ…ظ†',
            receiptNumber: receiptNumber,
            userId: user.id,
            userName: user.name,
            branchId: branchId // Add branchId
        }
    });

    return payment;
}

/**
 * Create manual payment
 * @param {Object} data - Payment data
 * @param {Object} user - User creating payment
 * @returns {Promise<Object>} Created payment
 */
async function createManualPayment(data, user) {
    return await db.$transaction(async (tx) => {
        const branchId = data.branchId || user.branchId;
        // Validate customer exists
        const customer = await tx.customer.findFirst({
            where: { bkcode: data.customerId, branchId }
        });

        if (!customer) {
            throw new Error('ط§ظ„ط¹ظ…ظٹظ„ ط؛ظٹط± ظ…ظˆط¬ظˆط¯');
        }

        // Create payment
        const payment = await tx.payment.create({
            data: {
                customerId: data.customerId,
                customerName: customer.client_name,
                requestId: data.requestId || null,
                amount: roundMoney(data.amount),
                type: data.type || 'MANUAL',
                reason: data.reason,
                paymentPlace: data.paymentPlace,
                receiptNumber: data.receiptNumber,
                notes: data.notes,
                userId: user.id,
                userName: user.name,
                branchId: data.branchId || user.branchId // Add branchId
            }
        });

        // Log action
        await tx.systemLog.create({
            data: {
                entityType: 'PAYMENT',
                entityId: payment.id,
                action: 'CREATE',
                details: JSON.stringify({
                    amount: payment.amount,
                    type: payment.type,
                    customerId: payment.customerId
                }),
                userId: user.id,
                performedBy: user.name,
                branchId: payment.branchId
            }
        });

        return payment;
    });
}

/**
 * Get payments for a request
 * @param {String} requestId - Request ID
 * @returns {Promise<Array>} Array of payments
 */
async function getRequestPayments(requestId) {
    return await db.payment.findMany({
        where: { requestId },
        orderBy: { createdAt: 'desc' }
    });
}

/**
 * Get total payments for a customer
 * @param {String} customerId - Customer ID
 * @returns {Promise<Number>} Total amount
 */
async function getCustomerTotalPayments(customerId) {
    const result = await db.payment.aggregate({
        where: { customerId },
        _sum: { amount: true }
    });

    return result._sum.amount || 0;
}

module.exports = {
    roundMoney,
    createMaintenancePayment,
    createManualPayment,
    getRequestPayments,
    getCustomerTotalPayments
};
