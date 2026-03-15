const axios = require('axios');

async function test() {
    try {
        // We can't easily get a token here, but we can call the service function directly
        const dashboardService = require('./services/dashboardService');
        const summary = await dashboardService.getAdminAffairsSummary();
        console.log('--- DASHBOARD SUMMARY ---');
        console.log(JSON.stringify(summary, null, 2));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

test();
