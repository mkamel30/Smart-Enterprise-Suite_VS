const { io } = require('socket.io-client');
const axios = require('axios');
const db = require('../../db');
const logger = require('../../utils/logger');

let socket = null;

const adminSyncService = {
    init() {
        const portalUrl = process.env.PORTAL_URL;
        const portalApiKey = process.env.PORTAL_API_KEY; // Branch API Key
        
        if (!portalUrl || !portalApiKey) {
            logger.debug('[AdminSync] No PORTAL_URL or KEY configured, skipping WebSocket sync.');
            return;
        }

        logger.info({ portalUrl }, '[AdminSync] Connecting to Central Admin Portal via WebSocket...');

        // Connect to the Admin socket
        socket = io(portalUrl, {
            auth: { apiKey: portalApiKey },
            reconnection: true,
            reconnectionDelay: 5000,
        });

        socket.on('connect', () => {
            logger.info('[AdminSync] Connected to Central Admin Portal');
        });

        socket.on('disconnect', () => {
            logger.warn('[AdminSync] Disconnected from Central Admin Portal. Retrying...');
        });

        socket.on('connect_error', (err) => {
            logger.error(`[AdminSync] Connection error: ${err.message}`);
        });

        // Listen for real-time updates from Central Admin
        socket.on('admin_update', async (data) => {
            const { queueId, entityType, action, payload } = data;
            logger.info(`[AdminSync] Received update. Entity: ${entityType}, Action: ${action}`);

            try {
                await this.processUpdate(entityType, action, payload);
                
                // Create a local notification for branch users
                let title = 'تحديث مركزي';
                let message = `تم تحديث ${entityType} من قبل الإدارة المركزية`;
                if (entityType === 'GLOBAL_PARAMETER') message = 'تم تحديث بارامترات النظام';
                else if (entityType === 'SPARE_PART') message = `تم تحديث بيانات قطعة الغيار: ${payload.name || ''}`;
                else if (entityType === 'MACHINE_PARAMETER') message = `تم إضافة/تحديث موديل ماكينة: ${payload.model || ''}`;

                await db.notification.create({
                    data: {
                        type: 'INFO',
                        title,
                        message,
                        link: '/settings'
                    }
                });

                // Acknowledge the update back to Admin so it drops from the Queue
                socket.emit('ack_update', { queueId });
                logger.debug(`[AdminSync] Acknowledged update ${queueId}`);

            } catch (err) {
                logger.error(`[AdminSync] Error processing update ${queueId}: ${err.message}`);
            }
        });
    },

    async processUpdate(entityType, action, payload) {
        if (entityType === 'GLOBAL_PARAMETER') {
            if (action === 'BROADCAST') {
                for (const param of payload) {
                    await db.globalParameter.upsert({
                        where: { key: param.key },
                        update: { value: String(param.value), type: param.type, group: param.group },
                        create: { key: param.key, value: String(param.value), type: param.type, group: param.group }
                    });
                }
            } else if (action === 'UPSERT' || action === 'UPDATE') {
                await db.globalParameter.upsert({
                    where: { key: payload.key },
                    update: { value: String(payload.value), type: payload.type, group: payload.group },
                    create: { key: payload.key, value: String(payload.value), type: payload.type, group: payload.group }
                });
            } else if (action === 'DELETE') {
                await db.globalParameter.deleteMany({ where: { id: payload.id } });
            }
        } 
        else if (entityType === 'SPARE_PART') {
            if (action === 'BROADCAST') {
                for (const part of payload) {
                    await db.sparePart.upsert({
                        where: { partNumber: part.partNumber || '' },
                        update: { name: part.name, defaultCost: part.defaultCost, compatibleModels: part.compatibleModels },
                        create: { partNumber: part.partNumber, name: part.name, defaultCost: part.defaultCost, compatibleModels: part.compatibleModels }
                    });
                }
            } else if (action === 'UPSERT' || action === 'UPDATE') {
                await db.sparePart.upsert({
                    where: { partNumber: payload.partNumber },
                    update: { name: payload.name, defaultCost: payload.defaultCost, compatibleModels: payload.compatibleModels },
                    create: { partNumber: payload.partNumber, name: payload.name, defaultCost: payload.defaultCost, compatibleModels: payload.compatibleModels }
                });
            }
        }
        else if (entityType === 'MACHINE_PARAMETER') {
             if (action === 'BROADCAST') {
                for (const param of payload) {
                    await db.machineParameter.upsert({
                        where: { prefix: param.prefix },
                        update: { model: param.model, manufacturer: param.manufacturer },
                        create: { prefix: param.prefix, model: param.model, manufacturer: param.manufacturer }
                    });
                }
            } else if (action === 'UPSERT' || action === 'UPDATE') {
                await db.machineParameter.upsert({
                    where: { prefix: payload.prefix },
                    update: { model: payload.model, manufacturer: payload.manufacturer },
                    create: { prefix: payload.prefix, model: payload.model, manufacturer: payload.manufacturer }
                });
            }
        }
        else if (entityType === 'SYSTEM_DIRECTIVE' && action === 'REQUEST_FULL_SYNC') {
            logger.info('[AdminSync] Central Admin requested a Full Data Sync. Initiating...');
            await this.pushAllDataToAdmin();
        }
    },

    async pushAllDataToAdmin() {
        try {
            const portalUrl = process.env.PORTAL_URL;
            const portalApiKey = process.env.PORTAL_API_KEY;

            // Gather all branch data
            const payments = await db.payment.findMany();
            const maintenanceRequests = await db.maintenanceRequest.findMany();
            const users = await db.user.findMany();
            const customers = await db.customer.findMany();
            const posMachines = await db.posMachine.findMany();

            const payload = {
                payments,
                maintenanceRequests,
                users,
                customers,
                posMachines
            };

            await axios.post(`${portalUrl}/api/sync/push`, payload, {
                headers: { 'x-branch-api-key': portalApiKey },
                timeout: 30000 // 30s timeout for large payloads
            });
            
            logger.info('[AdminSync] Full Data Sync completed successfully');
        } catch (error) {
            logger.error(`[AdminSync] Failed to push all data to Admin: ${error.message}`);
        }
    },

    /**
     * Upward Sync: Send a newly created or updated branch user to the Central Admin
     */
    syncUserToAdmin(userObj) {
        if (socket && socket.connected) {
            socket.emit('branch_user_update', { user: userObj });
            logger.debug(`[AdminSync] Emitted branch_user_update for ${userObj.username}`);
        }
    }
};

module.exports = adminSyncService;
