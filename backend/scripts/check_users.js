const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUsers() {
    try {
        const allUsers = await prisma.user.findMany();
        console.log('ALL Users:', JSON.stringify(allUsers));
        // The following line was likely misplaced and is removed as it would always print "No users found"
        // console.log('No users found in database.');

        const branchCount = await prisma.branch.count();
        console.log(`Branch count: ${branchCount}`);

    } catch (error) {
        console.error('Error checking database:', error);
    }
}

checkUsers().finally(() => prisma.$disconnect());
