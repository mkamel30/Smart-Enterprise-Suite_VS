const express = require('express');
const router = express.Router();
const db = require('../../../db');
const { authenticateToken } = require('../../../middleware/auth');
const { ensureBranchWhere } = require('../../../prisma/branchHelpers');
const { isGlobalRole } = require('../../../utils/constants');
const { parsePaginationParams, createPaginationResponse } = require('../../../utils/pagination');
// NOTE: This file flagged by automated branch-filter scan. Consider using `ensureBranchWhere(args, req))` for Prisma calls where appropriate.
// NOTE: automated inserted imports for branch-filtering and safe raw SQL

// Get notifications for user/branch
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { branchId, userId, unreadOnly } = req.query;

        const where = {};

        // If no specific filter provided, default to user's context
        const authorizedIds = req.user.authorizedBranchIds || (req.user.branchId ? [req.user.branchId] : []);
        if (!branchId && !userId) {
            where.OR = [
                { branchId: authorizedIds.length === 1 ? authorizedIds[0] : { in: authorizedIds } },
                { userId: req.user.id }
            ];
        } else {
            if (branchId) where.branchId = branchId;
            if (userId) where.userId = userId;
        }

        if (unreadOnly === 'true') where.isRead = false;

        const { limit, offset } = parsePaginationParams(req.query);
        const [notifications, total] = await Promise.all([
            db.notification.findMany(ensureBranchWhere({
                where: where,
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip: offset
            }, req)),
            db.notification.count(ensureBranchWhere({
                where: where
            }, req))
        ]);

        res.json(createPaginationResponse(notifications, total, limit, offset));
    } catch (error) {
        console.error('Failed to fetch notifications:', error);
        res.status(500).json({ error: 'ÝÔá Ýí ÌáÈ ÇáÅÔÚÇÑÇÊ' });
    }
});

// Get unread count
router.get('/count', authenticateToken, async (req, res) => {
    try {
        const { branchId, userId } = req.query;

        const where = { isRead: false };

        // If no specific filter provided, default to user's context
        const authorizedIds = req.user.authorizedBranchIds || (req.user.branchId ? [req.user.branchId] : []);
        if (!branchId && !userId) {
            where.OR = [
                { branchId: authorizedIds.length === 1 ? authorizedIds[0] : { in: authorizedIds } },
                { userId: req.user.id }
            ];
        } else {
            if (branchId) where.branchId = branchId;
            if (userId) where.userId = userId;
        }

        const count = await db.notification.count(ensureBranchWhere({
            where: {
                ...where,
                isRead: false
            }
        }, req));
        res.json({ count });
    } catch (error) {
        console.error('Failed to count notifications:', error);
        res.status(500).json({ error: 'ÝÔá Ýí ÌáÈ ÚÏÏ ÇáÅÔÚÇÑÇÊ' });
    }
});

// Mark as read
router.put('/:id/read', authenticateToken, async (req, res) => {
    try {
        // Fetch first to enforce ownership/branch manually
        const notif = await db.notification.findFirst({
            where: {
                id: req.params.id,
                _skipBranchEnforcer: true
            }
        });
        if (!notif) return res.status(404).json({ error: 'ÇáÅÔÚÇÑ ÛíÑ ãæÌæÏ' });

        // Authorization: allow if same branch or targeted user or authorized via hierarchy
        const authorizedIds = req.user.authorizedBranchIds || (req.user.branchId ? [req.user.branchId] : []);
        const canAccess = notif.branchId && authorizedIds.includes(notif.branchId);
        const sameUser = notif.userId && notif.userId === req.user.id;
        const isAdmin = isGlobalRole(req.user.role);
        if (!(canAccess || sameUser || isAdmin)) {
            return res.status(403).json({ error: 'áÇ Êãáß ÕáÇÍíÉ ÊÍÏíË åÐÇ ÇáÅÔÚÇÑ' });
        }

        await db.notification.updateMany({
            where: { id: req.params.id, branchId: notif.branchId },
            data: { isRead: true }
        });
        const notification = await db.notification.findFirst({
            where: { id: req.params.id, _skipBranchEnforcer: true }
        });
        res.json(notification);
    } catch (error) {
        console.error('Failed to mark notification as read:', error);
        res.status(500).json({ error: 'ÝÔá Ýí ÊÍÏíË ÇáÅÔÚÇÑ' });
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

        res.json({ message: 'Êã ÊÚáíã ßá ÇáÅÔÚÇÑÇÊ ßãÞÑæÁÉ' });
    } catch (error) {
        console.error('Failed to mark all as read:', error);
        res.status(500).json({ error: 'ÝÔá Ýí ÊÍÏíË ÇáÅÔÚÇÑÇÊ' });
    }
});

// Delete notification
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        // Fetch first to check ownership/authorization
        const notification = await db.notification.findFirst({
            where: { id: req.params.id, branchId: req.user.branchId || { not: null } }
        });

        if (!notification) {
            return res.status(404).json({ error: 'ÇáÅÔÚÇÑ ÛíÑ ãæÌæÏ' });
        }

        // Authorization check
        const authorizedIds = req.user.authorizedBranchIds || (req.user.branchId ? [req.user.branchId] : []);
        const canAccess = notification.branchId && authorizedIds.includes(notification.branchId);
        const sameUser = notification.userId && notification.userId === req.user.id;
        const isAdmin = isGlobalRole(req.user.role);

        if (!(canAccess || sameUser || isAdmin)) {
            return res.status(403).json({ error: 'áÇ Êãáß ÕáÇÍíÉ ÍÐÝ åÐÇ ÇáÅÔÚÇÑ' });
        }

        await db.notification.deleteMany({
            where: { id: req.params.id, branchId: notification.branchId }
        });

        res.json({ message: 'Êã ÍÐÝ ÇáÅÔÚÇÑ' });
    } catch (error) {
        console.error('Failed to delete notification:', error);
        res.status(500).json({ error: 'ÝÔá Ýí ÍÐÝ ÇáÅÔÚÇÑ' });
    }
});

// Create notification (internal use)
async function createNotification({ branchId, userId, type, title, message, data, link }) {
    const notification = await db.notification.create({
        data: {
            id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
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
            const user = await db.user.findFirst({
                where: { id: userId, branchId: branchId || { not: null } },
                select: { mobilePush: true }
            });

            if (user?.mobilePush) {
                const { sendPushToUser } = require('./push-notifications.routes.js');
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
