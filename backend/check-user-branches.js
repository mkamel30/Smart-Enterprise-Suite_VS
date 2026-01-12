const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function checkUserBranch() {
    try {
        console.log('👤 فحص المستخدمين والفروع...\n');

        // Get all users with their branches
        const users = await db.user.findMany({
            select: {
                id: true,
                name: true,
                displayName: true,
                email: true,
                role: true,
                branchId: true,
                branch: {
                    select: {
                        id: true,
                        name: true,
                        code: true
                    }
                }
            }
        });

        console.log(`📊 عدد المستخدمين: ${users.length}\n`);

        users.forEach((user, index) => {
            console.log(`${index + 1}. ${user.displayName || user.name}:`);
            console.log(`   - البريد: ${user.email}`);
            console.log(`   - الدور: ${user.role}`);
            console.log(`   - الفرع ID: ${user.branchId || 'غير محدد'}`);
            console.log(`   - اسم الفرع: ${user.branch?.name || 'غير محدد'}`);
            console.log('');
        });

        // Check branches
        const branches = await db.branch.findMany({
            select: {
                id: true,
                name: true,
                code: true,
                isActive: true
            }
        });

        console.log(`\n🏢 الفروع الموجودة (${branches.length}):\n`);
        branches.forEach((branch, index) => {
            console.log(`${index + 1}. ${branch.name}:`);
            console.log(`   - الكود: ${branch.code}`);
            console.log(`   - ID: ${branch.id}`);
            console.log(`   - نشط: ${branch.isActive ? 'نعم' : 'لا'}`);
            console.log('');
        });

    } catch (error) {
        console.error('❌ خطأ:', error);
    } finally {
        await db.$disconnect();
    }
}

checkUserBranch();
