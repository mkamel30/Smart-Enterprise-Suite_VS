/**
 * Code Protection & Hardware Binding Utility
 */
const { machineIdSync } = require('node-machine-id');
const db = require('../db');
const logger = require('./logger');

/**
 * Validates the current machine against an authorized HWID stored in the database.
 * The system identifies itself using process.env.BRANCH_CODE or process.env.BRANCH_ID.
 */
async function validateMachineBinding() {
    try {
        const currentId = machineIdSync();
        const branchCode = process.env.BRANCH_CODE; // The unique code of this branch

        if (!branchCode) {
            logger.warn('[SECURITY] No BRANCH_CODE found in environment. Hardware binding check skipped for now.');
            return true;
        }

        // Fetch branch info from DB
        const branch = await db.branch.findUnique({
            where: { code: branchCode },
            select: { authorizedHWID: true, name: true }
        });

        if (!branch) {
            logger.error({ branchCode }, '[SECURITY] Installation branch not found in database. System will not start.');
            if (process.env.NODE_ENV === 'production' || process.pkg) process.exit(1);
            return false;
        }

        if (!branch.authorizedHWID) {
            logger.warn({ branch: branch.name, currentHWID: currentId }, 
                '[SECURITY] No hardware registered for this branch. Please provide this HWID to the Admin.');
            return true; // Allow initial run to let admin set it
        }

        if (currentId !== branch.authorizedHWID) {
            logger.error({ 
                branch: branch.name,
                expected: branch.authorizedHWID, 
                actual: currentId 
            }, '[SECURITY] Unauthorized hardware detected for this branch. Application blocked.');
            
            if (process.env.NODE_ENV === 'production' || process.pkg) {
                process.exit(1);
            }
            return false;
        }

        logger.info({ branch: branch.name }, '[SECURITY] Hardware binding validated successfully.');
        return true;
    } catch (error) {
        logger.error({ error: error.message }, '[SECURITY] Failed to validate machine hardware ID');
        return false;
    }
}

module.exports = {
    validateMachineBinding,
    getHWID: () => machineIdSync()
};
