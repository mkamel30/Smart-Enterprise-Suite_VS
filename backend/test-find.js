const db = require('./db');
async function main() {
    const identifier = 'm.kamel@egyptsmartcards.com';
    const user = await db.user.findFirst({ where: { OR: [{ email: identifier }, { uid: identifier }] }, include: { branch: true } });
    console.log('User found:', JSON.stringify(user, null, 2));
    await db.$disconnect();
}
main();
