const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUsers() {
    const users = await prisma.user.findMany();
    console.log(`\nًں“ٹ Users in Database: ${users.length}\n`);
    users.forEach(user => {
        console.log(`- ${user.email || 'no email'}`);
        console.log(`  Role: ${user.role}`);
        console.log(`  Name: ${user.displayName}`);
        console.log(`  Has Password: ${user.password ? 'Yes' : 'No'}`);
        console.log(`  Branch: ${user.branchId || 'None'}\n`);
    });
}

checkUsers().finally(() => prisma.$disconnect());
