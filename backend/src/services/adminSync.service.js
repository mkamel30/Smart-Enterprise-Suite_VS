const { io } = require('socket.io-client');
const db = require('../../db');

class AdminSyncService {
    constructor() {
        this.socket = null;
        this.portalUrl = process.env.PORTAL_URL;
        this.apiKey = process.env.PORTAL_API_KEY;
        this.branchCode = process.env.BRANCH_CODE;
        this.offlineQueue = [];
        this.maxRetries = 3;
        this.isConnected = false;
        this.lastSync = null;
        this.lastError = null;
    }

    getStatus() {
        return {
            portalConfigured: !!this.portalUrl,
            portalUrl: this.portalUrl,
            isConnected: this.isConnected,
            lastSync: this.lastSync,
            lastError: this.lastError,
            offlineQueueSize: this.offlineQueue.length
        };
    }

    init() {
        if (!this.portalUrl) {
            console.warn('AdminSync: PORTAL_URL not set, sync disabled');
            return;
        }

        console.log(`AdminSync: Connecting to ${this.portalUrl}...`);

        this.socket = io(this.portalUrl, {
            auth: { apiKey: this.apiKey },
            query: { branchCode: this.branchCode },
            reconnectionAttempts: 10,
            reconnectionDelay: 5000,
            timeout: 20000,
            transports: ['websocket', 'polling'],
            secure: true
        });

        this.socket.on('connect', async () => {
            this.isConnected = true;
            this.lastError = null;
            console.log('AdminSync: Connected to Central Portal');
            this.socket.emit('branch_identify', { branchCode: this.branchCode });

            console.log('AdminSync: Requesting initial sync...');
            this.socket.emit('branch_request_sync', {
                branchCode: this.branchCode,
                entities: ['branches', 'users', 'machineParameters', 'spareParts', 'globalParameters']
            });

            this.lastSync = new Date();
            await this.flushOfflineQueue();
        });

        this.socket.on('disconnect', () => {
            this.isConnected = false;
            console.warn('AdminSync: Disconnected from Central Portal');
        });

        this.socket.on('connect_error', (err) => {
            this.isConnected = false;
            this.lastError = err.message;
            console.error('AdminSync Connection Error:', err.message);
        });

        this.socket.on('portal_sync_response', async (response) => {
            if (!response.success) {
                console.error('AdminSync: Sync response error:', response.error);
                this.lastError = response.error;
                return;
            }

            this.lastSync = new Date();
            this.lastError = null;
            const { data } = response;
            if (data.branches) await this.syncBranches(data.branches);
            if (data.users) await this.syncUsers(data.users);
            if (data.machineParameters) await this.syncMachineParameters(data.machineParameters);
            if (data.masterSpareParts) await this.syncSpareParts(data.masterSpareParts);
            if (data.sparePartPriceLogs) await this.syncSparePartPriceLogs(data.sparePartPriceLogs);
            if (data.globalParameters) await this.syncGlobalParameters(data.globalParameters);

            console.log('AdminSync: Initial sync from portal complete');
        });

        this.socket.on('admin_update', async (update) => {
            const { queueId, entityType, action, payload } = update;
            console.log(`AdminSync: Received ${entityType} [${action}]`);

            try {
                await this.processEntityUpdate(entityType, action, payload);
                if (queueId) {
                    this.socket.emit('ack_update', { queueId });
                }
            } catch (err) {
                console.error(`AdminSync: Failed to process ${entityType} update:`, err.message);
            }
        });

        this.socket.on('SYSTEM_DIRECTIVE', async (data) => {
            console.log('AdminSync: System Directive:', data.action);
            if (data.action === 'REQUEST_FULL_SYNC') {
                await this.pushAllDataToAdmin();
            }
        });

        this.socket.on('request_branch_stock', async (data) => {
            const { partId, requestId } = data;
            console.log(`AdminSync: Admin requested stock for part ${partId}`);
            try {
                const branchCode = process.env.BRANCH_CODE || 'UNKNOWN';
                const branch = await db.branch.findFirst();
                const branchName = branch?.name || branchCode;

                const stockItem = await db.branchSparePartStock.findUnique({
                    where: { partId }
                });

                this.socket.emit('branch_stock_response', {
                    requestId,
                    partId,
                    branchId: branch?.id,
                    branchCode,
                    branchName,
                    quantity: stockItem?.quantity || 0,
                    location: stockItem?.location || null,
                    lastUpdated: stockItem?.lastUpdated || null,
                    timestamp: new Date()
                });
                console.log(`AdminSync: Sent stock response for part ${partId}`);
            } catch (error) {
                console.error('AdminSync: Error responding to stock request:', error.message);
                this.socket.emit('branch_stock_response', {
                    requestId,
                    partId,
                    error: error.message,
                    timestamp: new Date()
                });
            }
        });
    }

    async processEntityUpdate(entityType, action, payload) {
        switch (entityType) {
            case 'GLOBAL_PARAMETER':
                await this.syncGlobalParameters(Array.isArray(payload) ? payload : [payload], action);
                break;
            case 'MACHINE_PARAMETER':
                await this.syncMachineParameters(Array.isArray(payload) ? payload : [payload], action);
                break;
            case 'SPARE_PART':
                await this.syncSpareParts(Array.isArray(payload) ? payload : [payload], action);
                break;
            case 'SPARE_PART_PRICE_LOG':
                await this.syncSparePartPriceLogs(Array.isArray(payload) ? payload : [payload], action);
                break;
            case 'USER':
                await this.syncUsers(Array.isArray(payload) ? payload : [payload], action);
                break;
            case 'BRANCH':
                await this.syncBranches(Array.isArray(payload) ? payload : [payload], action);
                break;
            default:
                console.warn(`AdminSync: Unknown entity type: ${entityType}`);
        }
    }

    async syncGlobalParameters(params, action) {
        for (const p of params) {
            if (action === 'DELETE') {
                await db.globalParameter.deleteMany({ where: { id: p.id } }).catch(() => {});
                console.log(`AdminSync: Deleted globalParameter ${p.id}`);
            } else {
                await db.globalParameter.upsert({
                    where: { key: p.key },
                    update: { value: String(p.value), type: p.type, group: p.group },
                    create: { key: p.key, value: String(p.value), type: p.type || 'STRING', group: p.group || null }
                });
                console.log(`AdminSync: Synced globalParameter ${p.key}`);
            }
        }
    }

    async syncMachineParameters(params, action) {
        for (const p of params) {
            if (action === 'DELETE') {
                await db.machineParameter.deleteMany({ where: { id: p.id } }).catch(() => {});
            } else {
                await db.machineParameter.upsert({
                    where: { prefix: p.prefix },
                    update: { model: p.model, manufacturer: p.manufacturer },
                    create: { prefix: p.prefix, model: p.model, manufacturer: p.manufacturer }
                });
                console.log(`AdminSync: Synced machineParameter ${p.prefix}`);
            }
        }
    }

    async syncSpareParts(parts, action) {
        for (const part of parts) {
            if (action === 'DELETE') {
                await db.masterSparePart.deleteMany({ where: { id: part.id } }).catch(() => {});
            } else {
                await db.masterSparePart.upsert({
                    where: { id: part.id },
                    update: {
                        partNumber: part.partNumber,
                        name: part.name,
                        description: part.description,
                        compatibleModels: part.compatibleModels,
                        defaultCost: part.defaultCost,
                        isConsumable: part.isConsumable,
                        category: part.category
                    },
                    create: {
                        id: part.id,
                        partNumber: part.partNumber,
                        name: part.name,
                        description: part.description,
                        compatibleModels: part.compatibleModels,
                        defaultCost: part.defaultCost,
                        isConsumable: part.isConsumable,
                        category: part.category
                    }
                });
                console.log(`AdminSync: Synced masterSparePart ${part.name}`);
            }
        }
    }

    async syncSparePartPriceLogs(logs, action) {
        for (const log of logs) {
            if (action === 'DELETE') {
                await db.sparePartPriceLog.deleteMany({ where: { id: log.id } }).catch(() => {});
            } else {
                await db.sparePartPriceLog.upsert({
                    where: { id: log.id },
                    update: {
                        oldCost: log.oldCost,
                        newCost: log.newCost,
                        changedBy: log.changedBy
                    },
                    create: {
                        id: log.id,
                        partId: log.partId,
                        oldCost: log.oldCost,
                        newCost: log.newCost,
                        changedBy: log.changedBy
                    }
                });
            }
        }
        console.log(`AdminSync: Synced ${logs.length} spare part price logs`);
    }

    async syncUsers(users, action) {
        for (const user of users) {
            if (action === 'DELETE') {
                await db.user.deleteMany({ where: { id: user.id } }).catch(() => {});
            } else {
                let localBranchId = user.branchId;
                if (localBranchId) {
                    const exists = await db.branch.findUnique({ where: { id: localBranchId } });
                    if (!exists) {
                        console.warn(`AdminSync: Branch ${localBranchId} not found for user ${user.username}`);
                        localBranchId = null;
                    }
                }

                const userWhere = user.id ? { id: user.id } : { username: user.username };
                await db.user.upsert({
                    where: userWhere,
                    update: {
                        uid: user.uid,
                        username: user.username,
                        email: user.email,
                        displayName: user.displayName,
                        role: user.role,
                        password: user.password,
                        isActive: user.isActive,
                        branchId: localBranchId
                    },
                    create: {
                        id: user.id || undefined,
                        uid: user.uid,
                        username: user.username,
                        email: user.email,
                        displayName: user.displayName,
                        role: user.role,
                        password: user.password,
                        isActive: user.isActive,
                        branchId: localBranchId
                    }
                });
                console.log(`AdminSync: Synced user ${user.username}`);
            }
        }
    }

    async syncBranches(branches, action) {
        for (const branch of branches) {
            if (action === 'DELETE') {
                await db.branch.deleteMany({ where: { id: branch.id } }).catch(() => {});
            } else {
                await db.branch.upsert({
                    where: { id: branch.id },
                    update: {
                        code: branch.code,
                        name: branch.name,
                        location: branch.location,
                        type: branch.type,
                        status: branch.status,
                        parentBranchId: branch.parentBranchId
                    },
                    create: {
                        id: branch.id,
                        code: branch.code,
                        name: branch.name,
                        location: branch.location,
                        type: branch.type,
                        status: branch.status,
                        parentBranchId: branch.parentBranchId
                    }
                });
                console.log(`AdminSync: Synced branch ${branch.code}`);
            }
        }
    }

    async queueForRetry(event, payload) {
        this.offlineQueue.push({ event, payload, retries: 0 });
        console.log(`AdminSync: Queued ${event} for retry (queue size: ${this.offlineQueue.length})`);
    }

    async flushOfflineQueue() {
        if (this.offlineQueue.length === 0 || !this.socket?.connected) return;

        console.log(`AdminSync: Flushing offline queue (${this.offlineQueue.length} items)...`);
        const queue = [...this.offlineQueue];
        this.offlineQueue = [];

        for (const item of queue) {
            try {
                this.socket.emit(item.event, item.payload);
                console.log(`AdminSync: Replayed ${item.event}`);
            } catch (err) {
                console.error(`AdminSync: Failed to replay ${item.event}:`, err.message);
                if (item.retries < this.maxRetries) {
                    item.retries++;
                    this.offlineQueue.push(item);
                }
            }
        }
    }

    async syncUserToAdmin(user) {
        if (!this.socket?.connected) {
            this.queueForRetry('branch_user_update', { user, branchCode: this.branchCode });
            return;
        }
        this.socket.emit('branch_user_update', { user, branchCode: this.branchCode });
    }

    async pushAllDataToAdmin() {
        if (!this.socket?.connected) {
            console.warn('AdminSync: Cannot push — not connected');
            return;
        }

        console.log('AdminSync: Gathering data for full push...');
        try {
            const [users, machineParams] = await Promise.all([
                db.user.findMany({ include: { branch: true } }),
                db.machineParameter.findMany()
            ]);

            const payload = {
                branchCode: this.branchCode,
                users,
                machineParams,
                timestamp: new Date()
            };

            this.socket.emit('branch_push_all', payload);
            console.log(`AdminSync: Full push sent (${users.length} users, ${machineParams.length} params)`);
        } catch (error) {
            console.error('AdminSync: Full push failed:', error.message);
        }
    }
}

module.exports = new AdminSyncService();
