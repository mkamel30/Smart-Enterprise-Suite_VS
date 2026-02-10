const bcrypt = require('bcryptjs');
const db = require('../db');
const logger = require('./logger');

// Password Policy Configuration
const PASSWORD_POLICY = {
  minLength: 12,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  specialChars: '!@#$%^&*()_+-=[]{}|;:,.<>?',
  maxAgeDays: 90, // Password expires after 90 days
  historyCount: 5, // Cannot reuse last 5 passwords
  maxFailedAttempts: 5, // Lock account after 5 failed attempts
  lockoutDurationMinutes: 30, // Lock account for 30 minutes
};

// Common weak passwords to reject
const COMMON_PASSWORDS = [
  'password', '123456', '12345678', 'qwerty', 'abc123',
  'password123', 'admin', 'letmein', 'welcome', 'monkey',
  '123456789', 'football', 'iloveyou', 'admin123', 'welcome123',
  'password1', '123123', '987654321', 'qwertyuiop', 'mypass',
  '123qwe', 'qwe123', 'password!', 'pass123', 'login123'
];

/**
 * Validate password strength against policy
 * @param {string} password - The password to validate
 * @returns {Object} - { isValid: boolean, errors: string[], strength: number }
 */
function validatePasswordStrength(password) {
  const errors = [];
  let strength = 0;

  // Check minimum length
  if (password.length < PASSWORD_POLICY.minLength) {
    errors.push(`Password must be at least ${PASSWORD_POLICY.minLength} characters long`);
  } else {
    strength += 1;
  }

  // Check maximum length
  if (password.length > PASSWORD_POLICY.maxLength) {
    errors.push(`Password must not exceed ${PASSWORD_POLICY.maxLength} characters`);
  }

  // Check for uppercase letters
  if (PASSWORD_POLICY.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter (A-Z)');
  } else if (PASSWORD_POLICY.requireUppercase) {
    strength += 1;
  }

  // Check for lowercase letters
  if (PASSWORD_POLICY.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter (a-z)');
  } else if (PASSWORD_POLICY.requireLowercase) {
    strength += 1;
  }

  // Check for numbers
  if (PASSWORD_POLICY.requireNumbers && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number (0-9)');
  } else if (PASSWORD_POLICY.requireNumbers) {
    strength += 1;
  }

  // Check for special characters
  if (PASSWORD_POLICY.requireSpecialChars) {
    const specialCharRegex = new RegExp(`[${PASSWORD_POLICY.specialChars.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]`);
    if (!specialCharRegex.test(password)) {
      errors.push(`Password must contain at least one special character (${PASSWORD_POLICY.specialChars})`);
    } else {
      strength += 1;
    }
  }

  // Check for common passwords
  const lowerPassword = password.toLowerCase();
  if (COMMON_PASSWORDS.includes(lowerPassword)) {
    errors.push('Password is too common and easily guessable');
  }

  // Check for repetitive characters (e.g., aaa, 111)
  if (/([a-zA-Z0-9])\1{3,}/.test(password)) {
    errors.push('Password cannot contain repetitive characters (e.g., "aaa", "111")');
  }

  // Check for sequential characters
  if (/(012|123|234|345|456|567|678|789|890|abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)/i.test(password)) {
    errors.push('Password cannot contain sequential characters (e.g., "123", "abc")');
  }

  // Calculate strength score (0-5)
  const maxStrength = 5;
  const strengthPercentage = Math.round((strength / maxStrength) * 100);

  return {
    isValid: errors.length === 0,
    errors,
    strength: strengthPercentage,
    meetsPolicy: errors.length === 0
  };
}

/**
 * Get password strength label
 * @param {number} strength - Strength percentage (0-100)
 * @returns {string} - Strength label
 */
function getPasswordStrengthLabel(strength) {
  if (strength >= 80) return 'Strong';
  if (strength >= 60) return 'Good';
  if (strength >= 40) return 'Fair';
  if (strength >= 20) return 'Weak';
  return 'Very Weak';
}

/**
 * Hash password with bcrypt
 * @param {string} password - Plain text password
 * @returns {Promise<string>} - Hashed password
 */
async function hashPassword(password) {
  const saltRounds = 12; // Higher is more secure but slower
  return bcrypt.hash(password, saltRounds);
}

/**
 * Verify password against hash
 * @param {string} password - Plain text password
 * @param {string} hash - Hashed password
 * @returns {Promise<boolean>} - True if password matches
 */
async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * Check if password is in user's history (prevent reuse)
 * @param {string} userId - User ID
 * @param {string} newPassword - New password to check
 * @returns {Promise<boolean>} - True if password was used before
 */
async function isPasswordInHistory(userId, newPassword) {
  try {
    // Get user's password history
    const history = await db.passwordHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: PASSWORD_POLICY.historyCount
    });

    // Check if new password matches any in history
    for (const record of history) {
      const isMatch = await bcrypt.compare(newPassword, record.passwordHash);
      if (isMatch) {
        return true;
      }
    }

    return false;
  } catch (error) {
    logger.error({ error, userId }, 'Error checking password history');
    return false; // Fail open to allow password change in case of error
  }
}

/**
 * Save password to user's history
 * @param {string} userId - User ID
 * @param {string} passwordHash - Hashed password
 * @returns {Promise<void>}
 */
async function savePasswordToHistory(userId, passwordHash) {
  try {
    await db.passwordHistory.create({
      data: {
        userId,
        passwordHash,
        createdAt: new Date()
      }
    });

    // Clean up old history entries (keep only last N)
    const historyRecords = await db.passwordHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: PASSWORD_POLICY.historyCount
    });

    for (const record of historyRecords) {
      await db.passwordHistory.delete({
        where: { id: record.id }
      });
    }
  } catch (error) {
    logger.error({ error, userId }, 'Error saving password to history');
  }
}

/**
 * Check if password has expired
 * @param {Date} lastPasswordChange - Date of last password change
 * @returns {boolean} - True if password has expired
 */
function isPasswordExpired(lastPasswordChange) {
  if (!lastPasswordChange) return true;

  const expirationDate = new Date(lastPasswordChange);
  expirationDate.setDate(expirationDate.getDate() + PASSWORD_POLICY.maxAgeDays);

  return new Date() > expirationDate;
}

/**
 * Get days until password expires
 * @param {Date} lastPasswordChange - Date of last password change
 * @returns {number} - Days until expiration (negative if expired)
 */
function getDaysUntilExpiration(lastPasswordChange) {
  if (!lastPasswordChange) return -1;

  const expirationDate = new Date(lastPasswordChange);
  expirationDate.setDate(expirationDate.getDate() + PASSWORD_POLICY.maxAgeDays);

  const diffTime = expirationDate - new Date();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}

/**
 * Record failed login attempt
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Updated lockout info
 */
async function recordFailedAttempt(userId) {
  try {
    const lockoutInfo = await db.accountLockout.findUnique({
      where: { userId }
    });

    const now = new Date();

    if (!lockoutInfo) {
      // First failed attempt
      await db.accountLockout.create({
        data: {
          userId,
          failedAttempts: 1,
          lastFailedAttempt: now,
          lockedUntil: null
        }
      });
      return { isLocked: false, remainingAttempts: PASSWORD_POLICY.maxFailedAttempts - 1 };
    }

    // Check if currently locked
    if (lockoutInfo.lockedUntil && new Date() < new Date(lockoutInfo.lockedUntil)) {
      return {
        isLocked: true,
        lockedUntil: lockoutInfo.lockedUntil,
        remainingAttempts: 0
      };
    }

    // Reset if lockout period has passed
    if (lockoutInfo.lockedUntil && new Date() >= new Date(lockoutInfo.lockedUntil)) {
      await db.accountLockout.update({
        where: { userId },
        data: {
          failedAttempts: 1,
          lastFailedAttempt: now,
          lockedUntil: null
        }
      });
      return { isLocked: false, remainingAttempts: PASSWORD_POLICY.maxFailedAttempts - 1 };
    }

    // Increment failed attempts
    const newAttempts = lockoutInfo.failedAttempts + 1;

    if (newAttempts >= PASSWORD_POLICY.maxFailedAttempts) {
      // Lock account
      const lockedUntil = new Date();
      lockedUntil.setMinutes(lockedUntil.getMinutes() + PASSWORD_POLICY.lockoutDurationMinutes);

      await db.accountLockout.update({
        where: { userId },
        data: {
          failedAttempts: newAttempts,
          lastFailedAttempt: now,
          lockedUntil
        }
      });

      logger.warn({ userId, lockedUntil }, 'Account locked due to failed login attempts');

      return {
        isLocked: true,
        lockedUntil,
        remainingAttempts: 0
      };
    }

    // Just increment counter
    await db.accountLockout.update({
      where: { userId },
      data: {
        failedAttempts: newAttempts,
        lastFailedAttempt: now
      }
    });

    return {
      isLocked: false,
      remainingAttempts: PASSWORD_POLICY.maxFailedAttempts - newAttempts
    };
  } catch (error) {
    logger.error({ error, userId }, 'Error recording failed attempt');
    return { isLocked: false, remainingAttempts: 0 };
  }
}

/**
 * Reset failed attempts on successful login
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
async function resetFailedAttempts(userId) {
  try {
    // Use upsert to handle case where record doesn't exist
    await db.accountLockout.upsert({
      where: { userId },
      update: {
        failedAttempts: 0,
        lastFailedAttempt: null,
        lockedUntil: null
      },
      create: {
        userId,
        failedAttempts: 0,
        lastFailedAttempt: null,
        lockedUntil: null
      }
    });
  } catch (error) {
    logger.error({ error, userId }, 'Error resetting failed attempts');
  }
}

/**
 * Check if account is locked
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Lockout status
 */
async function checkAccountLockout(userId) {
  try {
    const lockoutInfo = await db.accountLockout.findUnique({
      where: { userId }
    });

    if (!lockoutInfo) {
      return { isLocked: false, remainingAttempts: PASSWORD_POLICY.maxFailedAttempts };
    }

    // Check if lockout has expired
    if (lockoutInfo.lockedUntil && new Date() >= new Date(lockoutInfo.lockedUntil)) {
      // Auto-unlock account
      await db.accountLockout.update({
        where: { userId },
        data: {
          failedAttempts: 0,
          lastFailedAttempt: null,
          lockedUntil: null
        }
      });
      return { isLocked: false, remainingAttempts: PASSWORD_POLICY.maxFailedAttempts };
    }

    if (lockoutInfo.lockedUntil) {
      return {
        isLocked: true,
        lockedUntil: lockoutInfo.lockedUntil,
        remainingAttempts: 0
      };
    }

    return {
      isLocked: false,
      remainingAttempts: PASSWORD_POLICY.maxFailedAttempts - lockoutInfo.failedAttempts
    };
  } catch (error) {
    logger.error({ error, userId }, 'Error checking account lockout');
    return { isLocked: false, remainingAttempts: PASSWORD_POLICY.maxFailedAttempts };
  }
}

/**
 * Get password policy configuration
 * @returns {Object} - Policy configuration
 */
function getPasswordPolicy() {
  return {
    ...PASSWORD_POLICY,
    strengthLabels: {
      veryWeak: 'Very Weak',
      weak: 'Weak',
      fair: 'Fair',
      good: 'Good',
      strong: 'Strong'
    }
  };
}

/**
 * Generate secure random password
 * @param {number} length - Password length (default: 16)
 * @returns {string} - Generated password
 */
function generateSecurePassword(length = 16) {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = PASSWORD_POLICY.specialChars;

  const allChars = uppercase + lowercase + numbers + special;
  let password = '';

  // Ensure at least one of each type
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];

  // Fill remaining length
  for (let i = 4; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // Shuffle password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

module.exports = {
  validatePasswordStrength,
  getPasswordStrengthLabel,
  hashPassword,
  verifyPassword,
  isPasswordInHistory,
  savePasswordToHistory,
  isPasswordExpired,
  getDaysUntilExpiration,
  recordFailedAttempt,
  resetFailedAttempts,
  checkAccountLockout,
  getPasswordPolicy,
  generateSecurePassword,
  PASSWORD_POLICY
};
