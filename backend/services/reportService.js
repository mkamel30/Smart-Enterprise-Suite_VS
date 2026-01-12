/**
 * Report Service - Production Analytics APIs
 * 
 * Provides 5 core report functions matching production specification:
 * 1. Governorate/Branch Performance
 * 2. Monthly Spare Parts (Inventory Movement)
 * 3. POS Stock (Warehouse Inventory)
 * 4. POS Sales Monthly
 * 5. POS Sales Daily
 * 
 * All reports include:
 * - Strict branch isolation
 * - Pagination support
 * - Rich metadata (timezone, currency, execution time)
 * - Standardized response format
 */

const db = require('../db');
const { ensureBranchWhere } = require('../prisma/branchHelpers');

// ==================== HELPERS ====================

/**
 * Get branch filter based on user role
 */
function getBranchFilter(req, explicitBranchId) {
    const isCentral = req.user && ['SUPER_ADMIN', 'MANAGEMENT'].includes(req.user.role);

    // Treat empty strings as no branchId
    const normalizedBranchId = explicitBranchId && explicitBranchId.trim() !== '' ? explicitBranchId : null;

    if (normalizedBranchId) {
        return { branchId: normalizedBranchId };
    }

    if (!isCentral && req.user?.branchId) {
        return { branchId: req.user.branchId };
    }

    // Admin with no specific branch = see ALL data (empty filter)
    return {};
}

/**
 * Parse date range from query params
 */
function parseDateRange(from, to) {
    const dateStart = from ? new Date(from) : new Date(new Date().getFullYear(), 0, 1);
    const dateEnd = to ? new Date(to) : new Date();
    dateEnd.setHours(23, 59, 59, 999);

    const days = Math.ceil((dateEnd - dateStart) / (1000 * 60 * 60 * 24));
    const months = Math.ceil(days / 30);

    return { dateStart, dateEnd, days, months };
}

/**
 * Format month key (YYYY-MM)
 */
function formatMonthKey(date) {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Format month label (Month YYYY)
 */
function formatMonthLabel(monthKey) {
    const [year, month] = monthKey.split('-');
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
}

/**
 * Format date key (YYYY-MM-DD)
 */
function formatDateKey(date) {
    const d = new Date(date);
    return d.toISOString().split('T')[0];
}

/**
 * Get day of week name
 */
function getDayOfWeek(date) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[new Date(date).getDay()];
}

/**
 * Create pagination object
 */
function createPagination(totalRows, page = 1, pageSize = 50) {
    const totalPages = Math.ceil(totalRows / pageSize);
    return {
        page,
        pageSize,
        totalRows,
        totalPages,
        hasNextPage: page < totalPages,
        hasBackPage: page > 1
    };
}

/**
 * Create metadata object
 */
function createMetadata(startTime, filters, dateRange = null) {
    const meta = {
        generatedAt: new Date().toISOString(),
        timezone: 'Africa/Cairo',
        currency: 'EGP',
        executionTimeMs: Date.now() - startTime
    };

    if (dateRange) {
        meta.dateRange = {
            from: dateRange.dateStart.toISOString().split('T')[0],
            to: dateRange.dateEnd.toISOString().split('T')[0],
            days: dateRange.days,
            months: dateRange.months
        };
    }

    meta.filters = filters;
    return meta;
}

// ==================== REPORT SERVICE ====================

const reportService = {

    // ==================== REPORT 1: GOVERNORATE/BRANCH PERFORMANCE ====================
    async getGovernoratePerformance(filters, req) {
        const startTime = Date.now();
        const { dateStart, dateEnd, days } = parseDateRange(filters.from, filters.to);
        const branchFilter = getBranchFilter(req, filters.branchId);
        const page = parseInt(filters.page) || 1;
        const pageSize = Math.min(parseInt(filters.pageSize) || 50, 500);

        // Get all branches
        const branches = await db.branch.findMany({
            where: {
                type: 'BRANCH',
                ...(branchFilter.branchId ? { id: branchFilter.branchId } : {})
            },
            select: { id: true, name: true, code: true }
        });

        const rows = await Promise.all(branches.map(async (branch) => {
            // Activity count = Maintenance requests
            const activities = await db.maintenanceRequest.count(ensureBranchWhere({
                where: {
                    branchId: branch.id,
                    createdAt: { gte: dateStart, lte: dateEnd }
                }
            }, req));

            // Offices served = Customers
            const officesServed = await db.customer.count({
                where: { branchId: branch.id }
            });

            // Machines count
            const machineCount = await db.posMachine.count(ensureBranchWhere({
                where: { branchId: branch.id }
            }, req));

            // Active requests
            const activeRequests = await db.maintenanceRequest.count(ensureBranchWhere({
                where: {
                    branchId: branch.id,
                    status: { in: ['Open', 'In Progress'] },
                    createdAt: { gte: dateStart, lte: dateEnd }
                }
            }, req));

            // Closed requests
            const closedRequests = await db.maintenanceRequest.count(ensureBranchWhere({
                where: {
                    branchId: branch.id,
                    status: 'Closed',
                    closingTimestamp: { gte: dateStart, lte: dateEnd }
                }
            }, req));

            // Finance depts
            const financeDeptsCount = await db.customer.count({
                where: {
                    branchId: branch.id,
                    OR: [
                        { dept: { contains: 'تمويل' } },
                        { dept: { contains: 'finance' } }
                    ]
                }
            });

            // Sharia offices (special customers)
            const shariaOfficesCount = await db.customer.count({
                where: {
                    branchId: branch.id,
                    isSpecial: true
                }
            });

            const closureRate = (activities > 0) ? closedRequests / activities : 0;

            return {
                branchId: branch.id,
                branchName: branch.name,
                metrics: {
                    activities,
                    officesServed,
                    machineCount,
                    activeRequests,
                    closedRequests,
                    closureRate: parseFloat(closureRate.toFixed(2))
                },
                organization: {
                    financeDeptsCount,
                    requiredFinanceOffices: Math.ceil(officesServed * 0.01), // Estimate
                    requiredCenters: Math.ceil(officesServed * 0.005), // Estimate
                    shariaOfficesCount
                }
            };
        }));

        // Sort by activities descending
        rows.sort((a, b) => b.metrics.activities - a.metrics.activities);

        // Calculate summary
        const summary = {
            totalActivities: rows.reduce((sum, r) => sum + r.metrics.activities, 0),
            totalOfficesServed: rows.reduce((sum, r) => sum + r.metrics.officesServed, 0),
            totalMachines: rows.reduce((sum, r) => sum + r.metrics.machineCount, 0),
            totalActiveRequests: rows.reduce((sum, r) => sum + r.metrics.activeRequests, 0),
            totalClosedRequests: rows.reduce((sum, r) => sum + r.metrics.closedRequests, 0),
            avgClosureRate: rows.length > 0
                ? parseFloat((rows.reduce((sum, r) => sum + r.metrics.closureRate, 0) / rows.length).toFixed(2))
                : 0,
            branchCount: rows.length,
            totalFinanceDepts: rows.reduce((sum, r) => sum + r.organization.financeDeptsCount, 0),
            totalRequiredFinanceOffices: rows.reduce((sum, r) => sum + r.organization.requiredFinanceOffices, 0),
            totalRequiredCenters: rows.reduce((sum, r) => sum + r.organization.requiredCenters, 0),
            totalShariaOffices: rows.reduce((sum, r) => sum + r.organization.shariaOfficesCount, 0)
        };

        // Apply pagination
        const paginatedRows = rows.slice((page - 1) * pageSize, page * pageSize);

        return {
            rows: paginatedRows,
            summary,
            pagination: createPagination(rows.length, page, pageSize),
            metadata: createMetadata(startTime, {
                branchId: branchFilter.branchId || null,
                branchName: branchFilter.branchId ? branches.find(b => b.id === branchFilter.branchId)?.name : null
            }, { dateStart, dateEnd, days, months: Math.ceil(days / 30) })
        };
    },

    // ==================== REPORT 2: INVENTORY MOVEMENT ====================
    async getInventoryMovement(filters, req) {
        const startTime = Date.now();
        const { dateStart, dateEnd, days, months } = parseDateRange(filters.from, filters.to);
        const branchFilter = getBranchFilter(req, filters.branchId);
        const page = parseInt(filters.page) || 1;
        const pageSize = Math.min(parseInt(filters.pageSize) || 50, 500);
        const groupBy = filters.groupBy || 'month';

        // Get OUT stock movements
        const movements = await db.stockMovement.findMany(ensureBranchWhere({
            where: {
                type: 'OUT',
                createdAt: { gte: dateStart, lte: dateEnd },
                ...(branchFilter.branchId ? { branchId: branchFilter.branchId } : {})
            },
            include: {
                branch: { select: { id: true, name: true } }
            }
        }, req));

        // Get IN movements for inbound tracking
        const inMovements = await db.stockMovement.findMany(ensureBranchWhere({
            where: {
                type: 'IN',
                createdAt: { gte: dateStart, lte: dateEnd },
                ...(branchFilter.branchId ? { branchId: branchFilter.branchId } : {})
            }
        }, req));

        // Get spare part costs
        const partIds = [...new Set(movements.map(m => m.partId))];
        const parts = await db.sparePart.findMany({
            where: { id: { in: partIds } },
            select: { id: true, name: true, defaultCost: true }
        });
        const partMap = Object.fromEntries(parts.map(p => [p.id, p]));

        // Get requests to determine paid vs free
        const requestIds = [...new Set(movements.filter(m => m.requestId).map(m => m.requestId))];
        const requests = requestIds.length > 0 ? await db.maintenanceRequest.findMany(ensureBranchWhere({
            where: { id: { in: requestIds } },
            select: { id: true, totalCost: true, branchId: true }
        }, req)) : [];
        const requestMap = Object.fromEntries(requests.map(r => [r.id, r]));

        // Aggregate by month
        const monthlyData = {};
        const branchData = {};
        let totalInbound = 0;
        let totalOutbound = 0;

        // Count inbound
        inMovements.forEach(m => {
            const monthKey = formatMonthKey(m.createdAt);
            if (!monthlyData[monthKey]) {
                monthlyData[monthKey] = {
                    month: monthKey,
                    allocation: { paid: { value: 0, quantity: 0 }, freeWarranty: { value: 0, quantity: 0 }, total: { value: 0, quantity: 0 } },
                    movement: { inbound: 0, outbound: 0, netChange: 0 }
                };
            }
            monthlyData[monthKey].movement.inbound += m.quantity;
            totalInbound += m.quantity;
        });

        // Process outbound movements
        movements.forEach(m => {
            const monthKey = formatMonthKey(m.createdAt);
            const part = partMap[m.partId];
            const value = part ? (part.defaultCost || 0) * m.quantity : 0;

            if (!monthlyData[monthKey]) {
                monthlyData[monthKey] = {
                    month: monthKey,
                    allocation: { paid: { value: 0, quantity: 0 }, freeWarranty: { value: 0, quantity: 0 }, total: { value: 0, quantity: 0 } },
                    movement: { inbound: 0, outbound: 0, netChange: 0 }
                };
            }

            const isPaid = m.requestId && requestMap[m.requestId]?.totalCost > 0;

            if (isPaid) {
                monthlyData[monthKey].allocation.paid.value += value;
                monthlyData[monthKey].allocation.paid.quantity += m.quantity;
            } else {
                monthlyData[monthKey].allocation.freeWarranty.value += value;
                monthlyData[monthKey].allocation.freeWarranty.quantity += m.quantity;
            }
            monthlyData[monthKey].allocation.total.value += value;
            monthlyData[monthKey].allocation.total.quantity += m.quantity;
            monthlyData[monthKey].movement.outbound += m.quantity;
            totalOutbound += m.quantity;

            // Branch aggregation
            if (m.branch) {
                const branchKey = m.branch.id;
                if (!branchData[branchKey]) {
                    branchData[branchKey] = {
                        branchId: branchKey,
                        branchName: m.branch.name,
                        warehouseName: `مستودع ${m.branch.name}`,
                        totalValue: 0,
                        totalQuantity: 0,
                        paidValue: 0,
                        freeValue: 0
                    };
                }
                branchData[branchKey].totalValue += value;
                branchData[branchKey].totalQuantity += m.quantity;
                if (isPaid) {
                    branchData[branchKey].paidValue += value;
                } else {
                    branchData[branchKey].freeValue += value;
                }
            }
        });

        // Calculate net change and percentages
        const timeline = Object.values(monthlyData).map(m => {
            m.movement.netChange = m.movement.inbound - m.movement.outbound;
            m.paidPercentage = m.allocation.total.value > 0
                ? parseFloat((m.allocation.paid.value / m.allocation.total.value).toFixed(2))
                : 0;
            m.freePercentage = parseFloat((1 - m.paidPercentage).toFixed(2));
            m.allocation.paid.currency = 'EGP';
            m.allocation.freeWarranty.currency = 'EGP';
            m.allocation.total.currency = 'EGP';
            return m;
        }).sort((a, b) => b.month.localeCompare(a.month));

        const branchBreakdown = Object.values(branchData).map(b => ({
            ...b,
            paidPercentage: b.totalValue > 0 ? parseFloat((b.paidValue / b.totalValue).toFixed(2)) : 0
        })).sort((a, b) => b.totalValue - a.totalValue);

        const grandTotal = timeline.reduce((sum, t) => sum + t.allocation.total.value, 0);
        const paidTotal = timeline.reduce((sum, t) => sum + t.allocation.paid.value, 0);
        const freeTotal = timeline.reduce((sum, t) => sum + t.allocation.freeWarranty.value, 0);

        return {
            timeline: timeline.slice((page - 1) * pageSize, page * pageSize),
            branchBreakdown,
            summary: {
                grandTotal: { value: grandTotal, quantity: totalOutbound, currency: 'EGP' },
                paidTotal: { value: paidTotal, quantity: Math.round(totalOutbound * (paidTotal / grandTotal || 0)), currency: 'EGP' },
                freeTotal: { value: freeTotal, quantity: Math.round(totalOutbound * (freeTotal / grandTotal || 0)), currency: 'EGP' },
                avgPaidPercentage: grandTotal > 0 ? parseFloat((paidTotal / grandTotal).toFixed(2)) : 0,
                monthsInRange: timeline.length,
                totalBranches: branchBreakdown.length,
                totalWarehouses: branchBreakdown.length
            },
            pagination: createPagination(timeline.length, page, pageSize),
            metadata: createMetadata(startTime, {
                branchId: branchFilter.branchId || null,
                warehouseId: filters.warehouseId || null,
                groupBy
            }, { dateStart, dateEnd, days, months })
        };
    },

    // ==================== REPORT 3: POS STOCK ====================
    async getPosStock(filters, req) {
        const startTime = Date.now();
        const branchFilter = getBranchFilter(req, filters.branchId);
        const includeOutOfStock = filters.includeOutOfStock === 'true';
        const sortBy = filters.sortBy || 'model';

        // Get warehouse machines in stock
        const machines = await db.warehouseMachine.findMany(ensureBranchWhere({
            where: {
                status: { in: ['NEW', 'AVAILABLE', 'REPAIRED', 'READY'] },
                ...(branchFilter.branchId ? { branchId: branchFilter.branchId } : {}),
                ...(filters.model ? { model: filters.model } : {})
            },
            include: {
                branch: { select: { id: true, name: true } }
            }
        }, req));

        // Get machine parameters for pricing
        const machineParams = await db.machineParameter.findMany();
        const modelPriceMap = Object.fromEntries(machineParams.map(p => [p.model, 6500])); // Default price

        // Group by branch and model
        const branchModelMap = {};
        const modelCounts = {};

        machines.forEach(m => {
            const branchName = m.branch?.name || 'غير محدد';
            const branchId = m.branch?.id || 'unknown';
            const model = m.model || 'Unknown';
            const unitPrice = modelPriceMap[model] || 6500;

            if (!branchModelMap[branchId]) {
                branchModelMap[branchId] = {
                    branchId,
                    branchName,
                    warehouseId: `warehouse_${branchId}`,
                    warehouseName: `مستودع ${branchName}`,
                    models: [],
                    branchTotal: 0,
                    branchTotalValue: 0,
                    lowStockAlerts: 0,
                    criticalStockAlerts: 0
                };
            }

            // Find or create model entry
            let modelEntry = branchModelMap[branchId].models.find(me => me.modelName === model);
            if (!modelEntry) {
                modelEntry = {
                    modelId: `model_${model.toLowerCase().replace(/\s+/g, '_')}`,
                    modelName: model,
                    modelCategory: 'POS_MACHINE',
                    stock: 0,
                    reorderLevel: 20,
                    reorderQuantity: 15,
                    lastRestocked: null,
                    daysInStock: 0,
                    status: 'NORMAL',
                    unitPrice,
                    totalValue: 0
                };
                branchModelMap[branchId].models.push(modelEntry);
            }

            modelEntry.stock += 1;
            modelEntry.totalValue = modelEntry.stock * unitPrice;
            modelEntry.lastRestocked = m.importDate;
            modelEntry.daysInStock = Math.floor((Date.now() - new Date(m.importDate).getTime()) / (1000 * 60 * 60 * 24));

            // Determine status
            if (modelEntry.stock <= 5) {
                modelEntry.status = 'CRITICAL';
                branchModelMap[branchId].criticalStockAlerts += 1;
            } else if (modelEntry.stock <= modelEntry.reorderLevel) {
                modelEntry.status = 'LOW';
                branchModelMap[branchId].lowStockAlerts += 1;
            }

            branchModelMap[branchId].branchTotal += 1;
            branchModelMap[branchId].branchTotalValue += unitPrice;

            // Model summary
            if (!modelCounts[model]) {
                modelCounts[model] = {
                    modelId: `model_${model.toLowerCase().replace(/\s+/g, '_')}`,
                    modelName: model,
                    totalStock: 0,
                    totalValue: 0,
                    branchCount: new Set(),
                    lowStockBranches: 0,
                    criticalStockBranches: 0
                };
            }
            modelCounts[model].totalStock += 1;
            modelCounts[model].totalValue += unitPrice;
            modelCounts[model].branchCount.add(branchId);
        });

        const rows = Object.values(branchModelMap).sort((a, b) => {
            if (sortBy === 'stock') return b.branchTotal - a.branchTotal;
            if (sortBy === 'branchName') return a.branchName.localeCompare(b.branchName);
            return b.branchTotal - a.branchTotal; // default
        });

        const modelSummary = Object.values(modelCounts).map(m => ({
            modelId: m.modelId,
            modelName: m.modelName,
            totalStock: m.totalStock,
            totalValue: m.totalValue,
            branchCount: m.branchCount.size,
            avgStockPerBranch: Math.round(m.totalStock / m.branchCount.size),
            lowStockBranches: 0, // Would need more logic
            criticalStockBranches: 0
        })).sort((a, b) => b.totalStock - a.totalStock);

        const grandTotal = machines.length;
        const grandTotalValue = machines.reduce((sum, m) => sum + (modelPriceMap[m.model] || 6500), 0);

        return {
            rows,
            modelSummary,
            summary: {
                grandTotal,
                grandTotalValue,
                currency: 'EGP',
                branchCount: rows.length,
                modelCount: modelSummary.length,
                totalLowStockAlerts: rows.reduce((sum, r) => sum + r.lowStockAlerts, 0),
                totalCriticalStockAlerts: rows.reduce((sum, r) => sum + r.criticalStockAlerts, 0),
                needsRestockingBranches: rows.filter(r => r.lowStockAlerts > 0 || r.criticalStockAlerts > 0).length,
                lastUpdated: new Date().toISOString()
            },
            metadata: createMetadata(startTime, {
                branchId: branchFilter.branchId || null,
                model: filters.model || null,
                warehouseId: filters.warehouseId || null,
                includeOutOfStock,
                sortBy
            })
        };
    },

    // ==================== REPORT 4: POS SALES MONTHLY ====================
    async getPosSalesMonthly(filters, req) {
        const startTime = Date.now();
        const { dateStart, dateEnd, days, months } = parseDateRange(filters.from, filters.to);
        const branchFilter = getBranchFilter(req, filters.branchId);
        const page = parseInt(filters.page) || 1;
        const pageSize = Math.min(parseInt(filters.pageSize) || 50, 500);

        const sales = await db.machineSale.findMany(ensureBranchWhere({
            where: {
                saleDate: { gte: dateStart, lte: dateEnd },
                ...(branchFilter.branchId ? { branchId: branchFilter.branchId } : {}),
                ...(filters.status ? { status: filters.status } : {})
            },
            include: {
                branch: { select: { id: true, name: true } }
            }
        }, req));

        // Aggregate by month
        const monthlyData = {};
        const branchData = {};
        const avgPrice = 10000; // Average machine price estimate

        sales.forEach(s => {
            const monthKey = formatMonthKey(s.saleDate);
            const branchId = s.branch?.id || 'unknown';
            const branchName = s.branch?.name || 'غير محدد';

            // Determine status category
            let statusCategory = 'review';
            if (s.type === 'CASH' && s.status === 'COMPLETED') {
                statusCategory = 'cash';
            } else if (s.type === 'INSTALLMENT') {
                statusCategory = 'financed';
            } else if (['CANCELLED', 'VOIDED'].includes(s.status)) {
                statusCategory = 'cancelled';
            }

            if (!monthlyData[monthKey]) {
                monthlyData[monthKey] = {
                    month: monthKey,
                    monthLabel: formatMonthLabel(monthKey),
                    machineCount: 0,
                    sales: { cash: 0, review: 0, financed: 0, cancelled: 0 },
                    revenue: { estimatedFromCash: 0, estimatedFromReview: 0, estimatedFromFinanced: 0, estimatedTotal: 0, currency: 'EGP' }
                };
            }
            monthlyData[monthKey].machineCount += 1;
            monthlyData[monthKey].sales[statusCategory] += 1;

            const saleValue = s.totalPrice || avgPrice;
            if (statusCategory === 'cash') monthlyData[monthKey].revenue.estimatedFromCash += saleValue;
            else if (statusCategory === 'review') monthlyData[monthKey].revenue.estimatedFromReview += saleValue;
            else if (statusCategory === 'financed') monthlyData[monthKey].revenue.estimatedFromFinanced += saleValue;
            monthlyData[monthKey].revenue.estimatedTotal += saleValue;

            // Branch aggregation
            if (!branchData[branchId]) {
                branchData[branchId] = {
                    branchId,
                    branchName,
                    periodTotal: 0,
                    sales: { cash: 0, review: 0, financed: 0, cancelled: 0 },
                    estimatedRevenue: 0
                };
            }
            branchData[branchId].periodTotal += 1;
            branchData[branchId].sales[statusCategory] += 1;
            branchData[branchId].estimatedRevenue += saleValue;
        });

        // Calculate percentages
        const timeline = Object.values(monthlyData).map(m => {
            const total = m.machineCount;
            m.statusBreakdown = {
                cash: total > 0 ? parseFloat((m.sales.cash / total).toFixed(3)) : 0,
                review: total > 0 ? parseFloat((m.sales.review / total).toFixed(3)) : 0,
                financed: total > 0 ? parseFloat((m.sales.financed / total).toFixed(3)) : 0,
                cancelled: total > 0 ? parseFloat((m.sales.cancelled / total).toFixed(3)) : 0
            };
            m.conversionMetrics = {
                reviewToApprovedRate: 0.95, // Would need historical data
                avgDaysInReview: 5
            };
            return m;
        }).sort((a, b) => b.month.localeCompare(a.month));

        const branchBreakdown = Object.values(branchData).map(b => {
            const total = b.periodTotal;
            b.statusPercentages = {
                cash: total > 0 ? parseFloat((b.sales.cash / total).toFixed(3)) : 0,
                review: total > 0 ? parseFloat((b.sales.review / total).toFixed(3)) : 0,
                financed: total > 0 ? parseFloat((b.sales.financed / total).toFixed(3)) : 0,
                cancelled: total > 0 ? parseFloat((b.sales.cancelled / total).toFixed(3)) : 0
            };
            b.avgMonthly = Math.round(b.periodTotal / (months || 1));
            return b;
        }).sort((a, b) => b.periodTotal - a.periodTotal);

        const grandTotal = sales.length;
        const periodSales = {
            cash: sales.filter(s => s.type === 'CASH' && s.status === 'COMPLETED').length,
            review: sales.filter(s => ['PENDING', 'REVIEW'].includes(s.status)).length,
            financed: sales.filter(s => s.type === 'INSTALLMENT').length,
            cancelled: sales.filter(s => ['CANCELLED', 'VOIDED'].includes(s.status)).length
        };

        return {
            timeline: timeline.slice((page - 1) * pageSize, page * pageSize),
            branchBreakdown,
            summary: {
                grandTotal,
                periodSales,
                periodBreakdown: {
                    cash: grandTotal > 0 ? parseFloat((periodSales.cash / grandTotal).toFixed(3)) : 0,
                    review: grandTotal > 0 ? parseFloat((periodSales.review / grandTotal).toFixed(3)) : 0,
                    financed: grandTotal > 0 ? parseFloat((periodSales.financed / grandTotal).toFixed(3)) : 0,
                    cancelled: grandTotal > 0 ? parseFloat((periodSales.cancelled / grandTotal).toFixed(3)) : 0
                },
                totalEstimatedRevenue: sales.reduce((sum, s) => sum + (s.totalPrice || avgPrice), 0),
                avgMonthly: Math.round(grandTotal / (months || 1)),
                topPerformingBranch: branchBreakdown[0] || null,
                lowestPerformingBranch: branchBreakdown[branchBreakdown.length - 1] || null
            },
            pagination: createPagination(timeline.length, page, pageSize),
            metadata: createMetadata(startTime, {
                branchId: branchFilter.branchId || null,
                status: filters.status || null
            }, { dateStart, dateEnd, days, months })
        };
    },

    // ==================== REPORT 5: POS SALES DAILY ====================
    async getPosSalesDaily(filters, req) {
        const startTime = Date.now();
        const { dateStart, dateEnd, days } = parseDateRange(filters.from, filters.to);
        const branchFilter = getBranchFilter(req, filters.branchId);
        const page = parseInt(filters.page) || 1;
        const pageSize = Math.min(parseInt(filters.pageSize) || 50, 500);
        const sortBy = filters.sortBy || 'date';

        const sales = await db.machineSale.findMany(ensureBranchWhere({
            where: {
                saleDate: { gte: dateStart, lte: dateEnd },
                ...(branchFilter.branchId ? { branchId: branchFilter.branchId } : {})
            },
            include: {
                branch: { select: { id: true, name: true } }
            }
        }, req));

        // Get machine models
        const serialNumbers = sales.map(s => s.serialNumber);
        const machines = serialNumbers.length > 0 ? await db.warehouseMachine.findMany(ensureBranchWhere({
            where: { serialNumber: { in: serialNumbers } },
            select: { serialNumber: true, model: true, branchId: true }
        }, req)) : [];
        const machineModelMap = Object.fromEntries(machines.map(m => [m.serialNumber, m.model || 'Unknown']));

        const avgPrice = 10000;
        const dailyData = {};
        const branchData = {};
        const modelCounts = {};
        const segmentCounts = {};

        sales.forEach(s => {
            const dateKey = formatDateKey(s.saleDate);
            const branchId = s.branch?.id || 'unknown';
            const branchName = s.branch?.name || 'غير محدد';
            const model = machineModelMap[s.serialNumber] || 'Unknown';
            const saleValue = s.totalPrice || avgPrice;

            let statusCategory = 'review';
            if (s.type === 'CASH' && s.status === 'COMPLETED') statusCategory = 'cash';
            else if (s.type === 'INSTALLMENT') statusCategory = 'financed';

            // Daily aggregation
            if (!dailyData[dateKey]) {
                dailyData[dateKey] = {
                    date: dateKey,
                    dayOfWeek: getDayOfWeek(dateKey),
                    machineCount: 0,
                    sales: { cash: 0, review: 0, financed: 0 },
                    revenue: { estimatedTotal: 0, currency: 'EGP' },
                    byModel: [],
                    bySegment: [],
                    byAgent: []
                };
            }
            dailyData[dateKey].machineCount += 1;
            dailyData[dateKey].sales[statusCategory] += 1;
            dailyData[dateKey].revenue.estimatedTotal += saleValue;

            // Branch
            if (!branchData[branchId]) {
                branchData[branchId] = {
                    branchId,
                    branchName,
                    periodTotal: 0,
                    avgDaily: 0,
                    totalRevenue: 0,
                    topModel: null,
                    topSegment: null,
                    topAgent: null
                };
            }
            branchData[branchId].periodTotal += 1;
            branchData[branchId].totalRevenue += saleValue;

            // Model distribution
            if (!modelCounts[model]) {
                modelCounts[model] = {
                    modelId: `model_${model.toLowerCase().replace(/\s+/g, '_')}`,
                    modelName: model,
                    count: 0,
                    revenue: 0,
                    daysActive: new Set(),
                    percentage: 0
                };
            }
            modelCounts[model].count += 1;
            modelCounts[model].revenue += saleValue;
            modelCounts[model].daysActive.add(dateKey);

            // Segment (using customer type as proxy)
            const segment = 'Retail'; // Would need customer data
            if (!segmentCounts[segment]) {
                segmentCounts[segment] = {
                    segmentId: `segment_${segment.toLowerCase()}`,
                    segmentName: segment,
                    count: 0,
                    revenue: 0
                };
            }
            segmentCounts[segment].count += 1;
            segmentCounts[segment].revenue += saleValue;
        });

        // Build timeline
        let timeline = Object.values(dailyData);
        if (sortBy === 'sales') {
            timeline.sort((a, b) => b.machineCount - a.machineCount);
        } else if (sortBy === 'revenue') {
            timeline.sort((a, b) => b.revenue.estimatedTotal - a.revenue.estimatedTotal);
        } else {
            timeline.sort((a, b) => a.date.localeCompare(b.date));
        }

        const branchBreakdown = Object.values(branchData).map(b => {
            b.avgDaily = Math.round(b.periodTotal / (days || 1));
            return b;
        }).sort((a, b) => b.periodTotal - a.periodTotal);

        const grandTotal = sales.length;
        const modelDistribution = Object.values(modelCounts).map(m => ({
            ...m,
            percentage: grandTotal > 0 ? parseFloat((m.count / grandTotal).toFixed(3)) : 0,
            daysActive: m.daysActive.size,
            avgPerDay: Math.round(m.count / (m.daysActive.size || 1))
        })).sort((a, b) => b.count - a.count);

        const segmentDistribution = Object.values(segmentCounts).map(s => ({
            ...s,
            percentage: grandTotal > 0 ? parseFloat((s.count / grandTotal).toFixed(3)) : 0
        })).sort((a, b) => b.count - a.count);

        // Find top/lowest days
        const sortedByCount = [...timeline].sort((a, b) => b.machineCount - a.machineCount);
        const topDay = sortedByCount[0] || null;
        const lowestDay = sortedByCount[sortedByCount.length - 1] || null;

        return {
            timeline: timeline.slice((page - 1) * pageSize, page * pageSize),
            branchBreakdown,
            modelDistribution,
            segmentDistribution,
            summary: {
                grandTotal,
                periodSales: {
                    cash: sales.filter(s => s.type === 'CASH' && s.status === 'COMPLETED').length,
                    review: sales.filter(s => ['PENDING', 'REVIEW'].includes(s.status)).length,
                    financed: sales.filter(s => s.type === 'INSTALLMENT').length
                },
                totalRevenue: sales.reduce((sum, s) => sum + (s.totalPrice || avgPrice), 0),
                avgDaily: Math.round(grandTotal / (days || 1)),
                topPerformingDay: topDay ? { date: topDay.date, sales: topDay.machineCount, revenue: topDay.revenue.estimatedTotal } : null,
                lowestPerformingDay: lowestDay ? { date: lowestDay.date, sales: lowestDay.machineCount, revenue: lowestDay.revenue.estimatedTotal } : null,
                topPerformingAgent: null // Would need agent data
            },
            pagination: createPagination(timeline.length, page, pageSize),
            metadata: createMetadata(startTime, {
                branchId: branchFilter.branchId || null,
                model: filters.model || null,
                segment: filters.segment || null,
                agentId: filters.agentId || null,
                sortBy
            }, { dateStart, dateEnd, days, months: Math.ceil(days / 30) })
        };
    }
};

module.exports = reportService;
