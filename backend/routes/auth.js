const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../db');
const logger = require('../utils/logger'); // Import default logger
const { logAction } = require('../utils/logger');
const { authenticateToken } = require('../middleware/auth');
const { asyncHandler } = require('../utils/errorHandler'); // Import asyncHandler

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'test' ? 'test_secret_123' : undefined);

if (!JWT_SECRET) {
    logger.fatal('FATAL: JWT_SECRET environment variable is not set. Aborting startup.');
    process.exit(1);
}

const authService = require('../services/authService');

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

// Change Password
router.post('/change-password', authenticateToken, asyncHandler(async (req, res) => {
    const result = await authService.changePassword(req.user.id, req.body.currentPassword, req.body.newPassword);
    res.json(result);
}));

// Login
router.post('/login', asyncHandler(async (req, res) => {
    const identifier = req.body.identifier || req.body.email || req.body.userId;
    // Log login attempt (without password)
    logger.info({ identifier, ip: req.ip }, 'Login attempt');

    const result = await authService.login({ identifier, password: req.body.password, branchId: req.body.branchId });

    // Log success is handled by business/audit log inside service usually, but we can add meta info here
    logger.info({ userId: result.user.id, branchId: result.user.branchId }, 'Login successful');

    res.json(result);
}));

module.exports = router;
