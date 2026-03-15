/* eslint-disable no-console */
const path = require('path');
const envPath = path.resolve(__dirname, '../.env');
console.log('Loading .env from:', envPath);
require('dotenv').config({ path: envPath });
const request = require('supertest');
const jwt = require('jsonwebtoken');

const API_URL = process.env.API_URL || 'http://localhost:5002';
const JWT_SECRET = process.env.JWT_SECRET;
const MAX_TIME_MS = 10000;

if (!JWT_SECRET) {
    console.error('❌ JWT_SECRET not found in environment');
    process.exit(1);
}

// Generate Super Admin Token
const adminToken = jwt.sign(
    {
        id: 'test-admin-script',
        displayName: 'Test Admin',
        role: 'SUPER_ADMIN',
        email: 'test@admin.com',
        branchId: null,
        permissions: ['ALL'],
        authorizedBranchIds: [] // Added for robustness
    },
    JWT_SECRET,
    { expiresIn: '1h' }
);

// State for dynamic IDs
const context = {
    branchId: null,
    customerId: null,
    technicianId: null,
    requestId: null,
    machineId: null,
    simId: null,
    machineSerial: null,
    userId: null
};

// Helper: Run a single test
async function runCheck(name, method, url, validationFn = null) {
    if (!url) {
        console.log(`⚠️  Skipping ${name} (Missing required ID for URL)`);
        return 'SKIPPED';
    }

    try {
        process.stdout.write(`Testing ${name} (${url})... `);
        const start = Date.now();
        const res = await request(API_URL)
        [method](url)
            .set('Authorization', `Bearer ${adminToken}`)
            .timeout(MAX_TIME_MS);

        if (res.status >= 400) {
            console.log(`❌ FAILED (Status: ${res.status})`);
            if (res.status === 500 || res.status === 404) {
                console.log('Error Body:', JSON.stringify(res.body, null, 2));
            }
            return 'FAILED';
        }

        if (validationFn) {
            try {
                validationFn(res.body);
            } catch (e) {
                console.log(`❌ FAILED (Validation: ${e.message})`);
                return 'FAILED';
            }
        }

        const time = Date.now() - start;
        console.log(`✅ PASSED (${time}ms)`);
        return 'PASSED';
    } catch (error) {
        console.log(`❌ ERROR: ${error.message}`);
        return 'ERROR';
    }
}

async function runTests() {
    console.log(`🚀 Starting Comprehensive API Integrity Tests against ${API_URL}`);

    // --- 1. PREREQUISITES (Fetch IDs) ---
    console.log('\n--- Phase 1: Fetching Dynamic IDs ---');

    // Get a Branch ID
    await runCheck('Fetch Branches', 'get', '/api/branches', (body) => {
        if (body.data && body.data.length > 0) {
            context.branchId = body.data[0].id;
        } else if (Array.isArray(body) && body.length > 0) { // Handle array response
            context.branchId = body[0].id;
        }
    });

    // Get a User ID
    await runCheck('Fetch Users', 'get', '/api/users', (body) => {
        if (body.data && body.data.length > 0) {
            context.userId = body.data[0].id;
        }
    });

    // Get a Customer ID
    await runCheck('Fetch Customers', 'get', '/api/customers', (body) => {
        if (body.data && body.data.length > 0) {
            context.customerId = body.data[0].id;
        }
    });

    // Get a Technician ID
    await runCheck('Fetch Technicians', 'get', '/api/technicians', (body) => {
        if (Array.isArray(body) && body.length > 0) {
            context.technicianId = body[0].id;
        }
    });

    // Get a Warehouse Machine
    await runCheck('Fetch Warehouse Machines', 'get', '/api/warehouse-machines', (body) => {
        if (body.data && body.data.length > 0) {
            context.machineId = body.data[0].id;
            context.machineSerial = body.data[0].serialNumber;
        }
    });

    // Get a Warehouse SIM
    await runCheck('Fetch Warehouse SIMs', 'get', '/api/warehouse-sims', (body) => {
        if (body.data && body.data.length > 0) {
            context.simId = body.data[0].id;
        }
    });

    // Get a Maintenance Request
    await runCheck('Fetch Maintenance Requests', 'get', '/api/requests', (body) => {
        if (body.data && body.data.length > 0) {
            context.requestId = body.data[0].id;
        }
    });

    console.log('Context Loaded:', JSON.stringify(context, null, 2));

    // --- 2. MAIN TESTS ---
    console.log('\n--- Phase 2: Testing All Endpoints ---');

    const tests = [
        // --- Core ---
        { name: 'Users List', url: '/api/users', method: 'get' },
        { name: 'User Details', url: context.userId ? `/api/users/${context.userId}` : null, method: 'get' },
        { name: 'Customers List', url: '/api/customers', method: 'get' },
        { name: 'Customer Details', url: context.customerId ? `/api/customers/${context.customerId}` : null, method: 'get' },
        { name: 'Branches List', url: '/api/branches', method: 'get' },
        { name: 'Active Branches', url: '/api/branches/active', method: 'get' },
        { name: 'Technicians List', url: '/api/technicians', method: 'get' },

        // --- Dashboards ---
        { name: 'Main Dashboard', url: '/api/dashboard', method: 'get' },
        { name: 'Executive Dashboard', url: '/api/executive-dashboard', method: 'get' },
        { name: 'Admin Summary', url: '/api/dashboard/admin-summary', method: 'get' },
        { name: 'Dashboard Search (Empty)', url: '/api/dashboard/search?q=test', method: 'get' },

        // --- Financials ---
        { name: 'Payments List', url: '/api/payments', method: 'get' },
        { name: 'Pending Payments', url: '/api/pending-payments', method: 'get' },
        { name: 'Pending Payments Summary', url: '/api/pending-payments/summary', method: 'get' },

        // --- Admin ---
        { name: 'Audit Logs', url: '/api/audit-logs', method: 'get' },
        { name: 'System Settings', url: '/api/admin/settings', method: 'get' }, // FIXED
        { name: 'System Status', url: '/api/admin/system/status', method: 'get' },
        { name: 'Recent Logs', url: '/api/admin/system/logs/recent', method: 'get' }, // FIXED

        // --- Reports ---
        { name: 'Financial Executive Report', url: '/api/reports/executive', method: 'get' }, // FIXED
        { name: 'Daily Sales Report', url: '/api/reports/pos-sales-daily', method: 'get' }, // FIXED
        { name: 'Inventory Report', url: '/api/reports/inventory', method: 'get' }, // FIXED
        { name: 'Performance Report', url: '/api/reports/performance', method: 'get' },

        // --- Warehouse ---
        { name: 'Warehouse Machines', url: '/api/warehouse-machines', method: 'get' },
        { name: 'Warehouse Machines Counts', url: '/api/warehouse-machines/counts', method: 'get' },
        { name: 'Warehouse SIMs', url: '/api/warehouse-sims', method: 'get' },
        { name: 'Warehouse SIMs Counts', url: '/api/warehouse-sims/counts', method: 'get' },

        // --- Maintenance ---
        { name: 'Maintenance Requests', url: '/api/requests', method: 'get' },
        { name: 'Request Stats', url: '/api/requests/stats', method: 'get' },
        { name: 'Request Details', url: context.requestId ? `/api/requests/${context.requestId}` : null, method: 'get' },
        { name: 'Workflow Kanban', url: '/api/machine-workflow/kanban', method: 'get' },

        // --- Maintenance Center ---
        { name: 'Center Dashboard', url: '/api/maintenance-center/dashboard', method: 'get' },
        { name: 'Center Machines', url: '/api/maintenance-center/machines', method: 'get' },
        { name: 'Center Approvals', url: '/api/maintenance-center/pending-approvals', method: 'get' }, // FIXED

        // --- Utils & Notifications ---
        { name: 'Notifications', url: '/api/notifications', method: 'get' },
        { name: 'Notification Count', url: '/api/notifications/count', method: 'get' },
        { name: 'Backup List', url: '/api/backup/list', method: 'get' }, // FIXED
        { name: 'DB Health', url: '/api/db-health/health', method: 'get' }, // FIXED
        { name: 'DB Stats', url: '/api/db-health/stats', method: 'get' } // FIXED
    ];

    let passed = 0;
    let failed = 0;
    let skipped = 0;

    for (const test of tests) {
        const result = await runCheck(test.name, test.method, test.url);
        if (result === 'PASSED') passed++;
        else if (result === 'FAILED' || result === 'ERROR') failed++;
        else skipped++;
    }

    console.log('\n==========================================');
    console.log(`Test Summary: ${passed} Passed, ${failed} Failed, ${skipped} Skipped`);
    console.log('==========================================\n');

    if (failed > 0) process.exit(1);
}

runTests();
