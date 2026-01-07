// Comprehensive API test
const http = require('http');

function request(method, path, headers = {}, body = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 5000,
            path: path,
            method: method,
            headers: { 'Content-Type': 'application/json', ...headers }
        };
        
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve({ status: res.statusCode, data: parsed });
                } catch (e) {
                    resolve({ status: res.statusCode, data: data });
                }
            });
        });
        
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function testAllAPIs() {
    try {
        console.log('ًں”گ Logging in...');
        const loginRes = await request('POST', '/api/auth/login', {}, {
            email: 'admin@csdept.com',
            password: 'admin123'
        });
        
        if (loginRes.status !== 200) {
            console.log('â‌Œ Login failed:', loginRes.data);
            return;
        }
        
        const token = loginRes.data.token;
        const headers = { Authorization: `Bearer ${token}` };
        console.log('âœ… Login successful\n');
        
        const tests = [
            { name: 'Dashboard Admin Summary', path: '/api/dashboard/admin-summary' },
            { name: 'Dashboard Main', path: '/api/dashboard' },
            { name: 'Branches List', path: '/api/branches' },
            { name: 'Branches Active', path: '/api/branches/active' },
            { name: 'Customers List', path: '/api/customers' },
            { name: 'Transfer Orders', path: '/api/transfer-orders' },
            { name: 'Transfer Orders Pending', path: '/api/transfer-orders/pending' },
            { name: 'Maintenance Shipments', path: '/api/maintenance/shipments' },
            { name: 'Inventory', path: '/api/inventory' },
            { name: 'Payments', path: '/api/payments' },
            { name: 'Notifications', path: '/api/notifications' }
        ];
        
        let passed = 0;
        let failed = 0;
        
        for (const test of tests) {
            try {
                const res = await request('GET', test.path, headers);
                if (res.status === 200) {
                    console.log(`âœ… ${test.name}`);
                    passed++;
                } else {
                    console.log(`â‌Œ ${test.name} - Status ${res.status}`);
                    console.log(`   Error: ${JSON.stringify(res.data)}`);
                    failed++;
                }
            } catch (err) {
                console.log(`â‌Œ ${test.name} - ${err.message}`);
                failed++;
            }
        }
        
        console.log(`\n${'='.repeat(60)}`);
        console.log(`ًں“ٹ Results: ${passed} passed, ${failed} failed`);
        console.log('='.repeat(60));
        
    } catch (error) {
        console.error('Fatal error:', error);
    }
}

testAllAPIs();
