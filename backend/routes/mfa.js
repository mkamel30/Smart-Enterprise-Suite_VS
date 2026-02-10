const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { authenticateToken } = require('../middleware/auth');
const { asyncHandler } = require('../utils/errorHandler');
const mfaService = require('../services/mfaService');
const logger = require('../utils/logger');

// MFA-specific rate limiters
const mfaSetupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: 'Too many MFA setup attempts. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn({ ip: req.ip, userId: req.user?.id }, 'MFA setup rate limit exceeded');
    res.status(429).json({
      error: {
        message: 'Too many MFA setup attempts. Please try again in 15 minutes.',
        code: 'MFA_SETUP_RATE_LIMIT_EXCEEDED',
        retryAfter: req.rateLimit.resetTime,
        timestamp: new Date().toISOString()
      }
    });
  }
});

const mfaVerifyLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // 10 attempts per window
  message: 'Too many MFA verification attempts. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn({ ip: req.ip, userId: req.user?.id }, 'MFA verify rate limit exceeded');
    res.status(429).json({
      error: {
        message: 'Too many MFA verification attempts. Please try again in 5 minutes.',
        code: 'MFA_VERIFY_RATE_LIMIT_EXCEEDED',
        retryAfter: req.rateLimit.resetTime,
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * @route   GET /mfa/status
 * @desc    Get MFA status for authenticated user
 * @access  Private
 */
router.get('/status', authenticateToken, asyncHandler(async (req, res) => {
  const status = await mfaService.getMFAStatus(req.user.id);
  res.json({
    success: true,
    data: status
  });
}));

/**
 * @route   POST /mfa/setup
 * @desc    Initialize MFA setup (generates QR code)
 * @access  Private
 */
router.post('/setup', authenticateToken, mfaSetupLimiter, asyncHandler(async (req, res) => {
  const setupData = await mfaService.setupMFA(req.user.id);
  res.json({
    success: true,
    data: setupData
  });
}));

/**
 * @route   POST /mfa/verify-setup
 * @desc    Verify MFA setup and enable MFA
 * @access  Private
 */
router.post('/verify-setup', authenticateToken, mfaVerifyLimiter, asyncHandler(async (req, res) => {
  const { token } = req.body;
  
  if (!token) {
    return res.status(400).json({
      error: {
        message: 'Verification token is required',
        code: 'MISSING_TOKEN'
      }
    });
  }

  const result = await mfaService.verifyAndEnableMFA(req.user.id, token);
  res.json({
    success: true,
    data: result
  });
}));

/**
 * @route   POST /mfa/disable
 * @desc    Disable MFA for user (requires verification)
 * @access  Private
 */
router.post('/disable', authenticateToken, mfaVerifyLimiter, asyncHandler(async (req, res) => {
  const { token } = req.body;
  
  if (!token) {
    return res.status(400).json({
      error: {
        message: 'Verification token or backup code is required',
        code: 'MISSING_TOKEN'
      }
    });
  }

  const result = await mfaService.disableMFA(req.user.id, token);
  res.json({
    success: true,
    data: result
  });
}));

/**
 * @route   POST /mfa/verify
 * @desc    Verify MFA token during login flow
 * @access  Private (requires partial auth token from initial login)
 */
router.post('/verify', mfaVerifyLimiter, asyncHandler(async (req, res) => {
  const { userId, token } = req.body;
  
  if (!userId || !token) {
    return res.status(400).json({
      error: {
        message: 'User ID and token are required',
        code: 'MISSING_PARAMETERS'
      }
    });
  }

  const result = await mfaService.verifyMFALogin(userId, token);
  res.json({
    success: true,
    data: result
  });
}));

/**
 * @route   POST /mfa/recovery-codes
 * @desc    Generate new recovery codes
 * @access  Private
 */
router.post('/recovery-codes', authenticateToken, mfaVerifyLimiter, asyncHandler(async (req, res) => {
  const { token } = req.body;
  
  if (!token) {
    return res.status(400).json({
      error: {
        message: 'Current TOTP token is required',
        code: 'MISSING_TOKEN'
      }
    });
  }

  const result = await mfaService.generateRecoveryCodes(req.user.id, token);
  res.json({
    success: true,
    data: result
  });
}));

/**
 * @route   POST /mfa/verify-recovery
 * @desc    Verify recovery code for account recovery
 * @access  Private (requires partial auth token from initial login)
 */
router.post('/verify-recovery', mfaVerifyLimiter, asyncHandler(async (req, res) => {
  const { userId, code } = req.body;
  
  if (!userId || !code) {
    return res.status(400).json({
      error: {
        message: 'User ID and recovery code are required',
        code: 'MISSING_PARAMETERS'
      }
    });
  }

  const result = await mfaService.validateRecoveryCode(userId, code);
  res.json({
    success: true,
    data: result
  });
}));

/**
 * @route   GET /mfa/requires
 * @desc    Check if user requires MFA verification (for login flow)
 * @access  Public (called during login)
 */
router.post('/requires', asyncHandler(async (req, res) => {
  const { userId } = req.body;
  
  if (!userId) {
    return res.status(400).json({
      error: {
        message: 'User ID is required',
        code: 'MISSING_USER_ID'
      }
    });
  }

  const result = await mfaService.requiresMFA(userId);
  res.json({
    success: true,
    data: result
  });
}));

module.exports = router;
