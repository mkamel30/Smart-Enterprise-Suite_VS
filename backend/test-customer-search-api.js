const axios = require('axios');

async function testCustomerSearch() {
    const baseURL = 'http://localhost:5000/api';

    // You'll need a valid auth token - get it from your browser's localStorage or cookies
    const token = 'YOUR_AUTH_TOKEN_HERE'; // Replace this with actual token

    console.log('🧪 Testing Customer Search API...\n');

    try {
        // Test 1: Search without parameter (should return 50)
        console.log('Test 1: GET /customers/lite (no search)');
        const response1 = await axios.get(`${baseURL}/customers/lite`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log(`✅ Results: ${response1.data.length} customers`);
        console.log(`First customer: ${response1.data[0]?.bkcode} - ${response1.data[0]?.client_name}\n`);

        // Test 2: Search with "010001"
        console.log('Test 2: GET /customers/lite?search=010001');
        const response2 = await axios.get(`${baseURL}/customers/lite?search=010001`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log(`✅ Results: ${response2.data.length} customers`);
        response2.data.forEach((c, i) => {
            console.log(`  ${i + 1}. ${c.bkcode} - ${c.client_name}`);
        });
        console.log('');

        // Test 3: Search with "01000"
        console.log('Test 3: GET /customers/lite?search=01000');
        const response3 = await axios.get(`${baseURL}/customers/lite?search=01000`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log(`✅ Results: ${response3.data.length} customers`);
        response3.data.slice(0, 5).forEach((c, i) => {
            console.log(`  ${i + 1}. ${c.bkcode} - ${c.client_name}`);
        });
        if (response3.data.length > 5) {
            console.log(`  ... and ${response3.data.length - 5} more`);
        }

    } catch (error) {
        if (error.response) {
            console.error(`❌ Error ${error.response.status}: ${error.response.data?.error || error.message}`);
            if (error.response.status === 401) {
                console.log('\n⚠️  You need to update the token in the script!');
                console.log('Steps:');
                console.log('1. Open your browser');
                console.log('2. Login to the app');
                console.log('3. Open DevTools (F12)');
                console.log('4. Go to Application/Storage tab');
                console.log('5. Find and copy the auth token');
                console.log('6. Update line 6 in this script\n');
            }
        } else {
            console.error(`❌ Error: ${error.message}`);
        }
    }
}

testCustomerSearch();
