const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { BadRequestError, NotFoundError, ConflictError } = require('../utils/errors');
const { validateBranches } = require('../utils/transfer-validators');
const { generateOrderNumber } = require('./transfer/coreService');
const { createNotification } = require('../routes/notifications');
const { detectMachineParams } = require('../utils/machine-validation');

/**
 * Administrative Affairs Store Service
 */
const adminStoreService = {
    // --- Item Type Management ---

    async listItemTypes() {
        return await prisma.adminStoreItemType.findMany({
            orderBy: { name: 'asc' }
        });
    },

    async createItemType(data, user) {
        const existing = await prisma.adminStoreItemType.findUnique({
            where: { code: data.code }
        });
        if (existing) throw new ConflictError('Item type code already exists');

        return await prisma.adminStoreItemType.create({
            data: {
                ...data
            }
        });
    },

    async updateItemType(id, data) {
        return await prisma.adminStoreItemType.update({
            where: { id },
            data
        });
    },

    // --- Asset Management ---

    async listAssets(filters = {}) {
        const { itemTypeCode, branchId, status, search } = filters;
        const where = {};
        if (itemTypeCode) where.itemTypeCode = itemTypeCode;
        if (branchId) where.branchId = branchId;
        if (status) where.status = status;
        if (search) {
            where.OR = [
                { serialNumber: { contains: search, mode: 'insensitive' } },
                { cartonCode: { contains: search, mode: 'insensitive' } },
                { notes: { contains: search, mode: 'insensitive' } }
            ];
        }

        return await prisma.adminStoreAsset.findMany({
            where,
            include: {
                itemType: true,
                branch: { select: { name: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
    },

    async getAssetHistory(assetId) {
        console.log(`[DEBUG] getAssetHistory called for assetId: ${assetId}`);
        try {
            const history = await prisma.adminStoreMovement.findMany({
                where: { assetId },
                orderBy: { createdAt: 'desc' }
            });
            console.log(`[DEBUG] Found ${history.length} movement records`);

            // Collect all branch IDs to fetch names
            const branchIds = new Set();
            history.forEach(m => {
                if (m.fromBranchId) branchIds.add(m.fromBranchId);
                if (m.toBranchId) branchIds.add(m.toBranchId);
            });

            console.log(`[DEBUG] Branch IDs to fetch: ${Array.from(branchIds).join(', ')}`);

            let branchMap = {};
            if (branchIds.size > 0) {
                const branches = await prisma.branch.findMany({
                    where: { id: { in: Array.from(branchIds) } },
                    select: { id: true, name: true }
                });
                console.log(`[DEBUG] Fetched ${branches.length} branches`);
                branchMap = Object.fromEntries(branches.map(b => [b.id, b.name]));
            }

            // Augment history with branch names
            const augmentedHistory = history.map(m => ({
                ...m,
                fromBranch: m.fromBranchId ? { name: branchMap[m.fromBranchId] || m.fromBranchId } : null,
                toBranch: m.toBranchId ? { name: branchMap[m.toBranchId] || m.toBranchId } : null
            }));

            // If no history exists, fetch creation info
            if (augmentedHistory.length === 0) {
                console.log('[DEBUG] No history found, fetching asset creation info');
                const asset = await prisma.adminStoreAsset.findUnique({
                    where: { id: assetId },
                    select: { createdBy: true, createdAt: true }
                });

                if (asset) {
                    console.log('[DEBUG] Asset found, returning creation info as history');
                    return [{
                        id: 'creation',
                        type: 'IMPORT',
                        createdAt: asset.createdAt,
                        notes: 'تاريخ إضافة الأصل للنظام',
                        performedBy: asset.createdBy
                    }];
                } else {
                    console.log('[DEBUG] Asset not found');
                }
            }

            return augmentedHistory;
        } catch (error) {
            console.error('[ERROR] getAssetHistory failed:', error);
            throw error;
        }
    },

    async createAssetManual(data, user) {
        const { serialNumber, itemTypeCode, cartonCode, notes, quantity, simProvider, simNetworkType } = data;

        if (!itemTypeCode) throw new BadRequestError('Item type code is required');

        // Clean optional fields
        const cleanItemTypeCode = itemTypeCode.trim();
        const cleanCartonCode = (cartonCode && cartonCode.trim()) || null;

        // Fetch Item Type to check tracking mode
        const itemType = await prisma.adminStoreItemType.findUnique({ where: { code: cleanItemTypeCode } });
        if (!itemType) throw new BadRequestError('Item Type not found');

        // --- QUANTITY BASED (e.g. Rolls) ---
        if (itemType.trackingMode === 'QUANTITY_BASED') {
            if (!quantity || quantity <= 0) throw new BadRequestError('Quantity is required for non-serialized items');
            return await this._createStock({
                itemTypeCode: cleanItemTypeCode,
                branchId: null, // Admin Store
                quantity: parseInt(quantity),
                notes,
                performedBy: user.displayName || user.email
            });
        }

        // --- SERIAL BASED (Machines, SIMs) ---
        if (!serialNumber) throw new BadRequestError('Serial number is required');

        // Check uniqueness
        const existing = await prisma.adminStoreAsset.findUnique({
            where: { serialNumber }
        });
        if (existing) throw new ConflictError(`Serial number ${serialNumber} already exists`);

        const isSim = itemType.category === 'SIM' || itemType.code === 'SIM' || itemType.name.includes('شريحة');

        let detected = { model: null, manufacturer: null };
        if (!isSim) {
            const machineParams = await prisma.machineParameter.findMany();
            detected = detectMachineParams(serialNumber, machineParams);
        }

        return await prisma.$transaction(async (tx) => {
            const asset = await tx.adminStoreAsset.create({
                data: {
                    serialNumber,
                    itemTypeCode: cleanItemTypeCode,
                    model: detected.model,
                    manufacturer: detected.manufacturer,
                    // SIM Fields
                    simProvider: isSim ? simProvider : null,
                    simNetworkType: isSim ? simNetworkType : null,

                    cartonCode: cleanCartonCode,
                    notes,
                    createdBy: user.displayName || user.email,
                    status: 'IN_ADMIN_STORE'
                }
            });

            // Log movement
            await tx.adminStoreMovement.create({
                data: {
                    assetId: asset.id,
                    type: 'IMPORT',
                    toStatus: 'IN_ADMIN_STORE',
                    notes: 'إضافة يدوية للأصل',
                    performedBy: user.displayName || user.email
                }
            });

            return asset;
        });
    },

    // Helper for Stock Creation/Update
    async _createStock({ itemTypeCode, branchId, quantity, notes, performedBy, type = 'IMPORT' }) {
        return await prisma.$transaction(async (tx) => {
            // Find existing stock record
            const existingStock = await tx.adminStoreStock.findFirst({
                where: {
                    itemTypeCode,
                    branchId: branchId || null
                }
            });

            let stock;
            if (existingStock) {
                // Update existing
                stock = await tx.adminStoreStock.update({
                    where: { id: existingStock.id },
                    data: {
                        quantity: { increment: quantity }
                    }
                });
            } else {
                // Create new
                stock = await tx.adminStoreStock.create({
                    data: {
                        itemTypeCode,
                        branchId: branchId || null,
                        quantity
                    }
                });
            }

            // Log Movement
            await tx.adminStoreStockMovement.create({
                data: {
                    itemTypeCode,
                    type,
                    quantity,
                    toBranchId: branchId || null,
                    notes,
                    performedBy
                }
            });

            return stock;
        });
    },

    /**
     * Bulk import from Excel data
     */
    async importAssets(assetsData, user) {
        const results = { success: 0, errors: [] };
        const creator = user.displayName || user.email;

        // Cache Item Types
        const itemTypes = await prisma.adminStoreItemType.findMany();
        const itemTypeMap = Object.fromEntries(itemTypes.map(t => [t.code, t]));

        // Load machine params once for all imports
        const machineParams = await prisma.machineParameter.findMany();

        for (let i = 0; i < assetsData.length; i++) {
            const row = assetsData[i];
            const rowNum = i + 2; // Assuming header is row 1

            try {
                if (!row.itemTypeCode) throw new Error('Item type code is required');

                const itemType = itemTypeMap[row.itemTypeCode];
                if (!itemType) throw new Error(`Unknown Item Type Code: ${row.itemTypeCode}`);

                // --- QUANTITY BASED ---
                if (itemType.trackingMode === 'QUANTITY_BASED') {
                    const qty = parseInt(row.quantity || row.machinesCount || 1); // fallback to 1 if not specified
                    if (isNaN(qty) || qty <= 0) throw new Error('Invalid Quantity');

                    await this._createStock({
                        itemTypeCode: itemType.code,
                        branchId: null,
                        quantity: qty,
                        notes: row.notes || 'Bulk Import',
                        performedBy: creator // Pass creator correctly
                    });
                    results.success++;
                    continue;
                }

                // --- SERIAL BASED ---
                if (!row.serialNumber) throw new Error('Serial number is required');

                // Check uniqueness in this batch? (Assume user checked, but DB will enforce)
                // DB check:
                const duplicateInDb = await prisma.adminStoreAsset.findUnique({
                    where: { serialNumber: row.serialNumber.toString() }
                });
                if (duplicateInDb) throw new Error(`Serial ${row.serialNumber} already exists in database`);

                const isSim = itemType.category === 'SIM' || itemType.code === 'SIM' || itemType.name.includes('شريحة');
                let detected = { model: null, manufacturer: null };

                let simData = {};
                if (isSim) {
                    simData.simProvider = row.simProvider || this._detectSimProvider(row.serialNumber);
                    simData.simNetworkType = row.simNetworkType || '4G'; // default
                } else {
                    detected = detectMachineParams(row.serialNumber.toString(), machineParams);
                }

                await prisma.$transaction(async (tx) => {
                    const asset = await tx.adminStoreAsset.create({
                        data: {
                            serialNumber: row.serialNumber.toString(),
                            itemTypeCode: row.itemTypeCode,
                            model: detected.model,
                            manufacturer: detected.manufacturer,
                            ...simData,
                            cartonCode: row.cartonCode ? row.cartonCode.toString() : null,
                            notes: row.notes || null,
                            createdBy: creator,
                            status: 'IN_ADMIN_STORE'
                        }
                    });

                    await tx.adminStoreMovement.create({
                        data: {
                            assetId: asset.id,
                            type: 'IMPORT',
                            toStatus: 'IN_ADMIN_STORE',
                            notes: 'استيراد من ملف Excel',
                            performedBy: creator
                        }
                    });
                });
                results.success++;
            } catch (err) {
                results.errors.push({ row: rowNum, error: err.message, serial: row.serialNumber || 'N/A' });
            }
        }

        return results;
    },

    _detectSimProvider(iccid) {
        if (!iccid) return null;
        const s = iccid.toString();
        if (s.startsWith('892010')) return 'Vodafone';
        if (s.startsWith('892012')) return 'Orange';
        if (s.startsWith('892011')) return 'Etisalat'; // Example prefix
        if (s.startsWith('892015')) return 'WE';       // Example prefix
        return null;
    },

    // --- Stock Management ---

    // --- Stock Management moved to the end of file for consistency ---

    // --- Carton Management ---

    async listCartons(filters = {}) {
        const { itemTypeCode, search } = filters;
        const where = {};
        if (itemTypeCode) where.itemTypeCode = itemTypeCode;
        if (search) {
            where.cartonCode = { contains: search, mode: 'insensitive' };
        }

        return await prisma.adminStoreCarton.findMany({
            where,
            include: { itemType: true },
            orderBy: { createdAt: 'desc' }
        });
    },

    async createCarton(data, user) {
        const { cartonCode, itemTypeCode, machinesCount, isSerialContinuous, firstSerialNumber, serialList, notes, simProvider, simNetworkType } = data;
        const creator = user.displayName || user.email;

        // Validate carton uniqueness
        const existingCarton = await prisma.adminStoreCarton.findUnique({ where: { cartonCode } });
        if (existingCarton) throw new ConflictError(`Carton code ${cartonCode} already exists`);

        let serials = [];
        if (isSerialContinuous) {
            if (!firstSerialNumber) throw new BadRequestError('First serial is required for continuous range');
            serials = this._generateSerialRange(firstSerialNumber, machinesCount);
        } else {
            if (!serialList || !Array.isArray(serialList)) throw new BadRequestError('Serial list is required');
            if (serialList.length !== machinesCount) throw new BadRequestError(`Serial list count (${serialList.length}) does not match machines count (${machinesCount})`);
            serials = serialList;
        }

        // Check all serials for existence
        const duplicates = await prisma.adminStoreAsset.findMany({
            where: { serialNumber: { in: serials.map(s => s.toString()) } },
            select: { serialNumber: true }
        });

        if (duplicates.length > 0) {
            const dupList = duplicates.map(d => d.serialNumber).join(', ');
            throw new ConflictError(`The following serials already exist: ${dupList}`);
        }

        // Load machine params for detection
        const itemType = await prisma.adminStoreItemType.findUnique({ where: { code: itemTypeCode } });
        const isSim = itemType?.code === 'SIM' || itemType?.name.includes('شريحة');
        const machineParams = !isSim ? await prisma.machineParameter.findMany() : [];

        // Transactional creation
        return await prisma.$transaction(async (tx) => {
            const carton = await tx.adminStoreCarton.create({
                data: {
                    cartonCode,
                    itemTypeCode,
                    machinesCount,
                    isSerialContinuous,
                    firstSerialNumber,
                    lastSerialNumber: isSerialContinuous ? serials[serials.length - 1].toString() : null,
                    notes,
                    createdBy: creator
                }
            });

            const assetPromises = serials.map(sn => {
                const detected = !isSim ? detectMachineParams(sn.toString(), machineParams) : { model: null, manufacturer: null };
                return tx.adminStoreAsset.create({
                    data: {
                        serialNumber: sn.toString(),
                        itemTypeCode,
                        model: detected.model,
                        manufacturer: detected.manufacturer,
                        // SIM Fields
                        simProvider: isSim ? simProvider : null,
                        simNetworkType: isSim ? simNetworkType : null,
                        cartonCode,
                        createdBy: creator,
                        status: 'IN_ADMIN_STORE'
                    }
                }).then(asset => tx.adminStoreMovement.create({
                    data: {
                        assetId: asset.id,
                        type: 'IMPORT',
                        toStatus: 'IN_ADMIN_STORE',
                        notes: `إضافة ضمن كرتونة: ${cartonCode}`,
                        performedBy: creator
                    }
                }));
            });

            await Promise.all(assetPromises);
            return carton;
        });
    },

    _generateSerialRange(start, count) {
        const serials = [];
        // Extract numeric part
        const match = start.match(/^(.*?)(\d+)$/);
        if (!match) {
            // If no numeric part, we can't increment, just repeat (though not ideal)
            for (let i = 0; i < count; i++) serials.push(start);
            return serials;
        }

        const prefix = match[1];
        const numberStr = match[2];
        const number = parseInt(numberStr);
        const padLength = numberStr.length;

        for (let i = 0; i < count; i++) {
            const currentNum = (number + i).toString().padStart(padLength, '0');
            serials.push(`${prefix}${currentNum}`);
        }
        return serials;
    },

    // --- Transfer Management ---

    async _getAdminBranchId() {
        const branch = await prisma.branch.findFirst({ where: { type: 'ADMIN_AFFAIRS' } });
        return branch?.id;
    },

    async transferAsset(assetId, targetBranchId, user, notes) {
        const fromBranchId = user.branchId || await this._getAdminBranchId();
        if (!fromBranchId) throw new BadRequestError('Source branch not found');

        return await prisma.$transaction(async (tx) => {
            const asset = await tx.adminStoreAsset.findUnique({
                where: { id: assetId },
                include: { itemType: true }
            });
            if (!asset) throw new NotFoundError('Asset not found');
            if (asset.status !== 'IN_ADMIN_STORE') throw new BadRequestError('هذا الصنف محول بالفعل أو غير موجود في المخزن الإداري حالياً');

            // Apply "The Binding Law" (القانون الملزم)
            const validation = await validateBranches(fromBranchId, targetBranchId, 'ASSET');
            if (!validation.valid) {
                throw new BadRequestError(validation.errors.join(' | '));
            }

            const itemType = asset.itemType;
            const isSim = itemType.code === 'SIM' || itemType.name.includes('شريحة');
            const type = isSim ? 'SIM' : 'MACHINE';

            const machineParams = !isSim ? await tx.machineParameter.findMany() : [];
            const detected = !isSim ? detectMachineParams(asset.serialNumber, machineParams) : { model: null, manufacturer: null };

            // 1. Create Transfer Order
            const orderNumber = generateOrderNumber();
            const order = await tx.transferOrder.create({
                data: {
                    orderNumber, fromBranchId, toBranchId: targetBranchId, branchId: targetBranchId, status: 'PENDING', type,
                    notes: `نقل صنف إداري. ${notes || ''}`,
                    createdByUserId: user.id || null,
                    createdByName: user.displayName || user.email || 'System',
                    items: {
                        create: [{
                            serialNumber: asset.serialNumber,
                            type,
                            model: isSim ? (asset.simNetworkType || '4G') : (detected.model || itemType.name),
                            manufacturer: isSim ? (asset.simProvider || 'Vodafone') : (detected.manufacturer || 'الشئون الإدارية'),
                            notes: `الصنف الأصلي: ${itemType.name} (وارد الشئون الإدارية)`
                        }]
                    }
                }
            });

            // 2. Update AdminStoreAsset status
            const updated = await tx.adminStoreAsset.update({
                where: { id: assetId },
                data: {
                    status: 'TRANSFERRED',
                    updatedAt: new Date(),
                    branchId: targetBranchId
                }
            });

            // 3. Create WarehouseMachine/Sim entry in target branch as IN_TRANSIT
            if (isSim) {
                await tx.warehouseSim.upsert({
                    where: { serialNumber: asset.serialNumber },
                    update: {
                        status: 'IN_TRANSIT',
                        branchId: targetBranchId,
                        type: asset.simProvider || 'SIM',
                        networkType: asset.simNetworkType,
                        updatedAt: new Date()
                    },
                    create: {
                        id: `sim_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                        serialNumber: asset.serialNumber,
                        type: asset.simProvider || 'SIM',
                        networkType: asset.simNetworkType,
                        status: 'IN_TRANSIT',
                        branchId: targetBranchId,
                        updatedAt: new Date()
                    }
                });
            } else {
                await tx.warehouseMachine.upsert({
                    where: { serialNumber: asset.serialNumber },
                    update: {
                        status: 'IN_TRANSIT',
                        branchId: targetBranchId,
                        model: detected.model || itemType.name,
                        manufacturer: detected.manufacturer || 'الشئون الإدارية',
                        notes: (asset.notes || '') + ` | الصنف الأصلي: ${itemType.name}`,
                        updatedAt: new Date()
                    },
                    create: {
                        id: `mach_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                        serialNumber: asset.serialNumber,
                        model: detected.model || itemType.name,
                        manufacturer: detected.manufacturer || 'الشئون الإدارية',
                        notes: `الصنف الأصلي: ${itemType.name} (وارد الشئون الإدارية)`,
                        status: 'IN_TRANSIT',
                        branchId: targetBranchId,
                        updatedAt: new Date()
                    }
                });
            }

            // 4. Log movement
            await tx.adminStoreMovement.create({
                data: {
                    assetId,
                    type: 'TRANSFER',
                    fromBranchId,
                    toBranchId: targetBranchId,
                    fromStatus: asset.status,
                    toStatus: 'TRANSFERRED',
                    notes: `Transfer Order: ${orderNumber}. ${notes || ''}`,
                    performedBy: user.displayName || user.email || 'System'
                }
            });

            // Notification
            await createNotification({
                branchId: targetBranchId,
                type: 'TRANSFER_ORDER',
                title: 'إذن صرف إداري جديد',
                message: `وصلك إذن صرف رقم ${orderNumber} من الشئون الإدارية`,
                data: { orderId: order.id, orderNumber }
            });

            return updated;
        });
    },

    async transferCarton(cartonId, targetBranchId, user, notes) {
        const fromBranchId = user.branchId || await this._getAdminBranchId();
        if (!fromBranchId) throw new BadRequestError('Source branch not found');

        const creator = user.displayName || user.email || 'System';

        return await prisma.$transaction(async (tx) => {
            const carton = await tx.adminStoreCarton.findUnique({
                where: { cartonCode: cartonId },
                include: {
                    assets: { include: { itemType: true } },
                    itemType: true
                }
            });
            if (!carton) throw new NotFoundError('Carton not found');

            // Check if all assets in the carton are still in admin store
            const unavailableAssets = carton.assets.filter(a => a.status !== 'IN_ADMIN_STORE');
            if (unavailableAssets.length > 0) {
                throw new BadRequestError(`لا يمكن تحويل الكرتونة لأنها تحتوي على ${unavailableAssets.length} أصناف تم تحويلها بالفعل أو حالتها غير صالحة`);
            }

            const validation = await validateBranches(fromBranchId, targetBranchId, 'ASSET');
            if (!validation.valid) {
                throw new BadRequestError(validation.errors.join(' | '));
            }

            const itemType = carton.itemType;
            const isSim = itemType.code === 'SIM' || itemType.name.includes('شريحة');
            const type = isSim ? 'SIM' : 'MACHINE';

            const machineParams = !isSim ? await tx.machineParameter.findMany() : [];

            // 1. Create single Transfer Order
            const orderNumber = generateOrderNumber();
            const order = await tx.transferOrder.create({
                data: {
                    orderNumber,
                    fromBranchId,
                    toBranchId: targetBranchId,
                    branchId: targetBranchId,
                    status: 'PENDING',
                    type,
                    notes: `نقل كرتونة: ${carton.cartonCode}. ${notes || ''}`,
                    createdByUserId: user.id || null,
                    createdByName: creator,
                    items: {
                        create: carton.assets.map(asset => {
                            const detected = !isSim ? detectMachineParams(asset.serialNumber, machineParams) : { model: null, manufacturer: null };
                            return {
                                serialNumber: asset.serialNumber,
                                type,
                                model: isSim ? (asset.simNetworkType || '4G') : (detected.model || carton.itemType.name),
                                manufacturer: isSim ? (asset.simProvider || 'Vodafone') : (detected.manufacturer || 'الشئون الإدارية'),
                                notes: `الصنف في كرتونة: ${carton.itemType.name}`
                            };
                        })
                    }
                }
            });

            // 2. Update all assets in carton
            await tx.adminStoreAsset.updateMany({
                where: { cartonCode: carton.cartonCode },
                data: {
                    status: 'TRANSFERRED',
                    updatedAt: new Date(),
                    branchId: targetBranchId
                }
            });

            // 3. Create/Update Warehouse entries
            for (const asset of carton.assets) {
                if (isSim) {
                    await tx.warehouseSim.upsert({
                        where: { serialNumber: asset.serialNumber },
                        update: {
                            status: 'IN_TRANSIT',
                            branchId: targetBranchId,
                            type: asset.simProvider || 'SIM',
                            networkType: asset.simNetworkType,
                            updatedAt: new Date()
                        },
                        create: {
                            id: `sim_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                            serialNumber: asset.serialNumber,
                            type: asset.simProvider || 'SIM',
                            networkType: asset.simNetworkType,
                            status: 'IN_TRANSIT',
                            branchId: targetBranchId,
                            updatedAt: new Date()
                        }
                    });
                } else {
                    const detected = detectMachineParams(asset.serialNumber, machineParams);
                    await tx.warehouseMachine.upsert({
                        where: { serialNumber: asset.serialNumber },
                        update: {
                            status: 'IN_TRANSIT',
                            branchId: targetBranchId,
                            model: detected.model || itemType.name,
                            manufacturer: detected.manufacturer || 'الشئون الإدارية',
                            notes: (asset.notes || '') + ` | من كرتونة: ${itemType.name}`,
                            updatedAt: new Date()
                        },
                        create: {
                            id: `mach_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                            serialNumber: asset.serialNumber,
                            model: detected.model || itemType.name,
                            manufacturer: detected.manufacturer || 'الشئون الإدارية',
                            notes: `كرتونة: ${itemType.name} (وارد الشئون الإدارية)`,
                            status: 'IN_TRANSIT',
                            branchId: targetBranchId,
                            updatedAt: new Date()
                        }
                    });
                }

                // Log movement for each asset
                await tx.adminStoreMovement.create({
                    data: {
                        assetId: asset.id,
                        type: 'TRANSFER',
                        fromBranchId,
                        toBranchId: targetBranchId,
                        fromStatus: asset.status,
                        toStatus: 'TRANSFERRED',
                        notes: `نقل كرتونة: ${carton.cartonCode} - TO: ${orderNumber}`,
                        performedBy: creator
                    }
                });
            }

            // Notification
            await createNotification({
                branchId: targetBranchId,
                type: 'TRANSFER_ORDER',
                title: 'إذن صرف بكرتونة إدارية',
                message: `وصلك إذن صرف كرتونة رقم ${carton.cartonCode} بواقع ${carton.assets.length} صنف`,
                data: { orderId: order.id, orderNumber }
            });

            return { orderNumber, count: carton.assets.length };
        });
    },

    async bulkTransferAssetsAndCartons(data, user) {
        const { assetIds, cartonCodes, targetBranchId, notes } = data;
        const fromBranchId = user.branchId || await this._getAdminBranchId();
        const performer = user.displayName || user.email || 'System';

        return await prisma.$transaction(async (tx) => {
            // 1. Resolve all assets inside transaction for high integrity
            const assets = await tx.adminStoreAsset.findMany({
                where: {
                    OR: [
                        { id: { in: assetIds || [] } },
                        { cartonCode: { in: cartonCodes || [] } }
                    ],
                    branchId: null, // Only from admin store
                    status: 'IN_ADMIN_STORE'
                },
                include: { itemType: true }
            });

            if (assets.length === 0) throw new BadRequestError('لم يتم العثور على أي أصناف صالحة للتحويل (ربما تم تحويلها بالفعل)');

            // Apply "The Binding Law" (القانون الملزم)
            const validation = await validateBranches(fromBranchId, targetBranchId, 'ASSET');
            if (!validation.valid) {
                throw new BadRequestError(validation.errors.join(' | '));
            }

            const orderNumber = generateOrderNumber();
            const machineParams = await tx.machineParameter.findMany();

            // Create Transfer Order items
            const orderItems = assets.map(asset => {
                const isSim = asset.itemType.code === 'SIM' || asset.itemType.name.includes('شريحة');
                const type = isSim ? 'SIM' : 'MACHINE';
                const detected = !isSim ? detectMachineParams(asset.serialNumber, machineParams) : { model: null, manufacturer: null };

                return {
                    serialNumber: asset.serialNumber,
                    type,
                    model: isSim ? (asset.simNetworkType || '4G') : (detected.model || asset.itemType.name),
                    manufacturer: isSim ? (asset.simProvider || 'Vodafone') : (detected.manufacturer || 'الشئون الإدارية'),
                    notes: `صنف إداري: ${asset.itemType.name}`
                };
            });

            // Create single Transfer Order
            const order = await tx.transferOrder.create({
                data: {
                    orderNumber, fromBranchId, toBranchId: targetBranchId, branchId: targetBranchId, status: 'PENDING',
                    type: assets.some(a => a.itemType.code === 'SIM' || a.itemType.name.includes('شريحة')) ? 'SIM' : 'MACHINE',
                    notes: `نقل جماعي - إداري (${assets.length} صنف). ${notes || ''}`,
                    createdByUserId: user.id || null,
                    createdByName: performer,
                    items: { create: orderItems }
                }
            });

            // Update all AdminStoreAssets
            await tx.adminStoreAsset.updateMany({
                where: { id: { in: assets.map(a => a.id) } },
                data: {
                    status: 'TRANSFERRED',
                    updatedAt: new Date(),
                    branchId: targetBranchId
                }
            });

            // Iterate for Warehouse upsert and Movement logging
            for (const asset of assets) {
                const isSim = asset.itemType.code === 'SIM' || asset.itemType.name.includes('شريحة');
                const detected = !isSim ? detectMachineParams(asset.serialNumber, machineParams) : { model: null, manufacturer: null };

                if (isSim) {
                    await tx.warehouseSim.upsert({
                        where: { serialNumber: asset.serialNumber },
                        update: {
                            status: 'IN_TRANSIT',
                            branchId: targetBranchId,
                            type: asset.simProvider || 'SIM',
                            networkType: asset.simNetworkType,
                            updatedAt: new Date()
                        },
                        create: {
                            id: `sim_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                            serialNumber: asset.serialNumber,
                            type: asset.simProvider || 'SIM',
                            networkType: asset.simNetworkType,
                            status: 'IN_TRANSIT',
                            branchId: targetBranchId,
                            updatedAt: new Date()
                        }
                    });
                } else {
                    await tx.warehouseMachine.upsert({
                        where: { serialNumber: asset.serialNumber },
                        update: {
                            status: 'IN_TRANSIT',
                            branchId: targetBranchId,
                            model: detected.model || asset.itemType.name,
                            manufacturer: detected.manufacturer || 'الشئون الإدارية',
                            updatedAt: new Date()
                        },
                        create: {
                            id: `mach_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                            serialNumber: asset.serialNumber,
                            model: detected.model || asset.itemType.name,
                            manufacturer: detected.manufacturer || 'الشئون الإدارية',
                            status: 'IN_TRANSIT',
                            branchId: targetBranchId,
                            updatedAt: new Date()
                        }
                    });
                }

                await tx.adminStoreMovement.create({
                    data: {
                        assetId: asset.id,
                        type: 'TRANSFER',
                        fromBranchId,
                        toBranchId: targetBranchId,
                        fromStatus: 'IN_ADMIN_STORE',
                        toStatus: 'TRANSFERRED',
                        notes: `Bulk Transfer Order: ${orderNumber}`,
                        performedBy: performer
                    }
                });
            }

            await createNotification({
                branchId: targetBranchId,
                type: 'TRANSFER_ORDER',
                title: 'إذن صرف إداري جديد (جماعي)',
                message: `وصلك إذن صرف جماعي رقم ${orderNumber} من الشئون الإدارية`,
                data: { orderId: order.id, orderNumber }
            });

            return { orderNumber, count: assets.length };
        });
    },

    // --- Stock Management ---

    async listStocks(branchId) {
        // If branchId is provided, filter by it. If explicit null, filter by Admin Store (null).
        // If undefined, return all? Usually we want Admin Store by default or everything.
        // Let's support explicit null for Admin Store.
        // If query param is missing, it is undefined.
        // If query param is 'null', it is string 'null'.

        const where = {};
        if (branchId !== undefined) {
            if (branchId === 'null' || branchId === null || branchId === '') {
                where.branchId = null; // Admin Store
            } else {
                where.branchId = branchId;
            }
        }

        return await prisma.adminStoreStock.findMany({
            where,
            include: {
                itemType: true,
                branch: true
            },
            orderBy: { updatedAt: 'desc' }
        });
    },

    async transferStock(data, user) {
        const { itemTypeCode, quantity, toBranchId, notes } = data;
        if (!itemTypeCode || !quantity || !toBranchId) throw new BadRequestError('Missing required fields');

        const qty = parseInt(quantity);
        if (isNaN(qty) || qty <= 0) throw new BadRequestError('Invalid Quantity');

        const creator = user.displayName || user.email;

        return await prisma.$transaction(async (tx) => {
            // 1. Check Source (Assumed Admin Store for now, or from User Branch if we expand logic)
            // Implementation: Current helper supports Admin Store -> Branch.
            // If we want Branch -> Branch, we need to know source.
            // For now, assume Admin Store (branchId: null) as Source.

            const sourceStock = await tx.adminStoreStock.findUnique({
                where: { itemTypeCode_branchId: { itemTypeCode, branchId: null } }
            });

            if (!sourceStock || sourceStock.quantity < qty) {
                throw new BadRequestError(`Insufficient stock in Admin Store. Available: ${sourceStock?.quantity || 0}`);
            }

            // 2. Decrement Source
            await tx.adminStoreStock.update({
                where: { id: sourceStock.id },
                data: { quantity: { decrement: qty } }
            });

            // 3. Log OUT Movement
            await tx.adminStoreStockMovement.create({
                data: {
                    itemTypeCode,
                    type: 'TRANSFER_OUT',
                    quantity: qty,
                    fromBranchId: null,
                    toBranchId,
                    notes: `To Branch: ${toBranchId}`,
                    performedBy: creator
                }
            });

            // 4. Increment Target
            await tx.adminStoreStock.upsert({
                where: { itemTypeCode_branchId: { itemTypeCode, branchId: toBranchId } },
                update: { quantity: { increment: qty } },
                create: {
                    itemTypeCode,
                    branchId: toBranchId,
                    quantity: qty
                }
            });

            // 5. Log IN Movement
            await tx.adminStoreStockMovement.create({
                data: {
                    itemTypeCode,
                    type: 'TRANSFER_IN',
                    quantity: qty,
                    fromBranchId: null, // Admin Store
                    toBranchId,
                    notes: `From Admin Store. ${notes || ''}`,
                    performedBy: creator
                }
            });

            return { success: true };
        });
    }
};

module.exports = adminStoreService;
