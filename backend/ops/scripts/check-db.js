const db = require('./db');

async function checkHealth() {
    try {
        const start = Date.now();
        await db.$queryRaw`SELECT 1`;
        const latency = Date.now() - start;
        console.log(`Database Health: OK (latency: ${latency}ms)`);

        const userCount = await db.user.count();
        console.log(`User Count: ${userCount}`);

        process.exit(0);
    } catch (err) {
        console.error('Database Health: ERROR');
        console.error(err);
        process.exit(1);
    }
}

checkHealth();
