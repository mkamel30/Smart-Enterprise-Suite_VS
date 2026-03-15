const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');
const rateLimit = require('express-rate-limit');

// Rate limiters
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many login attempts, please try again after 15 minutes'
});

/**
 * Smart Enterprise Module Loader
 * Automatically mounts routes for all modules
 */

// --- AUTH MODULE ---
router.use('/auth', loginLimiter, require('./auth/auth.routes.js'));
router.use('/mfa', require('./auth/mfa.routes.js'));
router.use('/users', require('./auth/users.routes.js'));
router.use('/user', require('./auth/user-preferences.routes.js'));
router.use('/permissions', require('./auth/permissions.routes.js'));

// --- BRANCH MODULE ---
router.use('/branches', require('./branch/branch.routes.js'));

// --- CUSTOMER MODULE ---
router.use('/customers', require('./customer/customer.routes.js'));

// --- INVENTORY MODULE ---
router.use('/', require('./inventory/inventory.routes.js')); // Has /inventory internally
router.use('/spare-parts', require('./inventory/warehouse.routes.js'));
router.use('/warehouse-machines', require('./inventory/warehouse-machines.routes.js'));
router.use('/warehouse-sims', require('./inventory/warehouse-sims.routes.js'));
router.use('/transfer-orders', require('./inventory/transfer-orders.routes.js'));
router.use('/', require('./inventory/simcards.routes.js')); // Has /simcards internally
router.use('/', require('./inventory/machines.routes.js')); // Has /machines internally

// --- MAINTENANCE MODULE ---
router.use('/', require('./maintenance/maintenance.routes.js')); // Has /requests internally
router.use('/approvals', require('./maintenance/approvals.routes.js'));
router.use('/machine-workflow', require('./maintenance/machine-workflow.routes.js'));
router.use('/', require('./maintenance/machine-history.routes.js')); // Has /machines history internally
router.use('/', require('./maintenance/repair-count.routes.js')); // Has /machines repair count internally

// --- FINANCE MODULE ---
router.use('/finance', require('./finance/finance.routes.js'));
router.use('/payments', require('./finance/payments.routes.js'));
router.use('/sales', require('./finance/sales.routes.js'));
router.use('/pending-payments', require('./finance/pending-payments.routes.js'));

// --- SYSTEM MODULE ---
router.use('/admin', require('./system/admin.routes.js'));
router.use('/audit-logs', require('./system/audit-logs.routes.js'));
router.use('/backup', require('./system/backup.routes.js'));
router.use('/dashboard', require('./system/dashboard.routes.js'));
router.use('/db', require('./system/db.routes.js'));
router.use('/db-health', require('./system/db-health.routes.js'));
router.use('/reports', require('./system/reports.routes.js'));
router.use('/', require('./system/stats.routes.js')); // Has /stats internally
router.use('/', require('./system/settings.routes.js')); // Has /machine-parameters internally
router.use('/dev/self-test', require('./system/self-test.routes.js'));
router.use('/notifications', require('./system/notifications.routes.js'));
router.use('/system/sync', require('./system/sync.routes.js'));
router.use('/system/update', require('./system/update.routes.js'));
router.use('/push', require('./system/push-notifications.routes.js'));

// Special case for health (mounted at root /health and /api/health)
router.use('/health', require('./system/health.routes.js'));

logger.info('API Modules loaded successfully');

module.exports = router;
