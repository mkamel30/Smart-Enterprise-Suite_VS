const axios = require('axios');

async function triggerErrors() {
    try {
        console.log('Logging in...');
        const loginResp = await axios.post('http://localhost:5000/api/auth/login', {
            email: 'm.kamel@egyptsmartcards.com',
            password: '123456'
        });
        const token = loginResp.data.token;
        console.log('Token acquired.');

        console.log('Calling /api/dashboard...');
        try {
            const dashboardResp = await axios.get('http://localhost:5000/api/dashboard', {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log('Dashboard Success:', dashboardResp.status);
        } catch (e) {
            console.error('Dashboard Failed:', e.response?.status, e.response?.data);
        }

        console.log('Calling /api/transfer-orders/pending...');
        try {
            const transferResp = await axios.get('http://localhost:5000/api/transfer-orders/pending', {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log('Transfer Success:', transferResp.status);
        } catch (e) {
            console.error('Transfer Failed:', e.response?.status, e.response?.data);
        }

    } catch (e) {
        console.error('Login Failed:', e.response?.status, e.response?.data || e.message);
    }
}

triggerErrors();
