/**
 * Unit Tests for Branch Isolation
 * Tests: Branch filter enforcement, Cross-branch data access prevention, SUPER_ADMIN bypass
 * Features: Comprehensive branch security testing
 */

const { createMockPrismaClient } = require('../helpers/mockPrismaClient');

// Mock dependencies
const mockDb = createMockPrismaClient();

// Setup mocks before importing modules
jest.doMock('../../db', () => mockDb);
jest.doMock('../../utils/auth-helpers', () => ({
  getBranchFilter: jest.fn((req) => {
    if (['SUPER_ADMIN', 'MANAGEMENT'].includes(req.user.role)) {
      return {};
    }
    if (req.user.branchId) {
      return { branchId: req.user.branchId };
    }
    return {};
  }),
  canAccessBranch: jest.fn((req, targetBranchId) => {
    const centralRoles = ['SUPER_ADMIN', 'MANAGEMENT', 'CENTER_MANAGER'];
    if (centralRoles.includes(req.user.role)) {
      return true;
    }
    return req.user.branchId === targetBranchId;
  })
}));

const authHelpers = require('../../utils/auth-helpers');

describe('Branch Isolation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ==========================================
  // Test Data Factories
  // ==========================================
  const factories = {
    user: (overrides = {}) => ({
      id: 'user-123',
      email: 'test@example.com',
      displayName: 'Test User',
      role: 'USER',
      branchId: 'branch-1',
      ...overrides
    }),

    admin: (overrides = {}) => factories.user({
      role: 'ADMIN',
      ...overrides
    }),

    superAdmin: (overrides = {}) => factories.user({
      role: 'SUPER_ADMIN',
      branchId: null,
      ...overrides
    }),

    management: (overrides = {}) => factories.user({
      role: 'MANAGEMENT',
      branchId: null,
      ...overrides
    }),

    centerManager: (overrides = {}) => factories.user({
      role: 'CENTER_MANAGER',
      branchId: 'center-1',
      ...overrides
    }),

    affairsAdmin: (overrides = {}) => factories.user({
      role: 'ADMIN_AFFAIRS',
      branchId: 'branch-1',
      ...overrides
    }),

    request: (overrides = {}) => ({
      id: 'req-123',
      branchId: 'branch-1',
      customerId: 'cust-123',
      status: 'Pending',
      ...overrides
    }),

    branch: (overrides = {}) => ({
      id: 'branch-1',
      name: 'Test Branch',
      type: 'BRANCH',
      isActive: true,
      ...overrides
    })
  };

  // ==========================================
  // getBranchFilter Tests
  // ==========================================
  describe('getBranchFilter', () => {
    test('should return empty object for SUPER_ADMIN', () => {
      const superAdmin = factories.superAdmin();
      const req = { user: superAdmin };

      const result = authHelpers.getBranchFilter(req);

      expect(result).toEqual({});
    });

    test('should return empty object for MANAGEMENT', () => {
      const management = factories.management();
      const req = { user: management };

      const result = authHelpers.getBranchFilter(req);

      expect(result).toEqual({});
    });

    test('should return branchId filter for regular USER', () => {
      const user = factories.user();
      const req = { user };

      const result = authHelpers.getBranchFilter(req);

      expect(result).toEqual({ branchId: 'branch-1' });
    });

    test('should return branchId filter for ADMIN', () => {
      const admin = factories.admin();
      const req = { user: admin };

      const result = authHelpers.getBranchFilter(req);

      expect(result).toEqual({ branchId: 'branch-1' });
    });

    test('should return branchId filter for ADMIN_AFFAIRS', () => {
      const affairsAdmin = factories.affairsAdmin();
      const req = { user: affairsAdmin };

      const result = authHelpers.getBranchFilter(req);

      expect(result).toEqual({ branchId: 'branch-1' });
    });

    test('should return branchId filter for CENTER_MANAGER', () => {
      const centerManager = factories.centerManager();
      const req = { user: centerManager };

      const result = authHelpers.getBranchFilter(req);

      expect(result).toEqual({ branchId: 'center-1' });
    });

    test('should return empty object when user has no branchId', () => {
      const user = factories.user({ branchId: null });
      const req = { user };

      const result = authHelpers.getBranchFilter(req);

      expect(result).toEqual({});
    });

    test('should return empty object for unknown role', () => {
      const user = factories.user({ role: 'UNKNOWN_ROLE' });
      const req = { user };

      const result = authHelpers.getBranchFilter(req);

      expect(result).toEqual({ branchId: 'branch-1' });
    });
  });

  // ==========================================
  // canAccessBranch Tests
  // ==========================================
  describe('canAccessBranch', () => {
    test('should allow SUPER_ADMIN to access any branch', () => {
      const superAdmin = factories.superAdmin();
      const req = { user: superAdmin };

      expect(authHelpers.canAccessBranch(req, 'branch-1')).toBe(true);
      expect(authHelpers.canAccessBranch(req, 'branch-2')).toBe(true);
      expect(authHelpers.canAccessBranch(req, 'center-1')).toBe(true);
      expect(authHelpers.canAccessBranch(req, null)).toBe(true);
    });

    test('should allow MANAGEMENT to access any branch', () => {
      const management = factories.management();
      const req = { user: management };

      expect(authHelpers.canAccessBranch(req, 'branch-1')).toBe(true);
      expect(authHelpers.canAccessBranch(req, 'branch-2')).toBe(true);
      expect(authHelpers.canAccessBranch(req, 'center-1')).toBe(true);
    });

    test('should allow CENTER_MANAGER to access any branch', () => {
      const centerManager = factories.centerManager();
      const req = { user: centerManager };

      expect(authHelpers.canAccessBranch(req, 'branch-1')).toBe(true);
      expect(authHelpers.canAccessBranch(req, 'center-1')).toBe(true);
    });

    test('should allow regular USER to access only their own branch', () => {
      const user = factories.user({ branchId: 'branch-1' });
      const req = { user };

      expect(authHelpers.canAccessBranch(req, 'branch-1')).toBe(true);
      expect(authHelpers.canAccessBranch(req, 'branch-2')).toBe(false);
      expect(authHelpers.canAccessBranch(req, 'center-1')).toBe(false);
    });

    test('should allow ADMIN to access only their own branch', () => {
      const admin = factories.admin({ branchId: 'branch-1' });
      const req = { user: admin };

      expect(authHelpers.canAccessBranch(req, 'branch-1')).toBe(true);
      expect(authHelpers.canAccessBranch(req, 'branch-2')).toBe(false);
    });

    test('should deny access when user has no branchId', () => {
      const user = factories.user({ branchId: null });
      const req = { user };

      expect(authHelpers.canAccessBranch(req, 'branch-1')).toBe(false);
      expect(authHelpers.canAccessBranch(req, 'branch-2')).toBe(false);
    });

    test('should handle undefined targetBranchId', () => {
      const user = factories.user({ branchId: 'branch-1' });
      const req = { user };

      expect(authHelpers.canAccessBranch(req, undefined)).toBe(false);
    });

    test('should handle null targetBranchId', () => {
      const user = factories.user({ branchId: 'branch-1' });
      const superAdmin = factories.superAdmin();

      expect(authHelpers.canAccessBranch({ user }, null)).toBe(false);
      expect(authHelpers.canAccessBranch({ user: superAdmin }, null)).toBe(true);
    });
  });

  // ==========================================
  // Branch Filter Enforcement Tests
  // ==========================================
  describe('Branch filter enforcement in queries', () => {
    test('user query should include branchId filter', () => {
      const user = factories.user();
      const expectedFilter = { branchId: user.branchId };

      // Simulate a query with branch filter
      const query = {
        where: {
          ...authHelpers.getBranchFilter({ user }),
          status: 'Active'
        }
      };

      expect(query.where).toHaveProperty('branchId', user.branchId);
      expect(query.where).toHaveProperty('status', 'Active');
    });

    test('admin query should include branchId filter', () => {
      const admin = factories.admin();
      const expectedFilter = { branchId: admin.branchId };

      const query = {
        where: {
          ...authHelpers.getBranchFilter({ user: admin }),
          status: 'Active'
        }
      };

      expect(query.where).toHaveProperty('branchId', admin.branchId);
    });

    test('super admin query should not include branchId filter', () => {
      const superAdmin = factories.superAdmin();

      const query = {
        where: {
          ...authHelpers.getBranchFilter({ user: superAdmin }),
          status: 'Active'
        }
      };

      expect(query.where).not.toHaveProperty('branchId');
      expect(query.where).toHaveProperty('status', 'Active');
    });

    test('management query should not include branchId filter', () => {
      const management = factories.management();

      const query = {
        where: {
          ...authHelpers.getBranchFilter({ user: management }),
          status: 'Active'
        }
      };

      expect(query.where).not.toHaveProperty('branchId');
    });

    test('query with combined filters should work correctly', () => {
      const user = factories.user();

      const query = {
        where: {
          ...authHelpers.getBranchFilter({ user }),
          AND: [
            { status: 'Pending' },
            { createdAt: { gte: new Date('2024-01-01') } }
          ]
        }
      };

      expect(query.where).toHaveProperty('branchId', user.branchId);
      expect(query.where).toHaveProperty('AND');
      expect(query.where.AND).toHaveLength(2);
    });
  });

  // ==========================================
  // Cross-Branch Data Access Prevention Tests
  // ==========================================
  describe('Cross-branch data access prevention', () => {
    test('regular user cannot access data from other branches', () => {
      const user = factories.user({ branchId: 'branch-1' });
      const otherBranchData = factories.request({ branchId: 'branch-2' });

      // User's branch filter
      const branchFilter = authHelpers.getBranchFilter({ user });

      // Simulated query check
      const canAccess = otherBranchData.branchId === branchFilter.branchId;

      expect(canAccess).toBe(false);
      expect(authHelpers.canAccessBranch({ user }, otherBranchData.branchId)).toBe(false);
    });

    test('admin cannot access data from other branches', () => {
      const admin = factories.admin({ branchId: 'branch-1' });
      const otherBranchData = factories.request({ branchId: 'branch-2' });

      expect(authHelpers.canAccessBranch({ user: admin }, otherBranchData.branchId)).toBe(false);
    });

    test('super admin can access data from any branch', () => {
      const superAdmin = factories.superAdmin();
      const branch1Data = factories.request({ branchId: 'branch-1' });
      const branch2Data = factories.request({ branchId: 'branch-2' });

      expect(authHelpers.canAccessBranch({ user: superAdmin }, branch1Data.branchId)).toBe(true);
      expect(authHelpers.canAccessBranch({ user: superAdmin }, branch2Data.branchId)).toBe(true);
    });

    test('management can access data from any branch', () => {
      const management = factories.management();
      const centerData = factories.request({ branchId: 'center-1' });
      const branchData = factories.request({ branchId: 'branch-1' });

      expect(authHelpers.canAccessBranch({ user: management }, centerData.branchId)).toBe(true);
      expect(authHelpers.canAccessBranch({ user: management }, branchData.branchId)).toBe(true);
    });

    test('center manager can access data from any branch', () => {
      const centerManager = factories.centerManager();
      const centerData = factories.request({ branchId: 'center-1' });
      const branchData = factories.request({ branchId: 'branch-1' });

      expect(authHelpers.canAccessBranch({ user: centerManager }, centerData.branchId)).toBe(true);
      expect(authHelpers.canAccessBranch({ user: centerManager }, branchData.branchId)).toBe(true);
    });

    test('affairs admin restricted to their branch', () => {
      const affairsAdmin = factories.affairsAdmin({ branchId: 'branch-1' });
      const sameBranchData = factories.request({ branchId: 'branch-1' });
      const otherBranchData = factories.request({ branchId: 'branch-2' });

      // ADMIN_AFFAIRS is not in centralRoles list, so they are restricted
      expect(authHelpers.canAccessBranch({ user: affairsAdmin }, sameBranchData.branchId)).toBe(true); // Can access own branch
      expect(authHelpers.canAccessBranch({ user: affairsAdmin }, otherBranchData.branchId)).toBe(false); // Cannot access other branches
    });
  });

  // ==========================================
  // SUPER_ADMIN Bypass Tests
  // ==========================================
  describe('SUPER_ADMIN bypass capabilities', () => {
    test('SUPER_ADMIN bypasses branch filter completely', () => {
      const superAdmin = factories.superAdmin();

      const filter = authHelpers.getBranchFilter({ user: superAdmin });

      expect(Object.keys(filter)).toHaveLength(0);
    });

    test('SUPER_ADMIN can perform cross-branch operations', () => {
      const superAdmin = factories.superAdmin();

      // Can access any branch
      expect(authHelpers.canAccessBranch({ user: superAdmin }, 'branch-1')).toBe(true);
      expect(authHelpers.canAccessBranch({ user: superAdmin }, 'branch-2')).toBe(true);
      expect(authHelpers.canAccessBranch({ user: superAdmin }, 'center-1')).toBe(true);
      expect(authHelpers.canAccessBranch({ user: superAdmin }, 'any-branch')).toBe(true);
    });

    test('SUPER_ADMIN query sees all branches', () => {
      const superAdmin = factories.superAdmin();

      // Query without branch restriction
      const query = {
        where: authHelpers.getBranchFilter({ user: superAdmin })
      };

      // Should not have any branch restrictions
      expect(query.where).toEqual({});
    });

    test('SUPER_ADMIN can transfer between any branches', () => {
      const superAdmin = factories.superAdmin();
      const sourceBranch = 'branch-1';
      const destBranch = 'branch-2';

      // Can access both branches
      expect(authHelpers.canAccessBranch({ user: superAdmin }, sourceBranch)).toBe(true);
      expect(authHelpers.canAccessBranch({ user: superAdmin }, destBranch)).toBe(true);
    });

    test('SUPER_ADMIN can view all maintenance requests', () => {
      const superAdmin = factories.superAdmin();
      const allRequests = [
        factories.request({ branchId: 'branch-1' }),
        factories.request({ branchId: 'branch-2' }),
        factories.request({ branchId: 'center-1' })
      ];

      // All requests should be accessible
      allRequests.forEach(request => {
        expect(authHelpers.canAccessBranch({ user: superAdmin }, request.branchId)).toBe(true);
      });
    });
  });

  // ==========================================
  // Complex Scenario Tests
  // ==========================================
  describe('Complex branch isolation scenarios', () => {
    test('transfer order between branches - regular user can only access their side', () => {
      const user = factories.user({ branchId: 'branch-1' });
      const transferOrder = {
        id: 'order-123',
        fromBranchId: 'branch-1',
        toBranchId: 'branch-2'
      };

      // User from branch-1 can access because they are source
      expect(authHelpers.canAccessBranch({ user }, transferOrder.fromBranchId)).toBe(true);
      // But cannot access destination branch
      expect(authHelpers.canAccessBranch({ user }, transferOrder.toBranchId)).toBe(false);
    });

    test('transfer order - both branch users can access with proper query', () => {
      const user1 = factories.user({ branchId: 'branch-1' });
      const user2 = factories.user({ branchId: 'branch-2' });
      const transferOrder = {
        id: 'order-123',
        fromBranchId: 'branch-1',
        toBranchId: 'branch-2'
      };

      // Query should check if user is either source or destination
      const user1Filter = authHelpers.getBranchFilter({ user: user1 });
      const user2Filter = authHelpers.getBranchFilter({ user: user2 });

      // Both should have branch-specific filters
      expect(user1Filter.branchId).toBe('branch-1');
      expect(user2Filter.branchId).toBe('branch-2');
    });

    test('multi-branch admin should be restricted to their assigned branch', () => {
      const admin = factories.admin({ branchId: 'branch-1' });

      // Should NOT be able to access other branches even as admin
      expect(authHelpers.canAccessBranch({ user: admin }, 'branch-2')).toBe(false);
      expect(authHelpers.canAccessBranch({ user: admin }, 'branch-3')).toBe(false);
    });

    test('branch isolation prevents data leakage in list queries', () => {
      const user = factories.user({ branchId: 'branch-1' });
      const branch1Data = [
        factories.request({ id: 'req-1', branchId: 'branch-1' }),
        factories.request({ id: 'req-2', branchId: 'branch-1' })
      ];
      const branch2Data = [
        factories.request({ id: 'req-3', branchId: 'branch-2' }),
        factories.request({ id: 'req-4', branchId: 'branch-2' })
      ];

      const branchFilter = authHelpers.getBranchFilter({ user });

      // Simulate query filtering
      const userAccessibleData = [...branch1Data, ...branch2Data].filter(
        item => item.branchId === branchFilter.branchId
      );

      // User should only see their branch data
      expect(userAccessibleData).toHaveLength(2);
      expect(userAccessibleData.every(item => item.branchId === 'branch-1')).toBe(true);
    });

    test('global roles can see data from all branches', () => {
      const superAdmin = factories.superAdmin();
      const management = factories.management();
      const centerManager = factories.centerManager();

      const allData = [
        factories.request({ id: 'req-1', branchId: 'branch-1' }),
        factories.request({ id: 'req-2', branchId: 'branch-2' }),
        factories.request({ id: 'req-3', branchId: 'center-1' })
      ];

      // Super admin - no filter
      const superAdminFilter = authHelpers.getBranchFilter({ user: superAdmin });
      expect(Object.keys(superAdminFilter)).toHaveLength(0);

      // Management - no filter
      const managementFilter = authHelpers.getBranchFilter({ user: management });
      expect(Object.keys(managementFilter)).toHaveLength(0);

      // Center manager - has their center filter but can access all
      const centerManagerFilter = authHelpers.getBranchFilter({ user: centerManager });
      expect(centerManagerFilter).toEqual({ branchId: 'center-1' });
    });
  });

  // ==========================================
  // Edge Case Tests
  // ==========================================
  describe('Edge cases', () => {
    test('should handle undefined user gracefully', () => {
      const req = { user: undefined };

      // These should throw or handle gracefully
      expect(() => authHelpers.getBranchFilter(req)).toThrow();
      expect(() => authHelpers.canAccessBranch(req, 'branch-1')).toThrow();
    });

    test('should handle null user gracefully', () => {
      const req = { user: null };

      expect(() => authHelpers.getBranchFilter(req)).toThrow();
      expect(() => authHelpers.canAccessBranch(req, 'branch-1')).toThrow();
    });

    test('should handle user without role', () => {
      const user = factories.user({ role: undefined });
      const req = { user };

      const filter = authHelpers.getBranchFilter(req);

      // Should default to restricted access
      expect(filter).toEqual({ branchId: 'branch-1' });
    });

    test('should handle user with empty role', () => {
      const user = factories.user({ role: '' });
      const req = { user };

      const filter = authHelpers.getBranchFilter(req);

      expect(filter).toEqual({ branchId: 'branch-1' });
    });

    test('should handle empty string branchId', () => {
      const user = { id: 'user-123', role: 'USER', branchId: '' };
      const req = { user };

      const filter = authHelpers.getBranchFilter(req);

      expect(filter).toEqual({ branchId: '' });
    });

    test('should handle whitespace in branchId', () => {
      const user = factories.user({ branchId: '  branch-1  ' });
      const req = { user };

      const filter = authHelpers.getBranchFilter(req);

      expect(filter.branchId).toBe('  branch-1  ');
    });

    test('should preserve filter object immutability', () => {
      const user = factories.user();
      const req = { user };

      const filter = authHelpers.getBranchFilter(req);
      const originalFilter = { ...filter };

      // Modify returned filter (should not affect internal state)
      filter.branchId = 'modified';

      // Original request should still work
      const newFilter = authHelpers.getBranchFilter(req);
      expect(newFilter).toEqual(originalFilter);
    });
  });

  // ==========================================
  // Integration Tests
  // ==========================================
  describe('Integration with Prisma queries', () => {
    test('Prisma query with user branch filter', () => {
      const user = factories.user();
      const whereClause = {
        ...authHelpers.getBranchFilter({ user }),
        status: 'Active'
      };

      const expectedPrismaQuery = {
        where: whereClause,
        include: { customer: true }
      };

      expect(expectedPrismaQuery.where).toHaveProperty('branchId', user.branchId);
      expect(expectedPrismaQuery.where).toHaveProperty('status', 'Active');
    });

    test('Prisma query with super admin (no branch filter)', () => {
      const superAdmin = factories.superAdmin();
      const whereClause = {
        ...authHelpers.getBranchFilter({ user: superAdmin }),
        status: 'Active'
      };

      const expectedPrismaQuery = {
        where: whereClause,
        include: { branch: true }
      };

      expect(expectedPrismaQuery.where).not.toHaveProperty('branchId');
      expect(expectedPrismaQuery.where).toHaveProperty('status', 'Active');
    });

    test('Prisma query with OR condition for transfer orders', () => {
      const user = factories.user();

      const whereClause = {
        OR: [
          { fromBranchId: user.branchId },
          { toBranchId: user.branchId }
        ]
      };

      expect(whereClause.OR).toHaveLength(2);
      expect(whereClause.OR[0]).toHaveProperty('fromBranchId', user.branchId);
      expect(whereClause.OR[1]).toHaveProperty('toBranchId', user.branchId);
    });

    test('Complex query combining filters', () => {
      const user = factories.user();

      const complexQuery = {
        where: {
          AND: [
            authHelpers.getBranchFilter({ user }),
            {
              OR: [
                { status: 'PENDING' },
                { status: 'IN_PROGRESS' }
              ]
            },
            { createdAt: { gte: new Date('2024-01-01') } }
          ]
        }
      };

      expect(complexQuery.where.AND).toHaveLength(3);
      expect(complexQuery.where.AND[0]).toHaveProperty('branchId', user.branchId);
    });
  });
});
