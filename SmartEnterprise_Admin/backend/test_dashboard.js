const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testStats() {
    try {
        console.log('Testing Dashboard Queries...');
        // The query that was failing:
        const branches = await prisma.branch.findMany({
            include: {
                _count: {
                    select: { backups: true }
                }
            }
        });
        console.log(`Success! Found ${branches.length} branches with backup counts.`);
        
        const adminUsers = await prisma.adminUser.count();
        console.log(`Admin Users table exists! Count: ${adminUsers}`);
        
    } catch (error) {
        console.error('Test Failed:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

testStats();
