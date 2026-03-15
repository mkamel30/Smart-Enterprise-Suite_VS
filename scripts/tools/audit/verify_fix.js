const db = require('./backend/db');

async function check() {
    try {
        console.log('Checking RefreshToken model...');
        // Try to access the model property
        if (db.refreshToken) {
            console.log('RefreshToken model exists on db client.');
            // Try a simple count to ensure DB connection works
            const count = await db.refreshToken.count();
            console.log(`RefreshToken count: ${count}`);
            await db.$disconnect();
            process.exit(0);
        } else {
            console.error('RefreshToken model is MISSING on db client. Please run "npx prisma generate" in backend folder.');
            await db.$disconnect();
            process.exit(1);
        }
    } catch (e) {
        console.error('Error during check:', e);
        await db.$disconnect();
        process.exit(1);
    }
}

check();
