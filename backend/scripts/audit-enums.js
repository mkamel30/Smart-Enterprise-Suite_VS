const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const models = [
        'user',
        'branch',
        'maintenanceRequest',
        'transferOrder',
        'branchDebt',
        'warehouseMachine',
        'serviceAssignment',
        'maintenanceApprovalRequest'
    ];

    for (const model of models) {
        console.log(`--- ${model} ---`);
        try {
            const results = await prisma[model].groupBy({
                by: ['status'],
                _count: { _all: true }
            });
            console.log(JSON.stringify(results, null, 2));
        } catch (e) {
            // Some models might not have 'status', try 'role' or 'type'
            try {
                const field = model === 'user' ? 'role' : (model === 'branch' ? 'type' : 'type');
                const results = await prisma[model].groupBy({
                    by: [field],
                    _count: { _all: true }
                });
                console.log(JSON.stringify(results, null, 2));
            } catch (inner) {
                console.log(`Field not found for ${model}`);
            }
        }
    }
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
