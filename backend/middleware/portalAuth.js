const logger = require('../utils/logger');

/**
 * Middleware to verify requests coming from the Central Admin Portal
 */
const portalAuth = (req, res, next) => {
    const portalSyncKey = req.headers['x-portal-sync-key'];
    const MASTER_SYNC_KEY = process.env.PORTAL_API_KEY || 'master_portal_key_internal';

    if (portalSyncKey && portalSyncKey === MASTER_SYNC_KEY) {
        req.user = {
            id: 'SYSTEM_SYNC',
            displayName: 'Central Portal Sync',
            role: 'SUPER_ADMIN',
            branchId: null,
            permissions: ['*'],
            authorizedBranchIds: []
        };
        logger.debug('[PortalAuth] Request verified via sync key');
        return next();
    }

    logger.warn({ ip: req.ip }, '[PortalAuth] Unauthorized access attempt via sync path');
    return res.status(401).json({ error: 'Unauthorized: Portal Sync Key required' });
};

module.exports = portalAuth;
