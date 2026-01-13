
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { attachBranchEnforcer } = require('./prisma/branchEnforcer');

attachBranchEnforcer(prisma);

async function testTechMetrics() {
    try {
        console.log("Starting Tech Metrics Debug...");

        const targetBranchId = null;
        const rangeStart = new Date('2024-01-01');
        const rangeEnd = new Date('2025-12-31');
        const dateCondition = { createdAt: { gte: rangeStart, lte: rangeEnd } };

        const centerCondition = targetBranchId ? { centerBranchId: targetBranchId } : {};

        console.log("Running groupBy on ServiceAssignment...");
        console.log("Where conditions:", { ...centerCondition, ...dateCondition });

        const result = await prisma.serviceAssignment.groupBy({
            by: ['status'],
            where: { ...centerCondition, ...dateCondition },
            _count: { id: true }
        });

        console.log("✅ Success:", result);

    } catch (error) {
        console.error("❌ ERROR FULL OBJ:");
        console.log(JSON.stringify(error, null, 2));
        console.error("❌ ERROR MESSAGE:", error.message);
    } finally {
        await prisma.$disconnect();
    }
}

testTechMetrics();
