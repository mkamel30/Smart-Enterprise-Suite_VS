const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const db = new PrismaClient();
const JWT_SECRET = 'your-32-character-plus-secret-here-if-known-or-dummy';
// I need to find the real JWT_SECRET or mock it in the same way the server does.
// Alternatively, I can just call the handler function directly by mocking req/res.

const { executiveHandler } = require('./routes/reports');

async function main() {
    console.log('--- API Simulation ---');

    const user = await db.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
    if (!user) {
        console.log('No SUPER_ADMIN found');
        return;
    }

    const req = {
        user: {
            id: user.id,
            role: user.role,
            branchId: user.branchId,
            permissions: ['analytics:view:executive']
        },
        query: {
            startDate: '2026-01-01',
            endDate: '2026-01-31'
        }
    };

    const res = {
        json: (data) => console.log('JSON Response:', JSON.stringify(data, null, 2)),
        status: (code) => ({ json: (data) => console.log(`STATUS ${code}:`, data) })
    };

    try {
        await executiveHandler(req, res);
    } catch (e) {
        console.error('Handler Error:', e);
    }
}

main()
    .catch(console.error)
    .finally(() => db.$disconnect());
