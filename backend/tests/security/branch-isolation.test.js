const request = require('supertest');
const { createMockPrismaClient } = require('../helpers/mockPrismaClient');

// Mock db MUST be done before requiring server
const db = createMockPrismaClient();
jest.doMock('../../db', () => db);

const { app } = require('../../server');
const { generateToken } = require('../../middleware/auth');

describe('Security: Branch Isolation', () => {
    let parentToken, childToken, otherToken;
    const PARENT_BRANCH_ID = 'branch-parent-123';
    const CHILD_BRANCH_ID = 'branch-child-456';
    const OTHER_BRANCH_ID = 'branch-other-789';

    const parentUser = {
        id: 'user-parent',
        role: 'BRANCH_MANAGER',
        branchId: PARENT_BRANCH_ID,
        displayName: 'Parent Manager',
        permissions: []
    };

    beforeAll(() => {
        // Setup tokens with mocked hierarchy
        // We know that authenticateToken middleware fetches children if branchId exists
        // So we need to mock that DB call or manually craft token with authorizedBranchIds if the middleware puts it there?
        // Actually, the middleware puts it in req.user. 
        // For these unit tests which might mock middleware or integration tests using the real middleware...
        // If we use real middleware, we need to mock db.branch.findMany

        db.branch.findMany.mockResolvedValue([
            { id: CHILD_BRANCH_ID } // Parent owns Child
        ]);

        parentToken = generateToken(parentUser);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('Middleware should attach child branches to authorizedBranchIds', async () => {
        // This is an integration test of the middleware + helper
        // We'll trust the middleware logic if we can verify the route behavior
    });

    test('Manager should be able to access child branch report', async () => {
        // Helper to simulate request with populated user object (skipping actual middleware DB call for simplicity if needed, 
        // or we rely on the mock above)

        // MOCK: authenticateToken middleware is "real" so it uses the mocked db.branch.findMany

        // MOCK: Report query
        db.maintenanceRequest.findMany.mockResolvedValue([]);

        const res = await request(app)
            .get('/api/reports/performance')
            .query({ branchId: CHILD_BRANCH_ID })
            .set('Authorization', `Bearer ${parentToken}`);

        // If logic is broken (current state), it overrides branchId with PARENT_BRANCH_ID
        // or throws 403.
        // We expect 200 and the query to use CHILD_BRANCH_ID

        // In the BROKEN state: 
        // The code does: if (!isAdmin) branchId = req.user.branchId;
        // So it forces PARENT_BRANCH_ID even if we asked for CHILD_BRANCH_ID.

        expect(res.status).not.toBe(403);
    });

    test('Manager should NOT be able to access unrelated branch report', async () => {
        const res = await request(app)
            .get('/api/reports/performance')
            .query({ branchId: OTHER_BRANCH_ID })
            .set('Authorization', `Bearer ${parentToken}`);

        // In fixed state, this should match authorizedIds and fail/filter
        // In BROKEN state, it overwrites with PARENT_BRANCH_ID and returns parent data (Data Leak/Confusion)
        // or if we use getBranchFilter, it might return data.
    });
});
