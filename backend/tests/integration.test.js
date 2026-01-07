const request = require('supertest');

// MOCK AUTH MIDDLEWARE BEFORE IMPORTING APP
// This allows us to test protected routes without a real valid JWT
jest.mock('../middleware/auth', () => ({
    authenticateToken: (req, res, next) => {
        req.user = {
            id: 'test-admin-id',
            role: 'SUPER_ADMIN',
            branchId: null, // super admin usually has null
            displayName: 'Test Admin'
        };
        next();
    },
    requireManager: (req, res, next) => next(),
    requireAdmin: (req, res, next) => next(),
    requireSuperAdmin: (req, res, next) => next()
}));

// Now import app
const { app } = require('../server');

describe('Backend Integration API', () => {

    // 1. Health Check
    test('GET /health returns 200', async () => {
        const res = await request(app).get('/health');
        expect(res.statusCode).toBe(200);
        expect(res.body.status).toBe('ok');
    });

    // 2. Protected Route: Dashboard
    test('GET /api/dashboard returns structured data', async () => {
        const res = await request(app).get('/api/dashboard');

        // Detailed error logging if it fails
        if (res.statusCode !== 200) {
            console.error('Dashboard Error:', res.body);
        }

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('revenue'); // Check structure
        expect(res.body).toHaveProperty('requests');
        expect(res.body).toHaveProperty('inventory');
        expect(res.body).toHaveProperty('alerts');
        expect(res.body.revenue).toHaveProperty('monthly');
        expect(res.body.revenue).toHaveProperty('trend');
    });

    // 3. Protected Route: Machines
    test('GET /api/machines returns array', async () => {
        const res = await request(app).get('/api/machines');
        if (res.statusCode !== 200) console.error('Machines Error:', res.body);
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBeTruthy();

        // If we have data, verify shape
        if (res.body.length > 0) {
            const m = res.body[0];
            expect(m).toHaveProperty('serialNumber');
            // Check for explicit "machines/machines" doubling bug
            // If path was double, this route might 404 or return empty
        }
    });

    // 4. Protected Route: Customers Lite (Dropdowns)
    test('GET /api/customers/lite returns simplified list', async () => {
        const res = await request(app).get('/api/customers/lite');
        if (res.statusCode !== 200) console.error('Customers Lite Error:', res.body);
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBeTruthy();
        if (res.body.length > 0) {
            expect(res.body[0]).toHaveProperty('id');
            expect(res.body[0]).toHaveProperty('client_name');
        }
    });

    // 5. Protected Route: Technicians
    test('GET /api/technicians returns list', async () => {
        const res = await request(app).get('/api/technicians');
        if (res.statusCode !== 200) console.error('Technicians Error:', res.body);
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBeTruthy();
    });

    // 6. Protected Route: Machine Workflow (Kanban)
    test('GET /api/machine-workflow/kanban returns board data', async () => {
        const res = await request(app).get('/api/machine-workflow/kanban');
        if (res.statusCode !== 200) console.error('Kanban Error:', res.body);
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBeTruthy();
    });

});
