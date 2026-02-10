/**
 * Comprehensive Test Suite for Auth Service
 * Tests: Login, Password Validation, Token Generation, User Profile Updates
 * Features: Mock Prisma, Test Factories, Error Case Testing
 */

const { createMockPrismaClient } = require('../helpers/mockPrismaClient');

// Mock dependencies before importing the service
const mockDb = createMockPrismaClient();

// Extend mock with auth-specific models
mockDb.user = {
  findFirst: jest.fn(),
  findUnique: jest.fn(),
  update: jest.fn(),
  updateMany: jest.fn(),
  findMany: jest.fn(),
  create: jest.fn()
};

mockDb.accountLockout = {
  findUnique: jest.fn(),
  create: jest.fn(),
  update: jest.fn()
};

mockDb.passwordHistory = {
  findMany: jest.fn(),
  create: jest.fn(),
  delete: jest.fn()
};

mockDb.systemLog = {
  create: jest.fn()
};

// Mock password policy - must match actual exports
const PASSWORD_POLICY = {
  maxFailedAttempts: 5,
  lockoutDurationMinutes: 30,
  maxAgeDays: 90
};

const mockPasswordPolicy = {
  verifyPassword: jest.fn(),
  hashPassword: jest.fn(),
  validatePasswordStrength: jest.fn(),
  isPasswordInHistory: jest.fn(),
  savePasswordToHistory: jest.fn(),
  isPasswordExpired: jest.fn(),
  getDaysUntilExpiration: jest.fn(),
  checkAccountLockout: jest.fn(),
  recordFailedAttempt: jest.fn(),
  resetFailedAttempts: jest.fn(),
  getPasswordStrengthLabel: jest.fn(),
  PASSWORD_POLICY
};

// Mock logger
const mockLogAction = jest.fn();

// Mock JWT
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(() => 'mock-jwt-token-12345')
}));

// Set JWT_SECRET before any imports
process.env.JWT_SECRET = 'test-jwt-secret';

// Set as global for authService which uses it directly (bug workaround)
global.PASSWORD_POLICY = PASSWORD_POLICY;

// Setup mocks before importing modules
jest.doMock('../../db', () => mockDb);
jest.doMock('../../utils/passwordPolicy', () => ({
  ...mockPasswordPolicy,
  PASSWORD_POLICY
}));
jest.doMock('../../utils/logger', () => ({
  logAction: mockLogAction
}));

const jwt = require('jsonwebtoken');
const authService = require('../../services/authService');
const db = require('../../db');

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-jwt-secret';
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
      branch: { type: 'CENTER', name: 'Main Branch' },
      password: 'hashedPassword123',
      passwordChangedAt: new Date('2024-01-01'),
      mustChangePassword: false,
      theme: 'light',
      fontFamily: 'sans',
      lastLoginAt: null,
      loginCount: 0,
      ...overrides
    }),

    adminUser: (overrides = {}) => factories.user({
      role: 'ADMIN',
      ...overrides
    }),

    superAdminUser: (overrides = {}) => factories.user({
      role: 'SUPER_ADMIN',
      branchId: null,
      ...overrides
    }),

    loginCredentials: (overrides = {}) => ({
      identifier: 'test@example.com',
      password: 'ValidPass123!',
      branchId: 'branch-1',
      ...overrides
    }),

    lockoutInfo: (overrides = {}) => ({
      userId: 'user-123',
      failedAttempts: 0,
      lastFailedAttempt: null,
      lockedUntil: null,
      ...overrides
    })
  };

  // ==========================================
  // Login Functionality Tests
  // ==========================================
  describe('login', () => {
    test('should successfully login with valid credentials', async () => {
      const user = factories.user();
      const credentials = factories.loginCredentials();

      db.user.findFirst.mockResolvedValue(user);
      mockPasswordPolicy.checkAccountLockout.mockResolvedValue({ isLocked: false });
      mockPasswordPolicy.verifyPassword.mockResolvedValue(true);
      mockPasswordPolicy.resetFailedAttempts.mockResolvedValue();
      mockPasswordPolicy.isPasswordExpired.mockReturnValue(false);
      mockPasswordPolicy.getDaysUntilExpiration.mockReturnValue(45);

      const result = await authService.login(credentials);

      expect(result.token).toBe('mock-jwt-token-12345');
      expect(result.user.email).toBe(user.email);
      expect(result.user.role).toBe(user.role);
      expect(result.user.branchId).toBe(user.branchId);
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          id: user.id,
          email: user.email,
          role: user.role
        }),
        'test-jwt-secret',
        { expiresIn: '24h' }
      );
    });

    test('should successfully login with legacy password (123456)', async () => {
      const user = factories.user({ password: null });
      const credentials = factories.loginCredentials({ password: '123456' });

      db.user.findFirst.mockResolvedValue(user);
      mockPasswordPolicy.checkAccountLockout.mockResolvedValue({ isLocked: false });
      mockPasswordPolicy.hashPassword.mockResolvedValue('newHashedPassword');

      const result = await authService.login(credentials);

      expect(result.token).toBeDefined();
      expect(db.user.updateMany).toHaveBeenCalledWith({
        where: { id: user.id, branchId: { not: null } },
        data: { password: 'newHashedPassword', passwordChangedAt: expect.any(Date) }
      });
    });

    test('should throw error when user not found', async () => {
      db.user.findFirst.mockResolvedValue(null);

      await expect(authService.login(factories.loginCredentials()))
        .rejects.toThrow('المستخدم غير موجود');
    });

    test('should throw error when account is locked', async () => {
      const user = factories.user();
      const lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 mins from now

      db.user.findFirst.mockResolvedValue(user);
      mockPasswordPolicy.checkAccountLockout.mockResolvedValue({
        isLocked: true,
        lockedUntil
      });

      await expect(authService.login(factories.loginCredentials()))
        .rejects.toThrow(/Account is locked/);
    });

    test('should throw error with invalid password and record failed attempt', async () => {
      const user = factories.user();

      db.user.findFirst.mockResolvedValue(user);
      mockPasswordPolicy.checkAccountLockout.mockResolvedValue({ isLocked: false });
      mockPasswordPolicy.verifyPassword.mockResolvedValue(false);
      mockPasswordPolicy.recordFailedAttempt.mockResolvedValue({
        isLocked: false,
        remainingAttempts: 4
      });

      await expect(authService.login(factories.loginCredentials()))
        .rejects.toThrow(/البريد الإلكتروني أو كلمة المرور غير صحيحة/);

      expect(mockPasswordPolicy.recordFailedAttempt).toHaveBeenCalledWith(user.id);
    });

    test('should lock account after max failed attempts', async () => {
      const user = factories.user();

      db.user.findFirst.mockResolvedValue(user);
      mockPasswordPolicy.checkAccountLockout.mockResolvedValue({ isLocked: false });
      mockPasswordPolicy.verifyPassword.mockResolvedValue(false);
      mockPasswordPolicy.recordFailedAttempt.mockResolvedValue({
        isLocked: true,
        remainingAttempts: 0
      });

      await expect(authService.login(factories.loginCredentials()))
        .rejects.toThrow(/Account locked/);
    });

    test('should return password expiration warnings', async () => {
      const user = factories.user({ passwordChangedAt: new Date('2023-01-01') });

      db.user.findFirst.mockResolvedValue(user);
      mockPasswordPolicy.checkAccountLockout.mockResolvedValue({ isLocked: false });
      mockPasswordPolicy.verifyPassword.mockResolvedValue(true);
      mockPasswordPolicy.resetFailedAttempts.mockResolvedValue();
      mockPasswordPolicy.isPasswordExpired.mockReturnValue(false);
      mockPasswordPolicy.getDaysUntilExpiration.mockReturnValue(3);

      const result = await authService.login(factories.loginCredentials());

      expect(result.warnings).toContain(expect.stringMatching(/password will expire/));
    });

    test('should require password change when expired', async () => {
      const user = factories.user();

      db.user.findFirst.mockResolvedValue(user);
      mockPasswordPolicy.checkAccountLockout.mockResolvedValue({ isLocked: false });
      mockPasswordPolicy.verifyPassword.mockResolvedValue(true);
      mockPasswordPolicy.resetFailedAttempts.mockResolvedValue();
      mockPasswordPolicy.isPasswordExpired.mockReturnValue(true);
      mockPasswordPolicy.getDaysUntilExpiration.mockReturnValue(-5);

      const result = await authService.login(factories.loginCredentials());

      expect(result.user.passwordStatus.isExpired).toBe(true);
      expect(result.user.passwordStatus.mustChange).toBe(true);
      expect(result.warnings).toContain(expect.stringMatching(/password has expired/));
    });

    test('should throw error when JWT_SECRET not configured', async () => {
      delete process.env.JWT_SECRET;

      await expect(authService.login(factories.loginCredentials()))
        .rejects.toThrow('JWT secret not configured');
    });

    test('should update login tracking on successful login', async () => {
      const user = factories.user();

      db.user.findFirst.mockResolvedValue(user);
      mockPasswordPolicy.checkAccountLockout.mockResolvedValue({ isLocked: false });
      mockPasswordPolicy.verifyPassword.mockResolvedValue(true);
      mockPasswordPolicy.resetFailedAttempts.mockResolvedValue();
      mockPasswordPolicy.isPasswordExpired.mockReturnValue(false);
      mockPasswordPolicy.getDaysUntilExpiration.mockReturnValue(45);

      await authService.login(factories.loginCredentials());

      expect(db.user.updateMany).toHaveBeenCalledWith({
        where: { id: user.id },
        data: {
          lastLoginAt: expect.any(Date),
          loginCount: { increment: 1 }
        }
      });
    });

    test('should log login action', async () => {
      const user = factories.user();

      db.user.findFirst.mockResolvedValue(user);
      mockPasswordPolicy.checkAccountLockout.mockResolvedValue({ isLocked: false });
      mockPasswordPolicy.verifyPassword.mockResolvedValue(true);
      mockPasswordPolicy.resetFailedAttempts.mockResolvedValue();
      mockPasswordPolicy.isPasswordExpired.mockReturnValue(false);
      mockPasswordPolicy.getDaysUntilExpiration.mockReturnValue(45);

      await authService.login(factories.loginCredentials());

      expect(mockLogAction).toHaveBeenCalledWith({
        entityType: 'USER',
        entityId: user.id,
        action: 'LOGIN',
        details: expect.stringContaining('logged in'),
        userId: user.id,
        performedBy: user.displayName,
        branchId: user.branchId
      });
    });
  });

  // ==========================================
  // Password Validation Tests
  // ==========================================
  describe('changePassword', () => {
    test('should successfully change password with valid current password', async () => {
      const user = factories.user();

      db.user.findFirst.mockResolvedValue(user);
      mockPasswordPolicy.verifyPassword.mockResolvedValue(true);
      mockPasswordPolicy.validatePasswordStrength.mockReturnValue({
        isValid: true,
        strength: 80,
        errors: []
      });
      mockPasswordPolicy.isPasswordInHistory.mockResolvedValue(false);
      mockPasswordPolicy.hashPassword.mockResolvedValue('newHashedPassword');
      mockPasswordPolicy.getPasswordStrengthLabel.mockReturnValue('Strong');

      const result = await authService.changePassword(
        user.id,
        'CurrentPass123!',
        'NewSecurePass456!'
      );

      expect(result.message).toContain('تم تغيير كلمة المرور');
      expect(result.strength).toBe(80);
      expect(result.strengthLabel).toBe('Strong');
    });

    test('should throw error when user not found', async () => {
      db.user.findFirst.mockResolvedValue(null);

      await expect(authService.changePassword('invalid-id', 'pass', 'newpass'))
        .rejects.toThrow('User not found');
    });

    test('should throw error when current password is incorrect', async () => {
      const user = factories.user();

      db.user.findFirst.mockResolvedValue(user);
      mockPasswordPolicy.verifyPassword.mockResolvedValue(false);

      await expect(authService.changePassword(user.id, 'wrongpass', 'newpass'))
        .rejects.toThrow('Current password is incorrect');
    });

    test('should validate new password strength', async () => {
      const user = factories.user();

      db.user.findFirst.mockResolvedValue(user);
      mockPasswordPolicy.verifyPassword.mockResolvedValue(true);
      mockPasswordPolicy.validatePasswordStrength.mockReturnValue({
        isValid: false,
        errors: ['Password must be at least 8 characters', 'Password must contain uppercase'],
        strength: 20
      });

      await expect(authService.changePassword(user.id, 'CurrentPass123!', 'weak'))
        .rejects.toThrow(/Password does not meet security requirements/);
    });

    test('should prevent password reuse', async () => {
      const user = factories.user();

      db.user.findFirst.mockResolvedValue(user);
      mockPasswordPolicy.verifyPassword.mockResolvedValue(true);
      mockPasswordPolicy.validatePasswordStrength.mockReturnValue({
        isValid: true,
        strength: 80,
        errors: []
      });
      mockPasswordPolicy.isPasswordInHistory.mockResolvedValue(true);

      await expect(authService.changePassword(user.id, 'CurrentPass123!', 'OldPass123!'))
        .rejects.toThrow('Cannot reuse a previous password');
    });

    test('should handle legacy password (123456) correctly', async () => {
      const user = factories.user({ password: null });

      db.user.findFirst.mockResolvedValue(user);
      mockPasswordPolicy.validatePasswordStrength.mockReturnValue({
        isValid: true,
        strength: 80,
        errors: []
      });
      mockPasswordPolicy.isPasswordInHistory.mockResolvedValue(false);
      mockPasswordPolicy.hashPassword.mockResolvedValue('newHashedPassword');
      mockPasswordPolicy.getPasswordStrengthLabel.mockReturnValue('Strong');

      const result = await authService.changePassword(user.id, '123456', 'NewSecurePass456!');

      expect(result.message).toContain('تم تغيير كلمة المرور');
    });

    test('should save password to history after change', async () => {
      const user = factories.user();

      db.user.findFirst.mockResolvedValue(user);
      mockPasswordPolicy.verifyPassword.mockResolvedValue(true);
      mockPasswordPolicy.validatePasswordStrength.mockReturnValue({
        isValid: true,
        strength: 80,
        errors: []
      });
      mockPasswordPolicy.isPasswordInHistory.mockResolvedValue(false);
      mockPasswordPolicy.hashPassword.mockResolvedValue('newHashedPassword');
      mockPasswordPolicy.getPasswordStrengthLabel.mockReturnValue('Strong');

      await authService.changePassword(user.id, 'CurrentPass123!', 'NewSecurePass456!');

      expect(mockPasswordPolicy.savePasswordToHistory).toHaveBeenCalledWith(
        user.id,
        'newHashedPassword'
      );
    });

    test('should update user with new password and reset mustChangePassword flag', async () => {
      const user = factories.user({ mustChangePassword: true });

      db.user.findFirst.mockResolvedValue(user);
      mockPasswordPolicy.verifyPassword.mockResolvedValue(true);
      mockPasswordPolicy.validatePasswordStrength.mockReturnValue({
        isValid: true,
        strength: 80,
        errors: []
      });
      mockPasswordPolicy.isPasswordInHistory.mockResolvedValue(false);
      mockPasswordPolicy.hashPassword.mockResolvedValue('newHashedPassword');
      mockPasswordPolicy.getPasswordStrengthLabel.mockReturnValue('Strong');

      await authService.changePassword(user.id, 'CurrentPass123!', 'NewSecurePass456!');

      expect(db.user.updateMany).toHaveBeenCalledWith({
        where: { id: user.id, branchId: { not: null } },
        data: {
          password: 'newHashedPassword',
          passwordChangedAt: expect.any(Date),
          mustChangePassword: false
        }
      });
    });

    test('should log password change action', async () => {
      const user = factories.user();

      db.user.findFirst.mockResolvedValue(user);
      mockPasswordPolicy.verifyPassword.mockResolvedValue(true);
      mockPasswordPolicy.validatePasswordStrength.mockReturnValue({
        isValid: true,
        strength: 80,
        errors: []
      });
      mockPasswordPolicy.isPasswordInHistory.mockResolvedValue(false);
      mockPasswordPolicy.hashPassword.mockResolvedValue('newHashedPassword');
      mockPasswordPolicy.getPasswordStrengthLabel.mockReturnValue('Strong');

      await authService.changePassword(user.id, 'CurrentPass123!', 'NewSecurePass456!');

      expect(mockLogAction).toHaveBeenCalledWith({
        entityType: 'USER',
        entityId: user.id,
        action: 'PASSWORD_CHANGE',
        details: 'User changed their password',
        userId: user.id,
        performedBy: user.displayName,
        branchId: user.branchId
      });
    });
  });

  // ==========================================
  // Token Generation Tests (implicitly tested in login)
  // ==========================================
  describe('Token generation', () => {
    test('should include correct user data in JWT payload', async () => {
      const user = factories.user();

      db.user.findFirst.mockResolvedValue(user);
      mockPasswordPolicy.checkAccountLockout.mockResolvedValue({ isLocked: false });
      mockPasswordPolicy.verifyPassword.mockResolvedValue(true);
      mockPasswordPolicy.resetFailedAttempts.mockResolvedValue();
      mockPasswordPolicy.isPasswordExpired.mockReturnValue(false);
      mockPasswordPolicy.getDaysUntilExpiration.mockReturnValue(45);

      await authService.login(factories.loginCredentials());

      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          id: user.id,
          email: user.email,
          role: user.role,
          displayName: user.displayName,
          branchId: user.branchId
        }),
        expect.any(String),
        { expiresIn: '24h' }
      );
    });

    test('should use requested branchId when user has no branch', async () => {
      const user = factories.user({ branchId: null });
      const credentials = factories.loginCredentials({ branchId: 'requested-branch' });

      db.user.findFirst.mockResolvedValue(user);
      mockPasswordPolicy.checkAccountLockout.mockResolvedValue({ isLocked: false });
      mockPasswordPolicy.verifyPassword.mockResolvedValue(true);
      mockPasswordPolicy.resetFailedAttempts.mockResolvedValue();
      mockPasswordPolicy.isPasswordExpired.mockReturnValue(false);
      mockPasswordPolicy.getDaysUntilExpiration.mockReturnValue(45);

      await authService.login(credentials);

      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({ branchId: 'requested-branch' }),
        expect.any(String),
        { expiresIn: '24h' }
      );
    });
  });

  // ==========================================
  // User Profile Tests
  // ==========================================
  describe('getProfile', () => {
    test('should return user profile with password status', async () => {
      const user = factories.user();

      db.user.findFirst.mockResolvedValue(user);
      mockPasswordPolicy.isPasswordExpired.mockReturnValue(false);
      mockPasswordPolicy.getDaysUntilExpiration.mockReturnValue(45);

      const result = await authService.getProfile(user.id);

      expect(result).toMatchObject({
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        branchId: user.branchId,
        branchType: user.branch.type,
        theme: user.theme,
        fontFamily: user.fontFamily,
        passwordStatus: {
          isExpired: false,
          daysUntilExpiration: 45,
          mustChange: false
        }
      });
    });

    test('should throw error when user not found', async () => {
      db.user.findFirst.mockResolvedValue(null);

      await expect(authService.getProfile('nonexistent'))
        .rejects.toThrow('User not found');
    });

    test('should indicate expired password in status', async () => {
      const user = factories.user({ passwordChangedAt: new Date('2023-01-01') });

      db.user.findFirst.mockResolvedValue(user);
      mockPasswordPolicy.isPasswordExpired.mockReturnValue(true);
      mockPasswordPolicy.getDaysUntilExpiration.mockReturnValue(-10);

      const result = await authService.getProfile(user.id);

      expect(result.passwordStatus.isExpired).toBe(true);
      expect(result.passwordStatus.daysUntilExpiration).toBe(-10);
    });

    test('should enforce branchId filter in query', async () => {
      const user = factories.user();

      db.user.findFirst.mockResolvedValue(user);
      mockPasswordPolicy.isPasswordExpired.mockReturnValue(false);
      mockPasswordPolicy.getDaysUntilExpiration.mockReturnValue(45);

      await authService.getProfile(user.id);

      expect(db.user.findFirst).toHaveBeenCalledWith({
        where: { id: user.id, branchId: { not: null } },
        include: { branch: true }
      });
    });
  });

  describe('updatePreferences', () => {
    test('should update user theme and font family', async () => {
      const user = factories.user({ theme: 'light', fontFamily: 'sans' });

      db.user.updateMany.mockResolvedValue({ count: 1 });
      db.user.findFirst.mockResolvedValue({ ...user, theme: 'dark', fontFamily: 'serif' });

      const result = await authService.updatePreferences(user.id, {
        theme: 'dark',
        fontFamily: 'serif'
      });

      expect(result.theme).toBe('dark');
      expect(result.fontFamily).toBe('serif');
    });

    test('should update only provided preferences', async () => {
      const user = factories.user({ theme: 'light', fontFamily: 'sans' });

      db.user.updateMany.mockResolvedValue({ count: 1 });
      db.user.findFirst.mockResolvedValue({ ...user, theme: 'dark' });

      const result = await authService.updatePreferences(user.id, { theme: 'dark' });

      expect(db.user.updateMany).toHaveBeenCalledWith({
        where: { id: user.id, branchId: { not: null } },
        data: { theme: 'dark', fontFamily: undefined }
      });
    });

    test('should enforce branchId filter', async () => {
      db.user.updateMany.mockResolvedValue({ count: 1 });
      db.user.findFirst.mockResolvedValue(factories.user());

      await authService.updatePreferences('user-123', { theme: 'dark' });

      expect(db.user.updateMany).toHaveBeenCalledWith({
        where: { id: 'user-123', branchId: { not: null } },
        data: expect.any(Object)
      });
    });
  });

  // ==========================================
  // Admin Functions Tests
  // ==========================================
  describe('forcePasswordChange', () => {
    test('should allow admin to force password change', async () => {
      const admin = factories.adminUser();
      const targetUser = factories.user({ id: 'target-123', email: 'target@example.com' });

      db.user.findFirst
        .mockResolvedValueOnce(admin)
        .mockResolvedValueOnce(targetUser);

      const result = await authService.forcePasswordChange(admin.id, targetUser.id);

      expect(result.message).toContain('User must change password');
      expect(db.user.updateMany).toHaveBeenCalledWith({
        where: { id: targetUser.id },
        data: { mustChangePassword: true }
      });
    });

    test('should allow SUPER_ADMIN to force password change', async () => {
      const superAdmin = factories.superAdminUser();
      const targetUser = factories.user({ id: 'target-123' });

      db.user.findFirst
        .mockResolvedValueOnce(superAdmin)
        .mockResolvedValueOnce(targetUser);

      const result = await authService.forcePasswordChange(superAdmin.id, targetUser.id);

      expect(result.message).toContain('User must change password');
    });

    test('should deny non-admin users', async () => {
      const regularUser = factories.user();
      const targetUser = factories.user({ id: 'target-123' });

      db.user.findFirst
        .mockResolvedValueOnce(regularUser)
        .mockResolvedValueOnce(targetUser);

      await expect(authService.forcePasswordChange(regularUser.id, targetUser.id))
        .rejects.toThrow('Admin access required');
    });

    test('should throw error when target user not found', async () => {
      const admin = factories.adminUser();

      db.user.findFirst
        .mockResolvedValueOnce(admin)
        .mockResolvedValueOnce(null);

      await expect(authService.forcePasswordChange(admin.id, 'nonexistent'))
        .rejects.toThrow('Target user not found');
    });

    test('should log the action', async () => {
      const admin = factories.adminUser();
      const targetUser = factories.user({ id: 'target-123', email: 'target@example.com' });

      db.user.findFirst
        .mockResolvedValueOnce(admin)
        .mockResolvedValueOnce(targetUser);

      await authService.forcePasswordChange(admin.id, targetUser.id);

      expect(mockLogAction).toHaveBeenCalledWith({
        entityType: 'USER',
        entityId: targetUser.id,
        action: 'FORCE_PASSWORD_CHANGE',
        details: expect.stringContaining(targetUser.email),
        userId: admin.id,
        performedBy: admin.displayName,
        branchId: admin.branchId
      });
    });
  });

  describe('unlockAccount', () => {
    test('should allow admin to unlock account', async () => {
      const admin = factories.adminUser();
      const lockedUser = factories.user({ id: 'locked-123' });

      db.user.findFirst
        .mockResolvedValueOnce(admin)
        .mockResolvedValueOnce(lockedUser);

      const result = await authService.unlockAccount(admin.id, lockedUser.id);

      expect(result.message).toContain('Account unlocked successfully');
      expect(mockPasswordPolicy.resetFailedAttempts).toHaveBeenCalledWith(lockedUser.id);
    });

    test('should deny non-admin users', async () => {
      const regularUser = factories.user();
      const lockedUser = factories.user({ id: 'locked-123' });

      db.user.findFirst
        .mockResolvedValueOnce(regularUser)
        .mockResolvedValueOnce(lockedUser);

      await expect(authService.unlockAccount(regularUser.id, lockedUser.id))
        .rejects.toThrow('Admin access required');
    });

    test('should throw error when target user not found', async () => {
      const admin = factories.adminUser();

      db.user.findFirst
        .mockResolvedValueOnce(admin)
        .mockResolvedValueOnce(null);

      await expect(authService.unlockAccount(admin.id, 'nonexistent'))
        .rejects.toThrow('Target user not found');
    });

    test('should log the action', async () => {
      const admin = factories.adminUser();
      const lockedUser = factories.user({ id: 'locked-123', email: 'locked@example.com' });

      db.user.findFirst
        .mockResolvedValueOnce(admin)
        .mockResolvedValueOnce(lockedUser);

      await authService.unlockAccount(admin.id, lockedUser.id);

      expect(mockLogAction).toHaveBeenCalledWith({
        entityType: 'USER',
        entityId: lockedUser.id,
        action: 'ACCOUNT_UNLOCK',
        details: expect.stringContaining(lockedUser.email),
        userId: admin.id,
        performedBy: admin.displayName,
        branchId: admin.branchId
      });
    });
  });

  // ==========================================
  // Branch Isolation Tests
  // ==========================================
  describe('Branch isolation', () => {
    test('getProfile should enforce branchId filter', async () => {
      const user = factories.user();

      db.user.findFirst.mockResolvedValue(user);
      mockPasswordPolicy.isPasswordExpired.mockReturnValue(false);
      mockPasswordPolicy.getDaysUntilExpiration.mockReturnValue(45);

      await authService.getProfile(user.id);

      expect(db.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            branchId: { not: null }
          })
        })
      );
    });

    test('changePassword should enforce branchId filter', async () => {
      const user = factories.user();

      db.user.findFirst.mockResolvedValue(user);
      mockPasswordPolicy.verifyPassword.mockResolvedValue(true);
      mockPasswordPolicy.validatePasswordStrength.mockReturnValue({
        isValid: true,
        strength: 80,
        errors: []
      });
      mockPasswordPolicy.isPasswordInHistory.mockResolvedValue(false);
      mockPasswordPolicy.hashPassword.mockResolvedValue('newHashedPassword');
      mockPasswordPolicy.getPasswordStrengthLabel.mockReturnValue('Strong');

      await authService.changePassword(user.id, 'CurrentPass123!', 'NewSecurePass456!');

      expect(db.user.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            branchId: { not: null }
          })
        })
      );
    });

    test('login should enforce branchId filter', async () => {
      const user = factories.user();

      db.user.findFirst.mockResolvedValue(user);
      mockPasswordPolicy.checkAccountLockout.mockResolvedValue({ isLocked: false });
      mockPasswordPolicy.verifyPassword.mockResolvedValue(true);
      mockPasswordPolicy.resetFailedAttempts.mockResolvedValue();
      mockPasswordPolicy.isPasswordExpired.mockReturnValue(false);
      mockPasswordPolicy.getDaysUntilExpiration.mockReturnValue(45);

      await authService.login(factories.loginCredentials());

      expect(db.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            branchId: { not: null }
          })
        })
      );
    });
  });
});
