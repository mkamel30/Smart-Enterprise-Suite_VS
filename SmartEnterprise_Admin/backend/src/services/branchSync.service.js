const axios = require('axios');
const prisma = require('../db');

/**
 * Service to synchronize data from the Central Portal to Branches
 */
const branchSyncService = {
    /**
     * Common push function
     */
    async pushToBranches(payload) {
        const branches = await prisma.branch.findMany({
            where: { isActive: true, url: { not: null, not: '' } }
        });

        if (branches.length === 0) return { success: 0, total: 0 };

        const results = await Promise.allSettled(branches.map(async (branch) => {
            const branchUrl = branch.url.endsWith('/') ? branch.url.slice(0, -1) : branch.url;
            return axios.post(`${branchUrl}/api/system/sync/parameters`, payload, {
                timeout: 5000,
                headers: {
                    'x-portal-sync-key': process.env.PORTAL_API_KEY || 'master_portal_key_internal',
                    'Content-Type': 'application/json'
                }
            });
        }));

        const successful = results.filter(r => r.status === 'fulfilled').length;
        return { success: successful, total: branches.length };
    },

    /**
     * Broadcast all global parameters
     */
    async broadcastParameters() {
        console.log('[BranchSync] Broadcasting global parameters...');
        try {
            const parameters = await prisma.globalParameter.findMany();
            return await this.pushToBranches({ globalParameters: parameters });
        } catch (error) {
            console.error('[BranchSync] Global parameters broadcast failed:', error);
        }
    },

    /**
     * Broadcast machine parameters
     */
    async broadcastMachineParameters() {
        console.log('[BranchSync] Broadcasting machine parameters...');
        try {
            const machineParameters = await prisma.machineParameter.findMany();
            return await this.pushToBranches({ machineParameters });
        } catch (error) {
            console.error('[BranchSync] Machine parameters broadcast failed:', error);
        }
    },

    /**
     * Broadcast master spare parts
     */
    async broadcastMasterSpareParts() {
        console.log('[BranchSync] Broadcasting spare parts catalog...');
        try {
            const masterParts = await prisma.masterSparePart.findMany();
            return await this.pushToBranches({ masterParts });
        } catch (error) {
            console.error('[BranchSync] Spare parts broadcast failed:', error);
        }
    }
};

module.exports = branchSyncService;
