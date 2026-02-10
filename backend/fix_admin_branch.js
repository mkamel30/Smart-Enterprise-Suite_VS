const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function manageBranches() {
    try {
        console.log('🔍 Checking branches in database...\n');
        const branches = await prisma.branch.findMany();
        console.log(JSON.stringify(branches, null, 2));

        // Look for IT branch
        let itBranch = branches.find(b => b.name.includes('IT') || b.code === 'IT001');

        if (!itBranch) {
            console.log('\n✨ Creating IT Department branch...');
            itBranch = await prisma.branch.create({
                data: {
                    code: 'IT001',
                    name: 'إدارة نظم المعلومات (IT)',
                    type: 'CENTRAL',
                    isActive: true,
                    address: 'Main Office - IT Dept'
                }
            });
            console.log('✅ IT Branch created:', itBranch.name);
        } else {
            console.log('\n✅ IT Branch already exists:', itBranch.name);
        }

        // Update the admin user
        const adminEmail = 'admin@csdept.com';
        const user = await prisma.user.findFirst({ where: { email: adminEmail } });

        if (user) {
            await prisma.user.update({
                where: { id: user.id },
                data: { branchId: itBranch.id }
            });
            console.log(`\n🚀 User ${adminEmail} moved to branch: ${itBranch.name}`);
        } else {
            console.log(`\n⚠️ User ${adminEmail} not found.`);
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

manageBranches();
