// Test specific failing endpoints
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

async function test() {
    const loginRes = await request('POST', '/api/auth/login', {}, {
        email: 'admin@csdept.com',
        password: 'admin123'
    });
    
    const token = loginRes.data.token;
    const headers = { Authorization: `Bearer ${token}` };
    
    console.log('Testing Dashboard Main...\n');
    const dash = await request('GET', '/api/dashboard', headers);
    console.log('Status:', dash.status);
    console.log('Response:', JSON.stringify(dash.data, null, 2));
    
    console.log('\n\nTesting Inventory...\n');
    const inv = await request('GET', '/api/inventory', headers);
    console.log('Status:', inv.status);
    console.log('Response:', JSON.stringify(inv.data, null, 2));
}

test();
