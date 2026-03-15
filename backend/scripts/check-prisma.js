const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- MaintenanceApprovalRequest Model Fields ---');
    // @ts-ignore - accessing internal dmmf for debugging
    const model = prisma._dmmf.modelMap.MaintenanceApprovalRequest;
    if (!model) {
        console.log('Model not found!');
    } else {
        model.fields.forEach(f => {
            console.log(`- ${f.name} (${f.kind}): ${f.type}`);
        });
    }
    await prisma.$disconnect();
}

main().catch(console.error);
