const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const machineTrackingService = require('../services/machineTrackingService');

// Get machines status for branch (track machines sent to maintenance center)
router.get('/', authenticateToken, async (req, res) => {
    try {
        const result = await machineTrackingService.getTrackedMachines(req.query, req.user);
        res.json(result);
    } catch (error) {
        console.error('Failed to fetch tracked machines:', error);
        res.status(error.status || 500).json({ error: error.message || 'فشل في جلب حالة الماكينات' });
    }
});

// Get summary of machines at maintenance center
router.get('/summary', authenticateToken, async (req, res) => {
    try {
        const result = await machineTrackingService.getTrackingSummary(req.query, req.user);
        res.json(result);
    } catch (error) {
        console.error('Failed to fetch tracking summary:', error);
        res.status(error.status || 500).json({ error: error.message || 'فشل في جلب ملخص المتابعة' });
    }
});

// Get single machine tracking info
router.get('/:serialNumber', authenticateToken, async (req, res) => {
    try {
        const result = await machineTrackingService.getMachineTrackingInfo(req.params.serialNumber, req.user);
        if (!result) {
            return res.status(404).json({ error: 'الماكينة غير موجودة في المركز' });
        }
        res.json(result);
    } catch (error) {
        console.error('Failed to fetch machine tracking:', error);
        res.status(500).json({ error: 'فشل في جلب حالة الماكينة' });
    }
});

module.exports = router;
