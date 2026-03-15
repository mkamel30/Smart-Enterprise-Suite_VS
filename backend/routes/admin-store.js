const express = require('express');
const router = express.Router();
const adminStoreService = require('../services/adminStoreService');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission, PERMISSIONS } = require('../middleware/permissions');
const logger = require('../utils/logger');

// All routes require authentication
router.use(authenticateToken);

// --- Item Type Management ---

router.get('/settings/types',
    requirePermission(PERMISSIONS.INVENTORY_VIEW_ALL),
    async (req, res, next) => {
        try {
            const types = await adminStoreService.listItemTypes();
            res.json(types);
        } catch (err) {
            next(err);
        }
    }
);

router.post('/settings/types',
    requirePermission(PERMISSIONS.INVENTORY_MANAGE_NEW),
    async (req, res, next) => {
        try {
            const type = await adminStoreService.createItemType(req.body, req.user);
            res.status(201).json(type);
        } catch (err) {
            next(err);
        }
    }
);

router.put('/settings/types/:id',
    requirePermission(PERMISSIONS.INVENTORY_MANAGE_NEW),
    async (req, res, next) => {
        try {
            const type = await adminStoreService.updateItemType(req.params.id, req.body);
            res.json(type);
        } catch (err) {
            next(err);
        }
    }
);

// --- Asset Management ---

router.get('/inventory',
    requirePermission(PERMISSIONS.INVENTORY_VIEW_ALL),
    async (req, res, next) => {
        try {
            const assets = await adminStoreService.listAssets(req.query);
            res.json(assets);
        } catch (err) {
            next(err);
        }
    }
);

router.get('/assets/:id/history',
    requirePermission(PERMISSIONS.INVENTORY_VIEW_ALL),
    async (req, res, next) => {
        try {
            const history = await adminStoreService.getAssetHistory(req.params.id);
            res.json(history);
        } catch (err) {
            next(err);
        }
    }
);

router.post('/assets/manual',
    requirePermission(PERMISSIONS.INVENTORY_MANAGE_NEW),
    async (req, res, next) => {
        try {
            const asset = await adminStoreService.createAssetManual(req.body, req.user);
            res.status(201).json(asset);
        } catch (err) {
            next(err);
        }
    }
);

router.post('/assets/import',
    requirePermission(PERMISSIONS.INVENTORY_MANAGE_NEW),
    async (req, res, next) => {
        try {
            const { assets } = req.body;
            if (!Array.isArray(assets)) {
                return res.status(400).json({ error: 'Assets array is required' });
            }
            const results = await adminStoreService.importAssets(assets, req.user);
            res.json(results);
        } catch (err) {
            next(err);
        }
    }
);

// --- Carton Management ---

router.get('/cartons',
    requirePermission(PERMISSIONS.INVENTORY_VIEW_ALL),
    async (req, res, next) => {
        try {
            const cartons = await adminStoreService.listCartons(req.query);
            res.json(cartons);
        } catch (err) {
            next(err);
        }
    }
);

router.post('/cartons',
    requirePermission(PERMISSIONS.INVENTORY_MANAGE_NEW),
    async (req, res, next) => {
        try {
            const carton = await adminStoreService.createCarton(req.body, req.user);
            res.status(201).json(carton);
        } catch (err) {
            next(err);
        }
    }
);

// --- Transfers ---

router.post('/transfers/asset',
    requirePermission(PERMISSIONS.TRANSFERS_SEND_NEW),
    async (req, res, next) => {
        try {
            const { assetId, targetBranchId, notes } = req.body;
            const result = await adminStoreService.transferAsset(assetId, targetBranchId, req.user, notes);
            res.json(result);
        } catch (err) {
            next(err);
        }
    }
);

router.post('/transfers/carton',
    requirePermission(PERMISSIONS.TRANSFERS_SEND_NEW),
    async (req, res, next) => {
        try {
            const { cartonId, targetBranchId, notes } = req.body;
            const result = await adminStoreService.transferCarton(cartonId, targetBranchId, req.user, notes);
            res.json(result);
        } catch (err) {
            next(err);
        }
    }
);

router.post('/transfers/bulk',
    requirePermission(PERMISSIONS.TRANSFERS_SEND_NEW),
    async (req, res, next) => {
        try {
            const result = await adminStoreService.bulkTransferAssetsAndCartons(req.body, req.user);
            res.json(result);
        } catch (err) {
            next(err);
        }
    }
);

// --- Stock Management ---

router.get('/stocks',
    requirePermission(PERMISSIONS.INVENTORY_VIEW_ALL),
    async (req, res, next) => {
        try {
            const { branchId } = req.query;
            const stocks = await adminStoreService.listStocks(branchId || null);
            res.json(stocks);
        } catch (err) {
            next(err);
        }
    }
);

router.post('/transfers/stock',
    // requirePermission(PERMISSIONS.TRANSFERS_SEND_NEW), // using same permission as asset transfer
    requirePermission(PERMISSIONS.TRANSFERS_SEND_NEW),
    async (req, res, next) => {
        try {
            const result = await adminStoreService.transferStock(req.body, req.user);
            res.json(result);
        } catch (err) {
            next(err);
        }
    }
);

module.exports = router;
