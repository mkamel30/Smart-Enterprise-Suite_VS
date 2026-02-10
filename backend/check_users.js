const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUsers() {
    try {
        console.log('🔍 Checking users in database...\n');
        const users = await prisma.user.findMany({
            select: {
                email: true,
                displayName: true,
                role: true,
                isActive: true
            }
        });

        if (users.length === 0) {
            console.log('⚠️ No users found in database.');
        } else {
            console.log(JSON.stringify(users, null, 2));
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

checkUsers();
