const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { getBranchFilter } = require('../middleware/permissions');
const { ensureBranchWhere } = require('../prisma/branchHelpers');

// GET Current Inventory Report
router.get('/reports/inventory', authenticateToken, async (req, res) => {
    try {
        const branchFilter = getBranchFilter(req);
        const parts = await db.sparePart.findMany({
            include: {
                inventoryItems: {
                    where: branchFilter
                }
            }
        });

        const report = parts.map(part => {
            const quantity = part.inventoryItems.reduce((sum, item) => sum + item.quantity, 0);
            return {
                id: part.id,
                partNumber: part.partNumber,
                name: part.name,
                defaultCost: part.defaultCost,
                quantity: quantity
            };
        });

        res.json(report);
    } catch (error) {
        console.error('Failed to generate inventory report:', error);
        res.status(500).json({ error: 'Failed to generate inventory report' });
    }
});

// GET Stock Movements Report (OUT)
router.get('/reports/movements', authenticateToken, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        // Build date filter
        const dateFilter = {};
        if (startDate) dateFilter.gte = new Date(startDate);
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            dateFilter.lte = end;
        }

        // Get OUT movements
        const movements = await db.stockMovement.findMany(ensureBranchWhere({
            where: {
                type: 'OUT',
                createdAt: dateFilter,
                ...getBranchFilter(req)
            },
            orderBy: { createdAt: 'desc' }
        }, req));

        // Get related requests manually
        const requestIds = [...new Set(movements.map(m => m.requestId).filter(id => id))];
        const requests = await db.maintenanceRequest.findMany(ensureBranchWhere({
            where: { id: { in: requestIds } },
            include: {
                posMachine: true,
                customer: true
            }
        }, req));
        const requestMap = Object.fromEntries(requests.map(r => [r.id, r]));

        // Get parts details
        const partIds = [...new Set(movements.map(m => m.partId))];
        const parts = await db.sparePart.findMany({
            where: { id: { in: partIds } }
        });
        const partMap = Object.fromEntries(parts.map(p => [p.id, p]));

        // Group by Part and by Date
        const grouped = {};
        const dailyStats = {};
        const dailyDetailMap = {}; // Helper for aggregation: { date: { partId: { ... } } }

        movements.forEach(m => {
            const dateStr = new Date(m.createdAt).toLocaleDateString('en-CA'); // YYYY-MM-DD
            const quantity = m.quantity || 0;

            // 1. Daily Stats (for chart)
            dailyStats[dateStr] = (dailyStats[dateStr] || 0) + quantity;

            // 2. Part Mapping
            const part = partMap[m.partId];
            if (!part && !m.partId) return;

            const partName = part?.name || 'Unknown';
            const partNumber = part?.partNumber || '';

            // 3. Resolve Request/Machine Info
            let machineInfo = null;
            let clientNumber = null;

            const request = m.requestId ? requestMap[m.requestId] : null;
            if (request && request.posMachine) {
                machineInfo = request.posMachine.serialNumber;
                clientNumber = request.customer?.bkcode;
            } else if (m.reason) {
                machineInfo = m.reason; // Manual reason
                clientNumber = "Manual";
            }

            // 4. Determine Payment Status
            let isPaid = false;
            if (request && request.usedParts) {
                try {
                    const parsed = JSON.parse(request.usedParts);
                    const reqParts = Array.isArray(parsed) ? parsed : (parsed.parts || []);
                    const partEntry = reqParts.find(p =>
                        (p.partId === m.partId) ||
                        (p.name === partName) ||
                        (part && p.name === part.name)
                    );

                    if (partEntry && Number(partEntry.cost) > 0) {
                        isPaid = true;
                    }
                } catch (e) {
                    // JSON parse error, assume unpaid
                }
            }

            // 5. Group by Part (Default View - Summary)
            if (!grouped[m.partId]) {
                grouped[m.partId] = {
                    partId: m.partId,
                    partName: partName,
                    partNumber: partNumber,
                    totalQuantity: 0,
                    totalQuantityPaid: 0,
                    totalQuantityUnpaid: 0,
                    machines: []
                };
            }
            grouped[m.partId].totalQuantity += quantity;
            if (isPaid) {
                grouped[m.partId].totalQuantityPaid += quantity;
            } else {
                grouped[m.partId].totalQuantityUnpaid += quantity;
            }

            if (machineInfo && !grouped[m.partId].machines.includes(machineInfo)) {
                grouped[m.partId].machines.push(machineInfo);
            }

            // 6. Group by Day (Aggregated View)
            if (!dailyDetailMap[dateStr]) {
                dailyDetailMap[dateStr] = {};
            }
            if (!dailyDetailMap[dateStr][m.partId]) {
                dailyDetailMap[dateStr][m.partId] = {
                    partName,
                    partNumber,
                    quantity: 0,
                    quantityPaid: 0,
                    quantityUnpaid: 0,
                    machines: new Set(),
                    clients: new Set()
                };
            }

            const dayItem = dailyDetailMap[dateStr][m.partId];
            dayItem.quantity += quantity;
            if (isPaid) dayItem.quantityPaid += quantity;
            else dayItem.quantityUnpaid += quantity;

            if (machineInfo) dayItem.machines.add(machineInfo);
            if (clientNumber) dayItem.clients.add(clientNumber);
        });

        const report = Object.values(grouped).map(item => ({
            ...item,
            machinesText: item.machines.join(' ; ')
        }));

        // Format daily stats for chart
        const dailyChartData = Object.entries(dailyStats)
            .map(([date, count]) => ({ date, count }))
            .sort((a, b) => a.date.localeCompare(b.date));

        // Transform and sort daily detail
        const sortedDailyDetail = Object.keys(dailyDetailMap)
            .sort((a, b) => b.localeCompare(a))
            .reduce((obj, date) => {
                const parts = Object.values(dailyDetailMap[date]).map(p => ({
                    ...p,
                    machine: Array.from(p.machines).join(' ; '),
                    client: Array.from(p.clients).join(' ; ')
                }));
                obj[date] = parts;
                return obj;
            }, {});

        res.json({
            items: report,
            dailyStats: dailyChartData,
            dailyDetail: sortedDailyDetail
        });
    } catch (error) {
        console.error('Failed to generate movements report:', error);
        res.status(500).json({ error: 'Failed to generate movements report' });
    }
});

// GET Performance Analysis Report
router.get('/reports/performance', authenticateToken, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const whereClause = { status: 'Closed', ...getBranchFilter(req) };
        if (startDate || endDate) {
            whereClause.closingTimestamp = {};
            if (startDate) whereClause.closingTimestamp.gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                whereClause.closingTimestamp.lte = end;
            }
        }

        const requests = await db.maintenanceRequest.findMany(ensureBranchWhere({
            where: whereClause,
            select: {
                id: true,
                technician: true,
                closingUserName: true,
                createdAt: true,
                closingTimestamp: true,
                totalCost: true,
                usedParts: true
            }
        }, req));

        const technicianStats = {};

        requests.forEach(req => {
            // Identify technician: prefer assigned technician, fallback to closer
            const techName = req.technician || req.closingUserName || 'Unknown';

            if (!technicianStats[techName]) {
                technicianStats[techName] = {
                    name: techName,
                    requestCount: 0,
                    totalRevenue: 0,
                    totalRepairTimeMs: 0,
                    fastestRepairMs: Infinity,
                    slowestRepairMs: 0,
                    partsReplacedCount: 0
                };
            }

            const stats = technicianStats[techName];
            stats.requestCount++;
            stats.totalRevenue += (req.totalCost || 0);

            // Calculate Repair Time
            const start = new Date(req.createdAt).getTime();
            const end = new Date(req.closingTimestamp).getTime();
            const duration = end - start;

            if (duration > 0) {
                stats.totalRepairTimeMs += duration;
                if (duration < stats.fastestRepairMs) stats.fastestRepairMs = duration;
                if (duration > stats.slowestRepairMs) stats.slowestRepairMs = duration;
            }

            // Estimate parts count
            if (req.usedParts) {
                try {
                    const parsed = JSON.parse(req.usedParts);
                    const parts = Array.isArray(parsed) ? parsed : (parsed.parts || []);
                    stats.partsReplacedCount += parts.reduce((sum, p) => sum + (p.quantity || 0), 0);
                } catch (e) { }
            }
        });

        const report = Object.values(technicianStats).map(stat => {
            const avgMs = stat.requestCount > 0 ? stat.totalRepairTimeMs / stat.requestCount : 0;
            return {
                name: stat.name,
                requestCount: stat.requestCount,
                totalRevenue: stat.totalRevenue,
                partsReplacedCount: stat.partsReplacedCount,
                avgRepairTimeHours: (avgMs / (1000 * 60 * 60)).toFixed(1), // Hours
                avgRepairTimeDays: (avgMs / (1000 * 60 * 60 * 24)).toFixed(1), // Days
                fastestRepairHours: (stat.fastestRepairMs === Infinity ? 0 : stat.fastestRepairMs / (1000 * 60 * 60)).toFixed(1),
                slowestRepairHours: (stat.slowestRepairMs / (1000 * 60 * 60)).toFixed(1)
            };
        }).sort((a, b) => b.requestCount - a.requestCount); // Sort by volume descending

        res.json(report);

    } catch (error) {
        console.error('Failed to generate performance report:', error);
        res.status(500).json({ error: 'Failed to generate performance report' });
    }
});

// GET Executive / High-Level Analytics (Admin Only)
const executiveHandler = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        let { branchId } = req.query;

        // Security: Central roles (Admins) can see all branches, others are locked to their own
        const centralRoles = ['SUPER_ADMIN', 'MANAGEMENT'];
        const isCentral = req.user && centralRoles.includes(req.user.role);

        if (!isCentral) {
            branchId = req.user.branchId;
        }

        // 1. Build Base Filters
        const dateFilter = {};
        if (startDate) dateFilter.gte = new Date(startDate);
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            dateFilter.lte = end;
        }

        const paymentWhere = {};
        if (branchId) paymentWhere.branchId = branchId;
        if (Object.keys(dateFilter).length > 0) paymentWhere.createdAt = dateFilter;

        const salesWhere = {};
        if (branchId) salesWhere.branchId = branchId;
        if (Object.keys(dateFilter).length > 0) salesWhere.saleDate = dateFilter;

        // 2. Fetch Data
        const payments = await db.payment.findMany(ensureBranchWhere({ where: paymentWhere }, req));
        const machineSales = await db.machineSale.findMany({ where: salesWhere });

        // 3. Calculate Categorized Collections (Breakdown)
        const breakdown = {
            machines: 0,
            sims: 0,
            maintenance: 0,
            manual: 0,
            other: 0
        };

        payments.forEach(p => {
            const type = p.type || '';
            const reason = p.reason || '';

            if (type === 'INSTALLMENT' || type === 'MACHINE_SALE' || reason.includes('ظ…ط§ظƒظٹظ†ط©') || reason.includes('ظ‚ط³ط·')) {
                breakdown.machines += p.amount;
            } else if (type === 'SIM_PURCHASE' || type === 'SIM_EXCHANGE' || reason.includes('ط´ط±ظٹط­ط©')) {
                breakdown.sims += p.amount;
            } else if (type === 'MAINTENANCE' || reason.includes('طµظٹط§ظ†ط©') || reason.includes('ظ‚ط·ط¹ ط؛ظٹط§ط±')) {
                breakdown.maintenance += p.amount;
            } else if (type === 'MANUAL') {
                breakdown.manual += p.amount;
            } else {
                breakdown.other += p.amount;
            }
        });

        const totalCollected = Object.values(breakdown).reduce((sum, val) => sum + val, 0);

        // 4. Calculate Total Sales Value
        // Total Sales = Total Machine Contract Values + Direct Non-Machine Sales
        const totalMachineSalesValue = machineSales.reduce((sum, s) => sum + s.totalPrice, 0);
        const directSalesValue = breakdown.sims + breakdown.maintenance + breakdown.manual + breakdown.other;
        const totalSalesValue = totalMachineSalesValue + directSalesValue;

        const totalOutstanding = totalSalesValue - totalCollected;

        // 5. Branch Performance Analysis
        const branches = await db.branch.findMany();
        const branchPerformance = await Promise.all(branches.map(async (branch) => {
            const bPayments = await db.payment.findMany({ where: { branchId: branch.id, createdAt: dateFilter } });
            const bSales = await db.machineSale.findMany({ where: { branchId: branch.id, saleDate: dateFilter } });

            const bCollected = bPayments.reduce((sum, p) => sum + p.amount, 0);
            const bMachineSales = bSales.reduce((sum, s) => sum + s.totalPrice, 0);

            // Non-machine payments in this branch
            const bNonMachine = bPayments
                .filter(p => !['INSTALLMENT', 'MACHINE_SALE'].includes(p.type) && !p.reason?.includes('ظ…ط§ظƒظٹظ†ط©') && !p.reason?.includes('ظ‚ط³ط·'))
                .reduce((sum, p) => sum + p.amount, 0);

            return {
                id: branch.id,
                name: branch.name,
                revenue: bMachineSales + bNonMachine,
                collections: bCollected,
                salesCount: bSales.length,
                paymentCount: bPayments.length
            };
        }));

        // 6. Inventory Valuation
        const parts = await db.sparePart.findMany({
            include: { inventoryItems: { where: branchId ? { branchId } : {} } }
        });

        let totalInventoryValue = 0;
        parts.forEach(part => {
            const qty = part.inventoryItems.reduce((sum, item) => sum + item.quantity, 0);
            totalInventoryValue += (qty * (part.defaultCost || 0));
        });

        // 7. Trends (Last 6 Months - Ignore Filters for the shape but maybe keep branch?)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const trendPayments = await db.payment.findMany(ensureBranchWhere({
            where: {
                createdAt: { gte: sixMonthsAgo },
                branchId: branchId || undefined
            }
        }, req));

        const trendSales = await db.machineSale.findMany({
            where: {
                saleDate: { gte: sixMonthsAgo },
                branchId: branchId || undefined
            }
        });

        const trends = {};
        // Combine collections into trends
        trendPayments.forEach(p => {
            const month = p.createdAt.toLocaleString('ar-EG', { month: 'long' });
            if (!trends[month]) trends[month] = { name: month, collections: 0, sales: 0 };
            trends[month].collections += p.amount;
        });

        // Combine non-installment sales into trends
        trendSales.forEach(s => {
            const month = s.saleDate.toLocaleString('ar-EG', { month: 'long' });
            if (!trends[month]) trends[month] = { name: month, collections: 0, sales: 0 };
            trends[month].sales += s.totalPrice;
        });

        // Add non-machine payments to sales (since they are direct sales)
        trendPayments.forEach(p => {
            if (!['INSTALLMENT', 'MACHINE_SALE'].includes(p.type) && !p.reason?.includes('ظ…ط§ظƒظٹظ†ط©') && !p.reason?.includes('ظ‚ط³ط·')) {
                const month = p.createdAt.toLocaleString('ar-EG', { month: 'long' });
                trends[month].sales += p.amount;
            }
        });

        const trendData = Object.values(trends);

        res.json({
            financials: {
                totalSales: totalSalesValue,
                totalCollected,
                totalOutstanding,
                inventoryValue: totalInventoryValue,
                breakdown
            },
            branchPerformance: branchPerformance.sort((a, b) => b.revenue - a.revenue),
            trends: trendData
        });

    } catch (error) {
        console.error('Failed to generate executive report:', error);
        res.status(500).json({ error: 'Failed to generate executive report' });
    }
};

router.get('/reports/executive', authenticateToken, executiveHandler);

module.exports = router;
module.exports.executiveHandler = executiveHandler;
