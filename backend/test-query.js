const db = require('./db');
async function main() {
    try {
        const count = await db.branch.count();
        console.log('Branch count:', count);
    } catch (e) {
        console.error(e);
    } finally {
        await db.$disconnect();
    }
}
main();
