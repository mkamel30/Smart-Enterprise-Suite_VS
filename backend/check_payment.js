const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function main() {
    const payments = await db.payment.findMany({
        take: 3,
        orderBy: { createdAt: 'desc' },
        include: {
            customer: {
                select: {
                    client_name: true,
                    bkcode: true
                }
            }
        }
    });

    payments.forEach(p => {
        console.log('---');
        console.log('Payment ID:', p.id);
        console.log('Customer ID:', p.customerId);
        console.log('Customer Name (saved):', p.customerName);
        console.log('Customer Object:', p.customer);
    });
}

main().finally(() => db.$disconnect());
