// Test APIs with detailed error logging
const https = require('https');
const http = require('http');

const BASE_URL = 'http://localhost:5000';

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
                    if (res.statusCode >= 400) {
                        reject({ status: res.statusCode, data: parsed });
                    } else {
                        resolve({ status: res.statusCode, data: parsed });
                    }
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

async function testAPIs() {
    try {
        console.log('ًں”گ Logging in...');
        const loginRes = await request('POST', '/api/auth/login', {}, {
            email: 'admin@csdept.com',
            password: 'admin123'
        });
        
        const token = loginRes.data.token;
        console.log('âœ… Login successful');
        console.log('User:', loginRes.data.user.displayName);
        
        const headers = { Authorization: `Bearer ${token}` };
        
        // Test 1: Dashboard admin summary
        console.log('\nًں“ٹ Testing /api/dashboard/admin-summary...');
        try {
            const dashRes = await request('GET', '/api/dashboard/admin-summary', headers);
            console.log('âœ… Dashboard OK');
            console.log('Data:', JSON.stringify(dashRes.data, null, 2));
        } catch (err) {
            console.log('â‌Œ Dashboard ERROR:');
            console.log('Status:', err.status);
            console.log('Error:', JSON.stringify(err.data, null, 2));
        }
        
        // Test 2: Transfer orders pending
        console.log('\nًں“¦ Testing /api/transfer-orders/pending...');
        try {
            const transferRes = await request('GET', '/api/transfer-orders/pending', headers);
            console.log('âœ… Transfer Orders OK');
            console.log('Count:', transferRes.data.length);
        } catch (err) {
            console.log('â‌Œ Transfer Orders ERROR:');
            console.log('Status:', err.status);
            console.log('Error:', JSON.stringify(err.data, null, 2));
        }
        
        // Test 3: Maintenance shipments
        console.log('\nًںڑڑ Testing /api/maintenance/shipments...');
        try {
            const shipRes = await request('GET', '/api/maintenance/shipments', headers);
            console.log('âœ… Shipments OK');
            console.log('Count:', shipRes.data.length);
        } catch (err) {
            console.log('â‌Œ Shipments ERROR:');
            console.log('Status:', err.status);
            console.log('Error:', JSON.stringify(err.data, null, 2));
        }
        
    } catch (error) {
        console.log('â‌Œ FATAL ERROR:');
        console.log(error);
    }
}

testAPIs();
