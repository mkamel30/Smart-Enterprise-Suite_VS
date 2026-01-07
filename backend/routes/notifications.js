const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { ensureBranchWhere } = require('../prisma/branchHelpers');
// NOTE: This file flagged by automated branch-filter scan. Consider using `ensureBranchWhere(args, req))` for Prisma calls where appropriate.
// NOTE: automated inserted imports for branch-filtering and safe raw SQL

// Get notifications for user/branch
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { branchId, userId, unreadOnly } = req.query;

        const where = {};

        // If no specific filter provided, default to user's context
        if (!branchId && !userId) {
            where.OR = [
                { branchId: req.user.branchId },
                { userId: req.user.id }
            ];
        } else {
            if (branchId) where.branchId = branchId;
            if (userId) where.userId = userId;
        }

        if (unreadOnly === 'true') where.isRead = false;

        const notifications = await db.notification.findMany(ensureBranchWhere({
            where,
            orderBy: { createdAt: 'desc' },
            take: 50
        }, req));

        res.json(notifications);
    } catch (error) {
        console.error('Failed to fetch notifications:', error);
        res.status(500).json({ error: 'ظپط´ظ„ ظپظٹ ط¬ظ„ط¨ ط§ظ„ط¥ط´ط¹ط§ط±ط§طھ' });
    }
});

// Get unread count
router.get('/count', authenticateToken, async (req, res) => {
    try {
        const { branchId, userId } = req.query;

        const where = { isRead: false };

        // If no specific filter provided, default to user's context
        if (!branchId && !userId) {
            where.OR = [
                { branchId: req.user.branchId },
                { userId: req.user.id }
            ];
        } else {
            if (branchId) where.branchId = branchId;
            if (userId) where.userId = userId;
        }

        const count = await db.notification.count({ where });
        res.json({ count });
    } catch (error) {
        console.error('Failed to count notifications:', error);
        res.status(500).json({ error: 'ظپط´ظ„ ظپظٹ ط¬ظ„ط¨ ط¹ط¯ط¯ ط§ظ„ط¥ط´ط¹ط§ط±ط§طھ' });
    }
});

// Mark as read
router.put('/:id/read', authenticateToken, async (req, res) => {
    try {
        // Fetch first to enforce ownership/branch manually
        const notif = await db.notification.findUnique({ where: { id: req.params.id } });
        if (!notif) return res.status(404).json({ error: 'ط§ظ„ط¥ط´ط¹ط§ط± ط؛ظٹط± ظ…ظˆط¬ظˆط¯' });

        // Authorization: allow if same branch or targeted user
        const sameBranch = notif.branchId && req.user.branchId && notif.branchId === req.user.branchId;
        const sameUser = notif.userId && notif.userId === req.user.id;
        const isAdmin = ['SUPER_ADMIN', 'MANAGEMENT'].includes(req.user.role);
        if (!(sameBranch || sameUser || isAdmin)) {
            return res.status(403).json({ error: 'ظ„ط§ طھظ…ظ„ظƒ طµظ„ط§ط­ظٹط© طھط­ط¯ظٹط« ظ‡ط°ط§ ط§ظ„ط¥ط´ط¹ط§ط±' });
        }

        const notification = await db.notification.update({
            where: { id: req.params.id },
            data: { isRead: true }
        });
        res.json(notification);
    } catch (error) {
        console.error('Failed to mark notification as read:', error);
        res.status(500).json({ error: 'ظپط´ظ„ ظپظٹ طھط­ط¯ظٹط« ط§ظ„ط¥ط´ط¹ط§ط±' });
    }
});

// Mark all as read
router.put('/read-all', authenticateToken, async (req, res) => {
    try {
        const { branchId, userId } = req.body;

        const where = { isRead: false };
        if (branchId) where.branchId = branchId;
        if (userId) where.userId = userId;

        await db.notification.updateMany(ensureBranchWhere({
            where,
            data: { isRead: true }
        }, req));

        res.json({ message: 'طھظ… طھط¹ظ„ظٹظ… ظƒظ„ ط§ظ„ط¥ط´ط¹ط§ط±ط§طھ ظƒظ…ظ‚ط±ظˆط،ط©' });
    } catch (error) {
        console.error('Failed to mark all as read:', error);
        res.status(500).json({ error: 'ظپط´ظ„ ظپظٹ طھط­ط¯ظٹط« ط§ظ„ط¥ط´ط¹ط§ط±ط§طھ' });
    }
});

// Delete notification
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        // Fetch first to check ownership/authorization
        const notification = await db.notification.findUnique({
            where: { id: req.params.id }
        });

        if (!notification) {
            return res.status(404).json({ error: 'ط§ظ„ط¥ط´ط¹ط§ط± ط؛ظٹط± ظ…ظˆط¬ظˆط¯' });
        }

        // Authorization check
        const sameBranch = notification.branchId && req.user.branchId && notification.branchId === req.user.branchId;
        const sameUser = notification.userId && notification.userId === req.user.id;
        const isAdmin = ['SUPER_ADMIN', 'MANAGEMENT'].includes(req.user.role);

        if (!(sameBranch || sameUser || isAdmin)) {
            return res.status(403).json({ error: 'ظ„ط§ طھظ…ظ„ظƒ طµظ„ط§ط­ظٹط© ط­ط°ظپ ظ‡ط°ط§ ط§ظ„ط¥ط´ط¹ط§ط±' });
        }

        await db.notification.delete({
            where: { id: req.params.id }
        });

        res.json({ message: 'طھظ… ط­ط°ظپ ط§ظ„ط¥ط´ط¹ط§ط±' });
    } catch (error) {
        console.error('Failed to delete notification:', error);
        res.status(500).json({ error: 'ظپط´ظ„ ظپظٹ ط­ط°ظپ ط§ظ„ط¥ط´ط¹ط§ط±' });
    }
});

// Create notification (internal use)
async function createNotification({ branchId, userId, type, title, message, data, link }) {
    const notification = await db.notification.create({
        data: {
            branchId,
            userId,
            type,
            title,
            message,
            data: data ? JSON.stringify(data) : null,
            link
        }
    });

    // Send real-time notification via WebSocket
    if (global.io) {
        // Send to specific branch room
        if (branchId) {
            global.io.to(`branch-${branchId}`).emit('notification', notification);
        }
        
        // Send to specific user room
        if (userId) {
            global.io.to(`user-${userId}`).emit('notification', notification);
        }
    }

    // Send push notification if user has it enabled
    if (userId) {
        try {
            const user = await db.user.findUnique({
                where: { id: userId },
                select: { mobilePush: true }
            });

            if (user?.mobilePush) {
                const { sendPushToUser } = require('./push-notifications');
                await sendPushToUser(userId, {
                    title,
                    body: message,
                    url: link || '/',
                    tag: type,
                    notificationId: notification.id
                });
            }
        } catch (error) {
            console.error('Failed to send push notification:', error);
            // Don't fail the whole operation if push fails
        }
    }

    return notification;
}

module.exports = router;
module.exports.createNotification = createNotification;
