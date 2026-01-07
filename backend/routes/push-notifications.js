const express = require('express');
const router = express.Router();
const webpush = require('web-push');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');

const prisma = new PrismaClient();

// VAPID keys (should be in environment variables in production)
// Generate with: npx web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BOkSR6vLG4UlNPmtSo_-p55FYMA2os4VWiQm4mvxu0DRQByggT0f-GqTl3NDniGb4trR24iUF1Sr7pThmkE1hns';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'CJvep0g_Y_gt3ILm1RXQ7YKL-Gpd8l1RKjq5fOsexf4';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@csdept.com';

webpush.setVapidDetails(
  VAPID_SUBJECT,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

// In-memory storage for push subscriptions (use database in production)
const subscriptions = new Map();

/**
 * GET /api/push/vapid-public-key
 * Get VAPID public key for client subscription
 */
router.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

/**
 * POST /api/push/subscribe
 * Save push subscription for user
 */
router.post('/subscribe', authenticateToken, async (req, res) => {
  try {
    const { subscription, userId } = req.body;

    if (!subscription || !userId) {
      return res.status(400).json({ error: 'Subscription and userId are required' });
    }

    // Store subscription (in production, save to database)
    subscriptions.set(userId, subscription);

    console.log(`Push subscription saved for user: ${userId}`);
    res.json({ success: true, message: 'Subscription saved' });
  } catch (error) {
    console.error('Error saving subscription:', error);
    res.status(500).json({ error: 'Failed to save subscription' });
  }
});

/**
 * POST /api/push/unsubscribe
 * Remove push subscription for user
 */
router.post('/unsubscribe', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    subscriptions.delete(userId);

    console.log(`Push subscription removed for user: ${userId}`);
    res.json({ success: true, message: 'Subscription removed' });
  } catch (error) {
    console.error('Error removing subscription:', error);
    res.status(500).json({ error: 'Failed to remove subscription' });
  }
});

/**
 * Helper function to send push notification to user
 * @param {string} userId - User ID to send notification to
 * @param {object} payload - Notification payload
 */
async function sendPushToUser(userId, payload) {
  try {
    const subscription = subscriptions.get(userId);
    
    if (!subscription) {
      console.log(`No push subscription found for user: ${userId}`);
      return false;
    }

    await webpush.sendNotification(subscription, JSON.stringify(payload));
    console.log(`Push notification sent to user: ${userId}`);
    return true;
  } catch (error) {
    console.error(`Failed to send push to user ${userId}:`, error);
    
    // If subscription is invalid, remove it
    if (error.statusCode === 410) {
      subscriptions.delete(userId);
    }
    
    return false;
  }
}

// Export helper function
module.exports = router;
module.exports.sendPushToUser = sendPushToUser;
