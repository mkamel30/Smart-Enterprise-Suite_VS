const express = require('express');
const router = express.Router();
const { authenticateToken, requireSuperAdmin } = require('../../../middleware/auth');
const { success, error } = require('../../../utils/apiResponse');
const asyncHandler = require('../../../utils/asyncHandler');
const axios = require('axios');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const UPDATE_MANIFEST_URL = process.env.UPDATE_MANIFEST_URL || 'https://api.github.com/repos/mkamel30/SmartEnterprise_BR/releases/latest';

router.get('/check', authenticateToken, requireSuperAdmin, asyncHandler(async (req, res) => {
    try {
        const response = await axios.get(UPDATE_MANIFEST_URL);
        const latestVersion = response.data.tag_name;
        const currentVersion = process.env.APP_VERSION || 'v1.0.0';

        const updateAvailable = latestVersion !== currentVersion;

        return success(res, {
            currentVersion,
            latestVersion,
            updateAvailable,
            releaseNotes: response.data.body,
            downloadUrl: response.data.assets?.[0]?.browser_download_url
        });
    } catch (err) {
        console.error('Update check failed:', err);
        return error(res, 'فشل التحقق من التحديثات', 500);
    }
}));

router.post('/apply', authenticateToken, requireSuperAdmin, asyncHandler(async (req, res) => {
    // This is a dangerous operation. In a real desktop app, a wrapper (Electron or a service)
    // would handle the actual file replacement and restart.
    // Here we just provide a placeholder that could trigger a git pull if in dev.
    
    if (process.env.NODE_ENV === 'development') {
        try {
            await execPromise('git pull origin main');
            return success(res, { message: 'تم سحب التحديثات البرمجية. يرجى إعادة تشغيل السيرفر.' });
        } catch (err) {
            return error(res, 'فشل سحب التحديثات: ' + err.message, 500);
        }
    }

    return error(res, 'التحديث الآلي مدعوم فقط من خلال تطبيق Windows المرفق.', 400);
}));

module.exports = router;
