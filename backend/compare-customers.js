const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function compareCustomers() {
    try {
        console.log('🔍 مقارنة العملاء...\n');

        const customer010001 = await db.customer.findFirst({
            where: { bkcode: '010001' },
            include: {
                branch: {
                    select: { id: true, name: true }
                }
            }
        });

        const customer010364 = await db.customer.findFirst({
            where: { bkcode: '010364' },
            include: {
                branch: {
                    select: { id: true, name: true }
                }
            }
        });

        console.log('📊 العميل 010001:');
        if (customer010001) {
            console.log(JSON.stringify(customer010001, null, 2));
        } else {
            console.log('❌ غير موجود!');
        }

        console.log('\n📊 العميل 010364:');
        if (customer010364) {
            console.log(JSON.stringify(customer010364, null, 2));
        } else {
            console.log('❌ غير موجود!');
        }

        // Test the search query
        console.log('\n\n🔍 اختبار البحث بـ "010001":');
        const searchResults = await db.customer.findMany({
            where: {
                OR: [
                    { client_name: { contains: '010001' } },
                    { bkcode: { contains: '010001' } }
                ]
            },
            select: {
                bkcode: true,
                client_name: true,
                branchId: true
            },
            take: 10
        });

        console.log(`عدد النتائج: ${searchResults.length}`);
        searchResults.forEach((c, i) => {
            console.log(`${i + 1}. ${c.bkcode} - ${c.client_name} (فرع: ${c.branchId})`);
        });

        // Test contains with "01000"
        console.log('\n\n🔍 اختبار البحث بـ "01000":');
        const searchResults2 = await db.customer.findMany({
            where: {
                OR: [
                    { client_name: { contains: '01000' } },
                    { bkcode: { contains: '01000' } }
                ]
            },
            select: {
                bkcode: true,
                client_name: true,
                branchId: true
            },
            take: 10
        });

        console.log(`عدد النتائج: ${searchResults2.length}`);
        searchResults2.forEach((c, i) => {
            console.log(`${i + 1}. ${c.bkcode} - ${c.client_name} (فرع: ${c.branchId})`);
        });

    } catch (error) {
        console.error('❌ خطأ:', error);
    } finally {
        await db.$disconnect();
    }
}

compareCustomers();
