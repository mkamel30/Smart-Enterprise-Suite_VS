const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient({
    datasources: {
        db: {
            url: "file:./prisma/dev.db"
        }
    }
});

async function main() {
    try {
        const count = await db.user.count();
        console.log('User count:', count);
        if (count > 0) {
            const users = await db.user.findMany({ take: 5 });
            console.log('Users:', JSON.stringify(users.map(u => ({ email: u.email, uid: u.uid, role: u.role })), null, 2));
        }
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await db.$disconnect();
    }
}

main();
