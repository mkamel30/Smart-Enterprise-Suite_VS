const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugDashboard() {
    const today = new Date();
    const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const currentMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

    // Simulate what the route does
    const dateStart = currentMonthStart;
    const dateEnd = currentMonthEnd;
    const branchFilter = {}; // Admin view

    console.log('Range:', dateStart.toISOString(), 'to', dateEnd.toISOString());

    try {
        const machineSalesBreakdown = await prisma.machineSale.groupBy({
            by: ['type'],
            where: {
                ...branchFilter,
                saleDate: { gte: dateStart, lte: dateEnd },
                status: { not: 'CANCELLED' }
            },
            _sum: { totalPrice: true },
            _count: { id: true }
        });

        console.log('Machine Sales Breakdown Raw:', JSON.stringify(machineSalesBreakdown, null, 2));

        const revenueByType = await prisma.payment.findMany({
            where: { ...branchFilter, createdAt: { gte: dateStart, lte: dateEnd } },
            select: { amount: true, type: true, reason: true }
        });

        console.log('Revenue Records Count:', revenueByType.length);

        const breakdown = {
            MAINTENANCE_LABOR: 0,
            MAINTENANCE_PARTS: 0,
            MACHINE_SALE: 0,
            INSTALLMENT: 0,
            DIRECT_PARTS: 0,
            OTHER: 0
        };

        revenueByType.forEach(p => {
            const t = p.type || '';
            const r = p.reason || '';
            if (t === 'INSTALLMENT' || r.includes('قسط') || r.includes('أقساط')) breakdown.INSTALLMENT += p.amount;
            else if (t === 'SALE' || r.includes('بيع') || r.includes('ماكينة')) breakdown.MACHINE_SALE += p.amount;
            else if (r.includes('قطع غيار')) {
                if (t === 'MAINTENANCE' || r.includes('صيانة')) breakdown.MAINTENANCE_PARTS += p.amount;
                else breakdown.DIRECT_PARTS += p.amount;
            } else if (t === 'MAINTENANCE' || r.includes('صيانة')) breakdown.MAINTENANCE_LABOR += p.amount;
            else if (t === 'SPARE_PARTS') breakdown.DIRECT_PARTS += p.amount;
            else breakdown.OTHER += p.amount;
        });

        console.log('Processed Breakdown:', breakdown);

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

debugDashboard();
