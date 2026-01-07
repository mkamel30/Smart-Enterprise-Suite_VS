const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');

const prisma = new PrismaClient();

/**
 * GET /api/user/preferences
 * Get user preferences
 */
router.get('/preferences', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        fontSize: true,
        highlightEffect: true,
        notificationSound: true,
        mobilePush: true,
        theme: true,
        fontFamily: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Return preferences with defaults
    res.json({
      fontSize: user.fontSize || 'small',
      highlightEffect: user.highlightEffect !== null ? user.highlightEffect : true,
      notificationSound: user.notificationSound !== null ? user.notificationSound : true,
      mobilePush: user.mobilePush !== null ? user.mobilePush : false,
      theme: user.theme || 'light',
      fontFamily: user.fontFamily || 'IBM Plex Sans Arabic',
    });
  } catch (error) {
    console.error('Error fetching user preferences:', error);
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
});

/**
 * PUT /api/user/preferences
 * Update user preferences
 */
router.put('/preferences', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { fontSize, highlightEffect, notificationSound, mobilePush, theme, fontFamily } = req.body;

    // Validate fontSize if provided
    if (fontSize && !['small', 'medium', 'large'].includes(fontSize)) {
      return res.status(400).json({ error: 'Invalid fontSize value. Must be: small, medium, or large' });
    }

    // Build update object with only provided fields
    const updateData = {};
    if (fontSize !== undefined) updateData.fontSize = fontSize;
    if (highlightEffect !== undefined) updateData.highlightEffect = highlightEffect;
    if (notificationSound !== undefined) updateData.notificationSound = notificationSound;
    if (mobilePush !== undefined) updateData.mobilePush = mobilePush;
    if (theme !== undefined) updateData.theme = theme;
    if (fontFamily !== undefined) updateData.fontFamily = fontFamily;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        fontSize: true,
        highlightEffect: true,
        notificationSound: true,
        mobilePush: true,
        theme: true,
        fontFamily: true,
      },
    });

    res.json(updatedUser);
  } catch (error) {
    console.error('Error updating user preferences:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

module.exports = router;
