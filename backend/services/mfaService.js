const db = require('../db');
const { logAction } = require('../utils/logger');
const { 
  generateSecret, 
  generateQRCode, 
  verifyToken, 
  generateBackupCodes, 
  encryptBackupCodes,
  validateBackupCode,
  encrypt,
  decrypt
} = require('../utils/totp');
const { AppError, ForbiddenError, UnauthorizedError } = require('../utils/errorHandler');

/**
 * Get MFA status for a user
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - MFA status object
 */
async function getMFAStatus(userId) {
  const user = await db.user.findFirst({
    where: { id: userId, branchId: { not: null } },
    select: {
      id: true,
      email: true,
      displayName: true,
      mfaEnabled: true,
      mfaSetupPending: true
    }
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  return {
    enabled: user.mfaEnabled || false,
    setupPending: user.mfaSetupPending || false,
    userId: user.id,
    email: user.email
  };
}

/**
 * Initialize MFA setup for a user
 * Generates a secret and returns QR code for authenticator app setup
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Setup data including QR code and manual entry key
 */
async function setupMFA(userId) {
  const user = await db.user.findFirst({
    where: { id: userId, branchId: { not: null } },
    select: {
      id: true,
      email: true,
      displayName: true,
      mfaEnabled: true,
      mfaSetupPending: true
    }
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Check if MFA is already enabled
  if (user.mfaEnabled) {
    throw new AppError('MFA is already enabled for this user. Disable it first to reconfigure.', 400);
  }

  // Generate new secret
  const secret = generateSecret(userId, user.email || user.displayName || 'User');

  // Encrypt and store as temporary secret
  const encryptedTempSecret = encrypt(secret.base32);

  // Update user with temporary secret
  await db.user.updateMany({
    where: { id: userId, branchId: { not: null } },
    data: {
      mfaTempSecret: encryptedTempSecret,
      mfaSetupPending: true
    }
  });

  // Generate QR code
  const qrCodeDataUrl = await generateQRCode(secret.otpauth_url);

  await logAction({
    entityType: 'USER',
    entityId: userId,
    action: 'MFA_SETUP_INITIATED',
    details: 'User initiated MFA setup',
    userId: userId,
    performedBy: user.displayName,
    branchId: user.branchId
  });

  return {
    qrCode: qrCodeDataUrl,
    manualEntryKey: secret.base32,
    setupPending: true,
    message: 'Scan the QR code with your authenticator app, then verify the setup'
  };
}

/**
 * Verify MFA setup and enable MFA for user
 * @param {string} userId - User ID
 * @param {string} token - TOTP token from authenticator app
 * @returns {Promise<Object>} - Result with backup codes
 */
async function verifyAndEnableMFA(userId, token) {
  if (!token) {
    throw new AppError('Verification token is required', 400);
  }

  const user = await db.user.findFirst({
    where: { id: userId, branchId: { not: null } },
    select: {
      id: true,
      email: true,
      displayName: true,
      mfaTempSecret: true,
      mfaSetupPending: true,
      branchId: true
    }
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (!user.mfaSetupPending || !user.mfaTempSecret) {
    throw new AppError('MFA setup not initiated. Please start setup first.', 400);
  }

  // Decrypt temporary secret
  const tempSecret = decrypt(user.mfaTempSecret);
  if (!tempSecret) {
    throw new AppError('Failed to decrypt MFA secret. Please restart setup.', 500);
  }

  // Verify the token
  const isValid = verifyToken(token, tempSecret, false);
  if (!isValid) {
    throw new AppError('Invalid verification code. Please try again.', 400);
  }

  // Generate backup codes
  const backupCodes = generateBackupCodes(10);
  const encryptedBackupCodes = encryptBackupCodes(backupCodes);

  // Enable MFA
  await db.user.updateMany({
    where: { id: userId, branchId: { not: null } },
    data: {
      mfaSecret: user.mfaTempSecret,
      mfaRecoveryCodes: encryptedBackupCodes,
      mfaEnabled: true,
      mfaSetupPending: false,
      mfaTempSecret: null
    }
  });

  await logAction({
    entityType: 'USER',
    entityId: userId,
    action: 'MFA_ENABLED',
    details: 'User successfully enabled MFA',
    userId: userId,
    performedBy: user.displayName,
    branchId: user.branchId
  });

  // Return backup codes (only shown once!)
  return {
    success: true,
    message: 'MFA has been successfully enabled',
    backupCodes: backupCodes.map(c => c.code),
    warning: 'Save these backup codes in a secure location. They will only be shown once!'
  };
}

/**
 * Disable MFA for a user
 * @param {string} userId - User ID
 * @param {string} token - Current TOTP token or backup code for verification
 * @param {string} password - User password for additional verification
 * @returns {Promise<Object>} - Result
 */
async function disableMFA(userId, token, password) {
  if (!token) {
    throw new AppError('Verification token or backup code is required', 400);
  }

  const user = await db.user.findFirst({
    where: { id: userId, branchId: { not: null } },
    select: {
      id: true,
      email: true,
      displayName: true,
      mfaEnabled: true,
      mfaSecret: true,
      mfaRecoveryCodes: true,
      password: true,
      branchId: true
    }
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (!user.mfaEnabled) {
    throw new AppError('MFA is not enabled for this user', 400);
  }

  // Verify the token (TOTP or backup code)
  let verified = false;
  let isBackupCode = false;

  // Try TOTP verification first
  if (user.mfaSecret) {
    verified = verifyToken(token, user.mfaSecret, true);
  }

  // If TOTP failed, try backup code
  if (!verified && user.mfaRecoveryCodes) {
    const backupResult = validateBackupCode(token, user.mfaRecoveryCodes);
    if (backupResult.valid) {
      verified = true;
      isBackupCode = true;
      
      // Update used backup codes
      await db.user.updateMany({
        where: { id: userId, branchId: { not: null } },
        data: {
          mfaRecoveryCodes: encryptBackupCodes(backupResult.codes)
        }
      });
    }
  }

  if (!verified) {
    throw new AppError('Invalid verification code or backup code', 401);
  }

  // Disable MFA
  await db.user.updateMany({
    where: { id: userId, branchId: { not: null } },
    data: {
      mfaEnabled: false,
      mfaSecret: null,
      mfaRecoveryCodes: null,
      mfaTempSecret: null,
      mfaSetupPending: false
    }
  });

  await logAction({
    entityType: 'USER',
    entityId: userId,
    action: 'MFA_DISABLED',
    details: `User disabled MFA using ${isBackupCode ? 'backup code' : 'TOTP token'}`,
    userId: userId,
    performedBy: user.displayName,
    branchId: user.branchId
  });

  return {
    success: true,
    message: 'MFA has been successfully disabled'
  };
}

/**
 * Verify MFA during login
 * @param {string} userId - User ID
 * @param {string} token - TOTP token from authenticator app or backup code
 * @returns {Promise<Object>} - Verification result
 */
async function verifyMFALogin(userId, token) {
  if (!token) {
    throw new AppError('MFA token is required', 400);
  }

  const user = await db.user.findFirst({
    where: { id: userId, branchId: { not: null } },
    select: {
      id: true,
      email: true,
      displayName: true,
      mfaEnabled: true,
      mfaSecret: true,
      mfaRecoveryCodes: true,
      branchId: true
    }
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (!user.mfaEnabled) {
    return { verified: true, method: 'none' };
  }

  // Try TOTP verification
  if (user.mfaSecret) {
    const isValid = verifyToken(token, user.mfaSecret, true);
    if (isValid) {
      await logAction({
        entityType: 'USER',
        entityId: userId,
        action: 'MFA_LOGIN_SUCCESS',
        details: 'User logged in with MFA (TOTP)',
        userId: userId,
        performedBy: user.displayName,
        branchId: user.branchId
      });
      return { verified: true, method: 'totp' };
    }
  }

  // Try backup code verification
  if (user.mfaRecoveryCodes) {
    const backupResult = validateBackupCode(token, user.mfaRecoveryCodes);
    if (backupResult.valid) {
      // Update used backup codes
      await db.user.updateMany({
        where: { id: userId, branchId: { not: null } },
        data: {
          mfaRecoveryCodes: encryptBackupCodes(backupResult.codes)
        }
      });

      await logAction({
        entityType: 'USER',
        entityId: userId,
        action: 'MFA_LOGIN_SUCCESS',
        details: 'User logged in with MFA (backup code)',
        userId: userId,
        performedBy: user.displayName,
        branchId: user.branchId
      });

      return { verified: true, method: 'backup' };
    }
  }

  await logAction({
    entityType: 'USER',
    entityId: userId,
    action: 'MFA_LOGIN_FAILED',
    details: 'User failed MFA verification during login',
    userId: userId,
    performedBy: user.displayName,
    branchId: user.branchId
  });

  throw new UnauthorizedError('Invalid MFA code or backup code');
}

/**
 * Generate new recovery codes
 * @param {string} userId - User ID
 * @param {string} token - Current TOTP token for verification
 * @returns {Promise<Object>} - New recovery codes
 */
async function generateRecoveryCodes(userId, token) {
  if (!token) {
    throw new AppError('Current TOTP token is required', 400);
  }

  const user = await db.user.findFirst({
    where: { id: userId, branchId: { not: null } },
    select: {
      id: true,
      email: true,
      displayName: true,
      mfaEnabled: true,
      mfaSecret: true,
      branchId: true
    }
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (!user.mfaEnabled) {
    throw new AppError('MFA is not enabled', 400);
  }

  // Verify the token
  const isValid = verifyToken(token, user.mfaSecret, true);
  if (!isValid) {
    throw new AppError('Invalid verification code', 401);
  }

  // Generate new backup codes
  const backupCodes = generateBackupCodes(10);
  const encryptedBackupCodes = encryptBackupCodes(backupCodes);

  // Update user
  await db.user.updateMany({
    where: { id: userId, branchId: { not: null } },
    data: {
      mfaRecoveryCodes: encryptedBackupCodes
    }
  });

  await logAction({
    entityType: 'USER',
    entityId: userId,
    action: 'MFA_RECOVERY_CODES_GENERATED',
    details: 'User generated new MFA recovery codes',
    userId: userId,
    performedBy: user.displayName,
    branchId: user.branchId
  });

  return {
    success: true,
    backupCodes: backupCodes.map(c => c.code),
    warning: 'Save these backup codes in a secure location. They will only be shown once!'
  };
}

/**
 * Validate a backup code for account recovery
 * @param {string} userId - User ID
 * @param {string} code - Backup code to validate
 * @returns {Promise<Object>} - Validation result
 */
async function validateRecoveryCode(userId, code) {
  if (!code) {
    throw new AppError('Recovery code is required', 400);
  }

  const user = await db.user.findFirst({
    where: { id: userId, branchId: { not: null } },
    select: {
      id: true,
      email: true,
      displayName: true,
      mfaEnabled: true,
      mfaRecoveryCodes: true,
      branchId: true
    }
  });

  if (!user || !user.mfaEnabled || !user.mfaRecoveryCodes) {
    throw new AppError('Invalid recovery code', 401);
  }

  const result = validateBackupCode(code, user.mfaRecoveryCodes);
  
  if (!result.valid) {
    await logAction({
      entityType: 'USER',
      entityId: userId,
      action: 'MFA_RECOVERY_FAILED',
      details: 'Invalid recovery code attempt',
      userId: userId,
      performedBy: user.displayName,
      branchId: user.branchId
    });
    throw new UnauthorizedError('Invalid recovery code');
  }

  // Update used backup codes
  await db.user.updateMany({
    where: { id: userId, branchId: { not: null } },
    data: {
      mfaRecoveryCodes: encryptBackupCodes(result.codes)
    }
  });

  await logAction({
    entityType: 'USER',
    entityId: userId,
    action: 'MFA_RECOVERY_SUCCESS',
    details: 'User successfully used recovery code',
    userId: userId,
    performedBy: user.displayName,
    branchId: user.branchId
  });

  return {
    valid: true,
    message: 'Recovery code validated successfully'
  };
}

/**
 * Check if user requires MFA verification
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - MFA requirement status
 */
async function requiresMFA(userId) {
  const user = await db.user.findFirst({
    where: { id: userId, branchId: { not: null } },
    select: {
      id: true,
      mfaEnabled: true
    }
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  return {
    required: user.mfaEnabled || false,
    userId: user.id
  };
}

module.exports = {
  getMFAStatus,
  setupMFA,
  verifyAndEnableMFA,
  disableMFA,
  verifyMFALogin,
  generateRecoveryCodes,
  validateRecoveryCode,
  requiresMFA
};
