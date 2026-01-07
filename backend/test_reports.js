// Test reports API
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

async function testReports() {
    try {
        console.log('🔐 Logging in...');
        const loginRes = await request('POST', '/api/auth/login', {}, {
            email: 'admin@csdept.com',
            password: 'admin123'
        });
        
        const token = loginRes.data.token;
        const headers = { Authorization: `Bearer ${token}` };
        console.log('✅ Login successful\n');
        
        const reports = [
            { name: 'Executive Report', path: '/api/reports/executive?startDate=2025-01-01&endDate=2026-01-01' },
            { name: 'Inventory Report', path: '/api/reports/inventory' },
            { name: 'Movements Report', path: '/api/reports/movements?startDate=2025-01-01&endDate=2026-01-01' },
            { name: 'Performance Report', path: '/api/reports/performance?startDate=2025-01-01&endDate=2026-01-01' }
        ];
        
        for (const report of reports) {
            try {
                const res = await request('GET', report.path, headers);
                if (res.status === 200) {
                    console.log(`✅ ${report.name}`);
                } else {
                    console.log(`❌ ${report.name} - Status ${res.status}`);
                    console.log(`   Error: ${JSON.stringify(res.data).substring(0, 200)}`);
                }
            } catch (err) {
                console.log(`❌ ${report.name} - ${err.message}`);
            }
        }
        
    } catch (error) {
        console.error('Fatal error:', error);
    }
}

testReports();
