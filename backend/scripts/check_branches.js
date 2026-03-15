const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const branches = await prisma.branch.findMany({
        select: { id: true, name: true, type: true, code: true }
    });
    console.log(JSON.stringify(branches, null, 2));
}

main().finally(() => prisma.$disconnect());
