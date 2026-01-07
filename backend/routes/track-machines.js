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
        res.status(error.status || 500).json({ error: error.message || 'ظپط´ظ„ ظپظٹ ط¬ظ„ط¨ ط­ط§ظ„ط© ط§ظ„ظ…ط§ظƒظٹظ†ط§طھ' });
    }
});

// Get summary of machines at maintenance center
router.get('/summary', authenticateToken, async (req, res) => {
    try {
        const result = await machineTrackingService.getTrackingSummary(req.query, req.user);
        res.json(result);
    } catch (error) {
        console.error('Failed to fetch tracking summary:', error);
        res.status(error.status || 500).json({ error: error.message || 'ظپط´ظ„ ظپظٹ ط¬ظ„ط¨ ظ…ظ„ط®طµ ط§ظ„ظ…طھط§ط¨ط¹ط©' });
    }
});

// Get single machine tracking info
router.get('/:serialNumber', authenticateToken, async (req, res) => {
    try {
        const result = await machineTrackingService.getMachineTrackingInfo(req.params.serialNumber, req.user);
        if (!result) {
            return res.status(404).json({ error: 'ط§ظ„ظ…ط§ظƒظٹظ†ط© ط؛ظٹط± ظ…ظˆط¬ظˆط¯ط© ظپظٹ ط§ظ„ظ…ط±ظƒط²' });
        }
        res.json(result);
    } catch (error) {
        console.error('Failed to fetch machine tracking:', error);
        res.status(500).json({ error: 'ظپط´ظ„ ظپظٹ ط¬ظ„ط¨ ط­ط§ظ„ط© ط§ظ„ظ…ط§ظƒظٹظ†ط©' });
    }
});

module.exports = router;
