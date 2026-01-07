const db = require('./db');
const transferService = require('./services/transferService');

async function testPending() {
    const user = {
        role: 'SUPER_ADMIN',
        branchId: null
    };

    try {
        console.log('Testing transferService.getPendingOrders...');
        const orders = await transferService.getPendingOrders({ branchId: null }, user);
        console.log('Success:', orders.length, 'orders');
    } catch (e) {
        console.error('Failed:', e.message);
    } finally {
        await db.$disconnect();
    }
}

testPending();
