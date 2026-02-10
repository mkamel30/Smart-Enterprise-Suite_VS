// MFA Service Tests
const { createMockPrismaClient } = require('../helpers/mockPrismaClient');
const mockDb = createMockPrismaClient();
mockDb.user = { 
  findFirst: jest.fn(), 
  findUnique: jest.fn(),
  update: jest.fn(),
  updateMany: jest.fn() 
};

// Mock the logger
jest.mock('../../utils/logger', () => ({
  logAction: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

// Mock the totp utils
const mockGenerateSecret = jest.fn();
const mockGenerateQRCode = jest.fn();
const mockVerifyToken = jest.fn();
const mockGenerateBackupCodes = jest.fn();
const mockEncryptBackupCodes = jest.fn();
const mockValidateBackupCode = jest.fn();
const mockEncrypt = jest.fn();
const mockDecrypt = jest.fn();

jest.mock('../../utils/totp', () => ({
  generateSecret: mockGenerateSecret,
  generateQRCode: mockGenerateQRCode,
  verifyToken: mockVerifyToken,
  generateBackupCodes: mockGenerateBackupCodes,
  encryptBackupCodes: mockEncryptBackupCodes,
  decryptBackupCodes: jest.fn(),
  validateBackupCode: mockValidateBackupCode,
  encrypt: mockEncrypt,
  decrypt: mockDecrypt,
  generateToken: jest.fn()
}));

jest.doMock('../../db', () => mockDb);

const mfaService = require('../../services/mfaService');
const db = require('../../db');

describe('mfaService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock implementations
    mockEncrypt.mockImplementation((text) => `encrypted_${text}`);
    mockDecrypt.mockImplementation((text) => text?.replace('encrypted_', ''));
    mockGenerateSecret.mockReturnValue({
      base32: 'TESTSECRET123456789',
      otpauth_url: 'otpauth://totp/Test?secret=TESTSECRET',
      hex: 'testhex123'
    });
    mockGenerateQRCode.mockResolvedValue('data:image/png;base64,qrcodedata');
    mockGenerateBackupCodes.mockReturnValue([
      { code: 'CODE1', used: false, createdAt: new Date().toISOString() },
      { code: 'CODE2', used: false, createdAt: new Date().toISOString() }
    ]);
    mockEncryptBackupCodes.mockReturnValue('encrypted_backup_codes');
    mockVerifyToken.mockReturnValue(true);
    mockValidateBackupCode.mockReturnValue({ valid: false, codes: null });
  });

  describe('getMFAStatus', () => {
    test('returns MFA status when user exists', async () => {
      db.user.findFirst.mockResolvedValue({
        id: 'user1',
        email: 'test@example.com',
        displayName: 'Test User',
        mfaEnabled: true,
        mfaSetupPending: false
      });

      const result = await mfaService.getMFAStatus('user1');

      expect(result).toEqual({
        enabled: true,
        setupPending: false,
        userId: 'user1',
        email: 'test@example.com'
      });
    });

    test('throws error when user not found', async () => {
      db.user.findFirst.mockResolvedValue(null);

      await expect(mfaService.getMFAStatus('missing')).rejects.toThrow('User not found');
    });

    test('returns false for mfaEnabled when not set', async () => {
      db.user.findFirst.mockResolvedValue({
        id: 'user1',
        email: 'test@example.com',
        displayName: 'Test User'
        // mfaEnabled not defined
      });

      const result = await mfaService.getMFAStatus('user1');

      expect(result.enabled).toBe(false);
      expect(result.setupPending).toBe(false);
    });
  });

  describe('setupMFA', () => {
    test('initiates MFA setup successfully', async () => {
      db.user.findFirst.mockResolvedValue({
        id: 'user1',
        email: 'test@example.com',
        displayName: 'Test User',
        mfaEnabled: false,
        mfaSetupPending: false,
        branchId: 'branch1'
      });
      db.user.updateMany.mockResolvedValue({ count: 1 });

      const result = await mfaService.setupMFA('user1');

      expect(result.setupPending).toBe(true);
      expect(result.qrCode).toBe('data:image/png;base64,qrcodedata');
      expect(result.manualEntryKey).toBe('TESTSECRET123456789');
      expect(mockGenerateSecret).toHaveBeenCalledWith('user1', 'test@example.com');
      expect(db.user.updateMany).toHaveBeenCalledWith({
        where: { id: 'user1', branchId: { not: null } },
        data: {
          mfaTempSecret: 'encrypted_TESTSECRET123456789',
          mfaSetupPending: true
        }
      });
    });

    test('throws error if MFA already enabled', async () => {
      db.user.findFirst.mockResolvedValue({
        id: 'user1',
        email: 'test@example.com',
        displayName: 'Test User',
        mfaEnabled: true,
        mfaSetupPending: false
      });

      await expect(mfaService.setupMFA('user1')).rejects.toThrow('MFA is already enabled');
    });

    test('throws error when user not found', async () => {
      db.user.findFirst.mockResolvedValue(null);

      await expect(mfaService.setupMFA('missing')).rejects.toThrow('User not found');
    });
  });

  describe('verifyAndEnableMFA', () => {
    test('enables MFA successfully with valid token', async () => {
      db.user.findFirst.mockResolvedValue({
        id: 'user1',
        email: 'test@example.com',
        displayName: 'Test User',
        mfaTempSecret: 'encrypted_testsecret',
        mfaSetupPending: true,
        branchId: 'branch1'
      });
      db.user.updateMany.mockResolvedValue({ count: 1 });

      const result = await mfaService.verifyAndEnableMFA('user1', '123456');

      expect(result.success).toBe(true);
      expect(result.backupCodes).toEqual(['CODE1', 'CODE2']);
      expect(mockVerifyToken).toHaveBeenCalledWith('123456', 'testsecret', false);
      expect(db.user.updateMany).toHaveBeenCalledWith({
        where: { id: 'user1', branchId: { not: null } },
        data: {
          mfaSecret: 'encrypted_testsecret',
          mfaRecoveryCodes: 'encrypted_backup_codes',
          mfaEnabled: true,
          mfaSetupPending: false,
          mfaTempSecret: null
        }
      });
    });

    test('throws error when token is missing', async () => {
      await expect(mfaService.verifyAndEnableMFA('user1', null)).rejects.toThrow('Verification token is required');
      await expect(mfaService.verifyAndEnableMFA('user1', '')).rejects.toThrow('Verification token is required');
    });

    test('throws error when user not found', async () => {
      db.user.findFirst.mockResolvedValue(null);

      await expect(mfaService.verifyAndEnableMFA('user1', '123456')).rejects.toThrow('User not found');
    });

    test('throws error when setup not initiated', async () => {
      db.user.findFirst.mockResolvedValue({
        id: 'user1',
        email: 'test@example.com',
        mfaSetupPending: false
      });

      await expect(mfaService.verifyAndEnableMFA('user1', '123456')).rejects.toThrow('MFA setup not initiated');
    });

    test('throws error when temp secret is missing', async () => {
      db.user.findFirst.mockResolvedValue({
        id: 'user1',
        email: 'test@example.com',
        mfaSetupPending: true,
        mfaTempSecret: null
      });

      await expect(mfaService.verifyAndEnableMFA('user1', '123456')).rejects.toThrow('MFA setup not initiated');
    });

    test('throws error when token is invalid', async () => {
      db.user.findFirst.mockResolvedValue({
        id: 'user1',
        email: 'test@example.com',
        mfaTempSecret: 'encrypted_testsecret',
        mfaSetupPending: true
      });
      mockVerifyToken.mockReturnValue(false);

      await expect(mfaService.verifyAndEnableMFA('user1', '000000')).rejects.toThrow('Invalid verification code');
    });
  });

  describe('disableMFA', () => {
    test('disables MFA successfully with valid TOTP token', async () => {
      db.user.findFirst.mockResolvedValue({
        id: 'user1',
        email: 'test@example.com',
        displayName: 'Test User',
        mfaEnabled: true,
        mfaSecret: 'encrypted_secret',
        mfaRecoveryCodes: 'encrypted_codes',
        password: 'hashedpassword',
        branchId: 'branch1'
      });
      db.user.updateMany.mockResolvedValue({ count: 1 });
      mockVerifyToken.mockReturnValue(true);

      const result = await mfaService.disableMFA('user1', '123456');

      expect(result.success).toBe(true);
      expect(db.user.updateMany).toHaveBeenCalledWith({
        where: { id: 'user1', branchId: { not: null } },
        data: {
          mfaEnabled: false,
          mfaSecret: null,
          mfaRecoveryCodes: null,
          mfaTempSecret: null,
          mfaSetupPending: false
        }
      });
    });

    test('disables MFA successfully with valid backup code', async () => {
      db.user.findFirst.mockResolvedValue({
        id: 'user1',
        email: 'test@example.com',
        displayName: 'Test User',
        mfaEnabled: true,
        mfaSecret: 'encrypted_secret',
        mfaRecoveryCodes: 'encrypted_codes',
        password: 'hashedpassword',
        branchId: 'branch1'
      });
      db.user.updateMany.mockResolvedValue({ count: 1 });
      mockVerifyToken.mockReturnValue(false);
      mockValidateBackupCode.mockReturnValue({
        valid: true,
        codes: [{ code: 'BACKUP1', used: true, usedAt: new Date().toISOString() }]
      });

      const result = await mfaService.disableMFA('user1', 'BACKUP1');

      expect(result.success).toBe(true);
    });

    test('throws error when token is missing', async () => {
      await expect(mfaService.disableMFA('user1', null)).rejects.toThrow('Verification token or backup code is required');
    });

    test('throws error when user not found', async () => {
      db.user.findFirst.mockResolvedValue(null);

      await expect(mfaService.disableMFA('user1', '123456')).rejects.toThrow('User not found');
    });

    test('throws error when MFA not enabled', async () => {
      db.user.findFirst.mockResolvedValue({
        id: 'user1',
        email: 'test@example.com',
        mfaEnabled: false
      });

      await expect(mfaService.disableMFA('user1', '123456')).rejects.toThrow('MFA is not enabled');
    });

    test('throws error when token is invalid', async () => {
      db.user.findFirst.mockResolvedValue({
        id: 'user1',
        email: 'test@example.com',
        mfaEnabled: true,
        mfaSecret: 'encrypted_secret',
        mfaRecoveryCodes: 'encrypted_codes'
      });
      mockVerifyToken.mockReturnValue(false);
      mockValidateBackupCode.mockReturnValue({ valid: false, codes: null });

      await expect(mfaService.disableMFA('user1', '000000')).rejects.toThrow('Invalid verification code or backup code');
    });
  });

  describe('verifyMFALogin', () => {
    test('verifies login successfully with TOTP', async () => {
      db.user.findFirst.mockResolvedValue({
        id: 'user1',
        email: 'test@example.com',
        displayName: 'Test User',
        mfaEnabled: true,
        mfaSecret: 'encrypted_secret',
        mfaRecoveryCodes: 'encrypted_codes',
        branchId: 'branch1'
      });
      mockVerifyToken.mockReturnValue(true);

      const result = await mfaService.verifyMFALogin('user1', '123456');

      expect(result.verified).toBe(true);
      expect(result.method).toBe('totp');
    });

    test('verifies login successfully with backup code', async () => {
      db.user.findFirst.mockResolvedValue({
        id: 'user1',
        email: 'test@example.com',
        displayName: 'Test User',
        mfaEnabled: true,
        mfaSecret: 'encrypted_secret',
        mfaRecoveryCodes: 'encrypted_codes',
        branchId: 'branch1'
      });
      mockVerifyToken.mockReturnValue(false);
      mockValidateBackupCode.mockReturnValue({
        valid: true,
        codes: [{ code: 'BACKUP1', used: true }]
      });

      const result = await mfaService.verifyMFALogin('user1', 'BACKUP1');

      expect(result.verified).toBe(true);
      expect(result.method).toBe('backup');
    });

    test('returns verified for user without MFA', async () => {
      db.user.findFirst.mockResolvedValue({
        id: 'user1',
        email: 'test@example.com',
        mfaEnabled: false
      });

      const result = await mfaService.verifyMFALogin('user1', '123456');

      expect(result.verified).toBe(true);
      expect(result.method).toBe('none');
    });

    test('throws error when token is missing', async () => {
      await expect(mfaService.verifyMFALogin('user1', null)).rejects.toThrow('MFA token is required');
    });

    test('throws error when user not found', async () => {
      db.user.findFirst.mockResolvedValue(null);

      await expect(mfaService.verifyMFALogin('user1', '123456')).rejects.toThrow('User not found');
    });

    test('throws error when both TOTP and backup code are invalid', async () => {
      db.user.findFirst.mockResolvedValue({
        id: 'user1',
        email: 'test@example.com',
        displayName: 'Test User',
        mfaEnabled: true,
        mfaSecret: 'encrypted_secret',
        mfaRecoveryCodes: 'encrypted_codes'
      });
      mockVerifyToken.mockReturnValue(false);
      mockValidateBackupCode.mockReturnValue({ valid: false, codes: null });

      await expect(mfaService.verifyMFALogin('user1', '000000')).rejects.toThrow('Invalid MFA code or backup code');
    });
  });

  describe('generateRecoveryCodes', () => {
    test('generates new recovery codes successfully', async () => {
      db.user.findFirst.mockResolvedValue({
        id: 'user1',
        email: 'test@example.com',
        displayName: 'Test User',
        mfaEnabled: true,
        mfaSecret: 'encrypted_secret',
        branchId: 'branch1'
      });
      db.user.updateMany.mockResolvedValue({ count: 1 });

      const result = await mfaService.generateRecoveryCodes('user1', '123456');

      expect(result.success).toBe(true);
      expect(result.backupCodes).toEqual(['CODE1', 'CODE2']);
    });

    test('throws error when token is missing', async () => {
      await expect(mfaService.generateRecoveryCodes('user1', null)).rejects.toThrow('Current TOTP token is required');
    });

    test('throws error when user not found', async () => {
      db.user.findFirst.mockResolvedValue(null);

      await expect(mfaService.generateRecoveryCodes('user1', '123456')).rejects.toThrow('User not found');
    });

    test('throws error when MFA not enabled', async () => {
      db.user.findFirst.mockResolvedValue({
        id: 'user1',
        email: 'test@example.com',
        mfaEnabled: false
      });

      await expect(mfaService.generateRecoveryCodes('user1', '123456')).rejects.toThrow('MFA is not enabled');
    });

    test('throws error when token is invalid', async () => {
      db.user.findFirst.mockResolvedValue({
        id: 'user1',
        email: 'test@example.com',
        mfaEnabled: true,
        mfaSecret: 'encrypted_secret'
      });
      mockVerifyToken.mockReturnValue(false);

      await expect(mfaService.generateRecoveryCodes('user1', '000000')).rejects.toThrow('Invalid verification code');
    });
  });

  describe('validateRecoveryCode', () => {
    test('validates recovery code successfully', async () => {
      db.user.findFirst.mockResolvedValue({
        id: 'user1',
        email: 'test@example.com',
        displayName: 'Test User',
        mfaEnabled: true,
        mfaRecoveryCodes: 'encrypted_codes',
        branchId: 'branch1'
      });
      db.user.updateMany.mockResolvedValue({ count: 1 });
      mockValidateBackupCode.mockReturnValue({
        valid: true,
        codes: [{ code: 'RECOVERY1', used: true, usedAt: new Date().toISOString() }]
      });

      const result = await mfaService.validateRecoveryCode('user1', 'RECOVERY1');

      expect(result.valid).toBe(true);
    });

    test('throws error when code is missing', async () => {
      await expect(mfaService.validateRecoveryCode('user1', null)).rejects.toThrow('Recovery code is required');
    });

    test('throws error when user not found', async () => {
      db.user.findFirst.mockResolvedValue(null);

      await expect(mfaService.validateRecoveryCode('user1', 'RECOVERY1')).rejects.toThrow('Invalid recovery code');
    });

    test('throws error when MFA not enabled', async () => {
      db.user.findFirst.mockResolvedValue({
        id: 'user1',
        email: 'test@example.com',
        mfaEnabled: false
      });

      await expect(mfaService.validateRecoveryCode('user1', 'RECOVERY1')).rejects.toThrow('Invalid recovery code');
    });

    test('throws error when recovery code is invalid', async () => {
      db.user.findFirst.mockResolvedValue({
        id: 'user1',
        email: 'test@example.com',
        mfaEnabled: true,
        mfaRecoveryCodes: 'encrypted_codes'
      });
      mockValidateBackupCode.mockReturnValue({ valid: false, codes: null });

      await expect(mfaService.validateRecoveryCode('user1', 'INVALID')).rejects.toThrow('Invalid recovery code');
    });
  });

  describe('requiresMFA', () => {
    test('returns MFA required when enabled', async () => {
      db.user.findFirst.mockResolvedValue({
        id: 'user1',
        mfaEnabled: true
      });

      const result = await mfaService.requiresMFA('user1');

      expect(result.required).toBe(true);
      expect(result.userId).toBe('user1');
    });

    test('returns MFA not required when disabled', async () => {
      db.user.findFirst.mockResolvedValue({
        id: 'user1',
        mfaEnabled: false
      });

      const result = await mfaService.requiresMFA('user1');

      expect(result.required).toBe(false);
      expect(result.userId).toBe('user1');
    });

    test('throws error when user not found', async () => {
      db.user.findFirst.mockResolvedValue(null);

      await expect(mfaService.requiresMFA('missing')).rejects.toThrow('User not found');
    });
  });

  // Security tests
  describe('Security Tests', () => {
    test('setupMFA should not overwrite existing enabled MFA', async () => {
      db.user.findFirst.mockResolvedValue({
        id: 'user1',
        email: 'test@example.com',
        displayName: 'Test User',
        mfaEnabled: true
      });

      await expect(mfaService.setupMFA('user1')).rejects.toThrow('MFA is already enabled');
    });

    test('verifyAndEnableMFA should clear temp secret after enabling', async () => {
      db.user.findFirst.mockResolvedValue({
        id: 'user1',
        email: 'test@example.com',
        displayName: 'Test User',
        mfaTempSecret: 'encrypted_secret',
        mfaSetupPending: true,
        branchId: 'branch1'
      });
      db.user.updateMany.mockResolvedValue({ count: 1 });

      await mfaService.verifyAndEnableMFA('user1', '123456');

      const updateCall = db.user.updateMany.mock.calls[0];
      expect(updateCall[0].data.mfaTempSecret).toBeNull();
      expect(updateCall[0].data.mfaSetupPending).toBe(false);
    });

    test('disableMFA should clear all MFA fields', async () => {
      db.user.findFirst.mockResolvedValue({
        id: 'user1',
        email: 'test@example.com',
        mfaEnabled: true,
        mfaSecret: 'encrypted_secret',
        mfaRecoveryCodes: 'encrypted_codes',
        branchId: 'branch1'
      });
      db.user.updateMany.mockResolvedValue({ count: 1 });
      mockVerifyToken.mockReturnValue(true);

      await mfaService.disableMFA('user1', '123456');

      const updateCall = db.user.updateMany.mock.calls[0];
      expect(updateCall[0].data.mfaEnabled).toBe(false);
      expect(updateCall[0].data.mfaSecret).toBeNull();
      expect(updateCall[0].data.mfaRecoveryCodes).toBeNull();
      expect(updateCall[0].data.mfaTempSecret).toBeNull();
      expect(updateCall[0].data.mfaSetupPending).toBe(false);
    });

    test('backup codes should be marked as used after consumption', async () => {
      const usedCodes = [{ code: 'CODE1', used: true, usedAt: '2026-01-31T00:00:00Z' }];
      db.user.findFirst.mockResolvedValue({
        id: 'user1',
        email: 'test@example.com',
        displayName: 'Test User',
        mfaEnabled: true,
        mfaRecoveryCodes: 'encrypted_codes',
        branchId: 'branch1'
      });
      db.user.updateMany.mockResolvedValue({ count: 1 });
      mockValidateBackupCode.mockReturnValue({ valid: true, codes: usedCodes });
      mockEncryptBackupCodes.mockReturnValue('encrypted_used_codes');

      await mfaService.validateRecoveryCode('user1', 'CODE1');

      expect(mockEncryptBackupCodes).toHaveBeenCalledWith(usedCodes);
    });

    test('decrypt should handle decryption failures gracefully', async () => {
      mockDecrypt.mockImplementation(() => {
        throw new Error('Decryption failed');
      });

      db.user.findFirst.mockResolvedValue({
        id: 'user1',
        email: 'test@example.com',
        displayName: 'Test User',
        mfaTempSecret: 'invalid_encrypted_data',
        mfaSetupPending: true
      });

      await expect(mfaService.verifyAndEnableMFA('user1', '123456'))
        .rejects.toThrow('Decryption failed');
    });
  });
});
