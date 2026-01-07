const db = require('./db');

async function main() {
    try {
        const count = await db.user.count();
        console.log('User count in prisma/dev.db:', count);

        if (count > 0) {
            const users = await db.user.findMany({ take: 10 });
            users.forEach(u => console.log(`- ${u.email} (${u.role})`));
        } else {
            console.log('No users found. Creating default admin...');
            const hashedPassword = await require('bcryptjs').hash('123456', 10);
            const user = await db.user.create({
                data: {
                    email: 'm.kamel@egyptsmartcards.com',
                    displayName: 'M. Kamel',
                    role: 'SUPER_ADMIN',
                    password: hashedPassword,
                    uid: 'admin-123'
                }
            });
            console.log('Created default admin:', user.email);
        }
    } catch (e) {
        console.error('Failed:', e);
    } finally {
        await db.$disconnect();
    }
}

main();
