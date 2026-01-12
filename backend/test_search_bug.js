const db = require('./db');

async function testSearch() {
    const userId = 'cmk4hun7o0005zi19fc6wwlga'; // Branch ID for Ahmed Al-Fakhrani
    const userRole = 'CS_SUPERVISOR';
    const searchTerm = '010001';

    console.log(`Testing search for term: "${searchTerm}" as role: ${userRole} in branch: ${userId}\n`);

    // Simulated getBranchFilter
    const where = { branchId: userId };

    // Simulated /lite addition
    where.OR = [
        { client_name: { contains: searchTerm } },
        { bkcode: { contains: searchTerm } }
    ];

    console.log('Query "where" clause:', JSON.stringify(where, null, 2));

    try {
        const results = await db.customer.findMany({
            where,
            select: { id: true, client_name: true, bkcode: true, branchId: true }
        });
        console.log(`\nFound ${results.length} results:`);
        console.log(JSON.stringify(results, null, 2));

        // Try without branch filter
        const globalResults = await db.customer.findMany({
            where: {
                OR: [
                    { client_name: { contains: searchTerm } },
                    { bkcode: { contains: searchTerm } }
                ]
            },
            select: { id: true, client_name: true, bkcode: true, branchId: true }
        });
        console.log(`\nGlobal results (no branch filter): ${globalResults.length}`);
        if (globalResults.length > 0) {
            console.log('Global results sample branch:', globalResults[0].branchId);
        }

    } catch (error) {
        console.error('Query Error:', error.message);
    }

    process.exit(0);
}

testSearch();
