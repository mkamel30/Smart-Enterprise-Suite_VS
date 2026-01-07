const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { logAction } = require('../utils/logger');
const authenticateToken = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    console.error('FATAL: JWT_SECRET environment variable is not set. Aborting startup.');
    process.exit(1);
}

const authService = require('../services/authService');

// Get Profile
router.get('/profile', authenticateToken, async (req, res) => {
    try {
        const profile = await authService.getProfile(req.user.id);
        res.json(profile);
    } catch (error) {
        res.status(error.status || 500).json({ error: error.message || 'Internal server error' });
    }
});

// Update Preferences
router.put('/preferences', authenticateToken, async (req, res) => {
    try {
        const result = await authService.updatePreferences(req.user.id, req.body);
        res.json(result);
    } catch (error) {
        console.error('Update preferences error:', error);
        res.status(error.status || 500).json({ error: error.message || 'Failed to update preferences' });
    }
});

// Change Password
router.post('/change-password', authenticateToken, async (req, res) => {
    try {
        const result = await authService.changePassword(req.user.id, req.body.currentPassword, req.body.newPassword);
        res.json(result);
    } catch (error) {
        console.error('Change password error:', error);
        res.status(error.status || 500).json({ error: error.message || 'Failed to change password' });
    }
});

// Login
router.post('/login', async (req, res) => {
    const identifier = req.body.identifier || req.body.email || req.body.userId;
    try {
        const result = await authService.login({ identifier, password: req.body.password, branchId: req.body.branchId });
        res.json(result);
    } catch (error) {
        console.error('Login error:', error);
        res.status(error.status || 500).json({ error: error.message || 'Internal server error' });
    }
});

module.exports = router;
