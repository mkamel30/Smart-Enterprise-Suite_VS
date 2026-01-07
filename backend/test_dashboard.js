// Test dashboard API specifically
const http = require('http');

function request(method, path, headers = {}, body = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 5000,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };
        
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve({ status: res.statusCode, data: parsed, headers: res.headers });
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

async function test() {
    try {
        // Login
        const loginRes = await request('POST', '/api/auth/login', {}, {
            email: 'admin@csdept.com',
            password: 'admin123'
        });
        
        const token = loginRes.data.token;
        const headers = { Authorization: `Bearer ${token}` };
        
        // Test dashboard
        const dashRes = await request('GET', '/api/dashboard/admin-summary', headers);
        console.log('Dashboard Response:');
        console.log('Status:', dashRes.status);
        console.log('Data:', JSON.stringify(dashRes.data, null, 2));
        
    } catch (error) {
        console.error('Error:', error);
    }
}

test();
