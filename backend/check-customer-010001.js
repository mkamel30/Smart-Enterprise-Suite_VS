const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function checkCustomer() {
    try {
        console.log('🔍 البحث عن العميل 010001...\n');

        // البحث بدون فلتر branchId
        const allCustomers = await db.customer.findMany({
            where: {
                bkcode: {
                    contains: '010001'
                }
            },
            include: {
                branch: {
                    select: { id: true, name: true }
                }
            }
        });

        console.log(`📊 عدد النتائج: ${allCustomers.length}\n`);

        if (allCustomers.length > 0) {
            console.log('✅ العملاء الموجودين:');
            allCustomers.forEach((customer, index) => {
                console.log(`\n${index + 1}. العميل:`);
                console.log(`   - الكود: ${customer.bkcode}`);
                console.log(`   - الاسم: ${customer.client_name}`);
                console.log(`   - الفرع ID: ${customer.branchId}`);
                console.log(`   - اسم الفرع: ${customer.branch?.name || 'غير محدد'}`);
            });
        } else {
            console.log('❌ لم يتم العثور على عملاء بهذا الكود');
        }

        // البحث بـ exact match
        const exactMatch = await db.customer.findMany({
            where: {
                bkcode: '010001'
            },
            include: {
                branch: {
                    select: { id: true, name: true }
                }
            }
        });

        console.log(`\n\n🎯 بحث دقيق (Exact Match): ${exactMatch.length} نتيجة`);
        if (exactMatch.length > 0) {
            exactMatch.forEach((customer, index) => {
                console.log(`\n${index + 1}. العميل:`);
                console.log(`   - الكود: ${customer.bkcode}`);
                console.log(`   - الاسم: ${customer.client_name}`);
                console.log(`   - الفرع ID: ${customer.branchId}`);
                console.log(`   - اسم الفرع: ${customer.branch?.name || 'غير محدد'}`);
            });
        }

        // احصائيات عامة
        const totalCustomers = await db.customer.count();
        const branchBreakdown = await db.customer.groupBy({
            by: ['branchId'],
            _count: true
        });

        console.log('\n\n📈 إحصائيات عامة:');
        console.log(`   - إجمالي العملاء: ${totalCustomers}`);
        console.log(`   - توزيع الفروع:`);
        branchBreakdown.forEach(b => {
            console.log(`     * ${b.branchId}: ${b._count} عميل`);
        });

    } catch (error) {
        console.error('❌ خطأ:', error);
    } finally {
        await db.$disconnect();
    }
}

checkCustomer();
