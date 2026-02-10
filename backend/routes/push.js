/**
 * Push Notification Routes
 * 
 * Handles web push notifications using VAPID keys
 */

const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const { authenticateToken } = require('../middleware/auth');

// VAPID keys should be generated and stored in environment variables
// Generate with: npx web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';

/**
 * @route GET /push/vapid-public-key
 * @summary Get VAPID public key for push subscription
 * @access Public (but requires authentication)
 */
router.get(
  '/vapid-public-key',
  authenticateToken,
  asyncHandler(async (req, res) => {
    if (!VAPID_PUBLIC_KEY) {
      return res.status(503).json({
        error: 'Push notifications not configured',
        message: 'VAPID keys not set'
      });
    }
    
    res.json({ publicKey: VAPID_PUBLIC_KEY });
  })
);

/**
 * @route POST /push/subscribe
 * @summary Subscribe to push notifications
 * @access Private
 */
router.post(
  '/subscribe',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { subscription, userAgent } = req.body;
    const userId = req.user.id;
    
    // TODO: Store subscription in database
    // For now, just acknowledge receipt
    
    res.json({ 
      success: true, 
      message: 'Subscription received',
      userId,
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route POST /push/unsubscribe
 * @summary Unsubscribe from push notifications
 * @access Private
 */
router.post(
  '/unsubscribe',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    
    // TODO: Remove subscription from database
    
    res.json({ 
      success: true, 
      message: 'Unsubscribed successfully',
      userId
    });
  })
);

module.exports = router;
