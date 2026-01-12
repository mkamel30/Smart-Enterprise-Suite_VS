const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function testSearchQuery() {
    try {
        console.log('🧪 Testing Customer Search Logic...\n');

        const branchId = 'cmk4hun7o0005zi19fc6wwlga'; // القاهرة-الجيش

        // Simulate the exact query from the /lite endpoint WITH search
        console.log('Test 1: Searching for "010001" (with search parameter)');
        const searchTerm = '010001';
        const where1 = {
            branchId: branchId,
            OR: [
                { client_name: { contains: searchTerm } },
                { bkcode: { contains: searchTerm } }
            ]
        };

        const results1 = await db.customer.findMany({
            where: where1,
            select: {
                id: true,
                client_name: true,
                bkcode: true
            },
            orderBy: { client_name: 'asc' }
            // NO LIMIT when searching!
        });

        console.log(`✅ Found ${results1.length} results:`);
        results1.forEach((c, i) => {
            console.log(`  ${i + 1}. ${c.bkcode} - ${c.client_name}`);
        });

        // Simulate the exact query from the /lite endpoint WITHOUT search
        console.log('\n\nTest 2: No search (should return 50)');
        const where2 = {
            branchId: branchId
        };

        const results2 = await db.customer.findMany({
            where: where2,
            select: {
                id: true,
                client_name: true,
                bkcode: true
            },
            take: 50,
            orderBy: { client_name: 'asc' }
        });

        console.log(`✅ Found ${results2.length} results (limited to 50)`);
        console.log('First 5:');
        results2.slice(0, 5).forEach((c, i) => {
            console.log(`  ${i + 1}. ${c.bkcode} - ${c.client_name}`);
        });

        // Check if 010001 is in the first 50
        const customer010001InFirst50 = results2.find(c => c.bkcode === '010001');
        console.log(`\n010001 in first 50? ${customer010001InFirst50 ? '✅ YES' : '❌ NO'}`);

        // Test with partial search
        console.log('\n\nTest 3: Searching for "01000" (partial)');
        const searchTerm3 = '01000';
        const where3 = {
            branchId: branchId,
            OR: [
                { client_name: { contains: searchTerm3 } },
                { bkcode: { contains: searchTerm3 } }
            ]
        };

        const results3 = await db.customer.findMany({
            where: where3,
            select: {
                id: true,
                client_name: true,
                bkcode: true
            },
            orderBy: { client_name: 'asc' }
        });

        console.log(`✅ Found ${results3.length} results:`);
        results3.forEach((c, i) => {
            console.log(`  ${i + 1}. ${c.bkcode} - ${c.client_name}`);
        });

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await db.$disconnect();
    }
}

testSearchQuery();
