const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../../../db');
const logger = require('../../../utils/logger'); // Import default logger
const { logAction } = require('../../../utils/logger');
const { authenticateToken, requireAdmin } = require('../../../middleware/auth');
const { asyncHandler } = require('../../../utils/errorHandler'); // Import asyncHandler
const passwordPolicy = require('../../../utils/passwordPolicy');

// JWT_SECRET is validated at startup by middleware/auth.js — no fallback here.
// For tests, set JWT_SECRET in the test environment config, never via code fallback.

const authService = require('./auth.service.js');

// Get Profile
router.get('/profile', authenticateToken, asyncHandler(async (req, res) => {
    const profile = await authService.getProfile(req.user.id);
    res.json(profile);
}));

// Update Preferences
router.put('/preferences', authenticateToken, asyncHandler(async (req, res) => {
    const result = await authService.updatePreferences(req.user.id, req.body);
    res.json(result);
}));

// Change Password with Policy Validation
router.post('/change-password', authenticateToken, asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword) {
        return res.status(400).json({
            error: 'Both current password and new password are required'
        });
    }

    const result = await authService.changePassword(req.user.id, currentPassword, newPassword);
    res.json(result);
}));

// Check Password Strength (public endpoint for frontend validation)
router.post('/check-password-strength', asyncHandler(async (req, res) => {
    const { password } = req.body;

    if (!password) {
        return res.status(400).json({ error: 'Password is required' });
    }

    const validation = passwordPolicy.validatePasswordStrength(password);

    res.json({
        isValid: validation.isValid,
        strength: validation.strength,
        strengthLabel: passwordPolicy.getPasswordStrengthLabel(validation.strength),
        errors: validation.errors,
        meetsPolicy: validation.meetsPolicy
    });
}));

// Get Password Policy Configuration (public endpoint)
router.get('/password-policy', asyncHandler(async (req, res) => {
    const policy = passwordPolicy.getPasswordPolicy();
    res.json(policy);
}));

// Login with Account Lockout and MFA Support
router.post('/login', asyncHandler(async (req, res) => {
    const identifier = req.body.identifier || req.body.email || req.body.userId;

    // Log login attempt (without password)
    logger.info({ identifier, ip: req.ip }, 'Login attempt');

    try {
        const result = await authService.login({
            identifier,
            password: req.body.password,
            branchId: req.body.branchId,
            mfaToken: req.body.mfaToken
        });

        // Check if MFA is required
        if (result.mfaRequired) {
            logger.info({ userId: result.user.id, ip: req.ip }, 'MFA required for login');
            return res.json({
                mfaRequired: true,
                mfaTempToken: result.mfaTempToken,
                user: result.user,
                message: result.message
            });
        }

        // Log success
        logger.info({ userId: result.user.id, branchId: result.user.branchId, mfaVerified: result.user.mfaEnabled }, 'Login successful');

        // Set HttpOnly cookies
        if (result.token) {
            res.cookie('token', result.token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 60 * 60 * 1000 // 1 hour for access token
            });
        }

        if (result.refreshToken) {
            res.cookie('refreshToken', result.refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days for refresh token
            });
        }

        res.json(result);
    } catch (error) {
        // Log failure
        logger.warn({ identifier, ip: req.ip, error: error.message }, 'Login failed');
        throw error;
    }
}));

// Refresh Token
router.post('/refresh', asyncHandler(async (req, res) => {
    const refreshToken = req.cookies?.refreshToken;
    const result = await authService.refreshAccessToken(refreshToken);

    // Set new access token cookie
    res.cookie('token', result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 1000 // 1 hour
    });

    res.json(result);
}));

// Logout
router.post('/logout', asyncHandler(async (req, res) => {
    const refreshToken = req.cookies?.refreshToken;
    if (refreshToken) {
        await db.refreshToken.deleteMany({ where: { token: refreshToken } });
    }
    res.clearCookie('token');
    res.clearCookie('refreshToken');
    res.json({ success: true, message: 'Logged out successfully' });
}));

// Admin: Force Password Change for User
router.post('/admin/force-password-change',
    authenticateToken,
    requireAdmin,
    asyncHandler(async (req, res) => {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' });
        }

        const result = await authService.forcePasswordChange(req.user.id, userId);
        res.json(result);
    })
);

// Admin: Unlock User Account
router.post('/admin/unlock-account',
    authenticateToken,
    requireAdmin,
    asyncHandler(async (req, res) => {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' });
        }

        const result = await authService.unlockAccount(req.user.id, userId);
        res.json(result);
    })
);

// Admin: Get User Account Status (lockout info, password expiration)
router.get('/admin/account-status/:userId',
    authenticateToken,
    requireAdmin,
    asyncHandler(async (req, res) => {
        const { userId } = req.params;

        const user = await db.user.findUnique({
            where: { id: userId },
            include: { accountLockout: true }
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const lockoutStatus = await passwordPolicy.checkAccountLockout(userId);

        res.json({
            userId: user.id,
            email: user.email,
            displayName: user.displayName,
            isActive: user.isActive,
            lastLoginAt: user.lastLoginAt,
            loginCount: user.loginCount,
            passwordChangedAt: user.passwordChangedAt,
            mustChangePassword: user.mustChangePassword,
            passwordStatus: {
                isExpired: passwordPolicy.isPasswordExpired(user.passwordChangedAt),
                daysUntilExpiration: passwordPolicy.getDaysUntilExpiration(user.passwordChangedAt)
            },
            accountLockout: {
                isLocked: lockoutStatus.isLocked,
                lockedUntil: user.accountLockout?.lockedUntil || null,
                failedAttempts: user.accountLockout?.failedAttempts || 0,
                remainingAttempts: lockoutStatus.remainingAttempts
            }
        });
    })
);

// Admin: Generate Secure Password
router.get('/admin/generate-password',
    authenticateToken,
    requireAdmin,
    asyncHandler(async (req, res) => {
        const length = parseInt(req.query.length) || 16;
        const password = passwordPolicy.generateSecurePassword(length);

        // Validate the generated password meets policy
        const validation = passwordPolicy.validatePasswordStrength(password);

        res.json({
            password,
            strength: validation.strength,
            strengthLabel: passwordPolicy.getPasswordStrengthLabel(validation.strength)
        });
    })
);

// Forgot Password - Initiate
router.post('/forgot-password', asyncHandler(async (req, res) => {
    const { identifier } = req.body;
    if (!identifier) return res.status(400).json({ error: 'Identifier is required' });
    
    const result = await authService.requestPasswordReset(identifier);
    res.json(result);
}));

// Reset Password - Complete
router.post('/reset-password', asyncHandler(async (req, res) => {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
        return res.status(400).json({ error: 'Token and new password are required' });
    }
    
    const result = await authService.resetPassword(token, newPassword);
    res.json(result);
}));

module.exports = router;
