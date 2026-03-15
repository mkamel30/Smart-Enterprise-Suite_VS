const db = require('../../../db');
const { parseExcelFile, transformCustomersForExport, transformPaymentsForExport, transformTransfersForExport } = require('../../../utils/excel');
const { logAction } = require('../../../utils/logger');

/**
 * Shared Import/Export Service
 * Standardizes bulk operations for Customers, Machines, SIMs, and Inventory.
 */

/**
 * Customers Import/Export
 */
async function importCustomers(buffer, branchId, user) {
    const rows = await parseExcelFile(buffer);
    if (!rows.length) throw new Error('الملف فارغ');

    const results = { imported: 0, skipped: 0, errors: [] };
    let created = 0, updated = 0;

    for (const row of rows) {
        try {
            const bkcode = String(row['رقم العميل'] || row['كود العميل'] || row['bkcode'] || row['code'] || '').trim();
            const client_name = String(row['اسم العميل'] || row['client_name'] || row['name'] || '').trim();

            if (!bkcode || !client_name) {
                results.skipped++;
                results.errors.push({ row: bkcode || 'Unknown', error: 'بيانات ناقصة (الكود أو الاسم مطلوب)' });
                continue;
            }

            const customerData = {
                client_name,
                address: row['العنوان'] || row['address'] || null,
                national_id: row['الرقم القومي'] || row['national_id'] || null,
                supply_office: row['مكتب التموين'] || row['supply_office'] || null,
                dept: row['إدارة التموين'] || row['dept'] || null,
                contact_person: row['الشخص المسؤول'] || row['contact_person'] || null,
                telephone_1: row['رقم الهاتف 1'] || row['telephone_1'] || row['phone'] || null,
                telephone_2: row['رقم الهاتف 2'] || row['telephone_2'] || row['mobile'] || null,
                clienttype: row['نوع العميل'] || row['clienttype'] || null
            };

            const existing = await db.customer.findFirst({ where: { bkcode } });

            if (existing) {
                if (existing.branchId && existing.branchId !== branchId) {
                    results.skipped++;
                    results.errors.push({ row: bkcode, error: 'كود العميل مستخدم بالفعل في فرع آخر' });
                    continue;
                }
                await db.customer.updateMany({ where: { id: existing.id }, data: customerData });
                updated++;
                results.imported++;
            } else {
                await db.customer.create({ data: { bkcode, ...customerData, branchId } });
                created++;
                results.imported++;
            }
        } catch (err) {
            results.skipped++;
            results.errors.push({ row: row['bkcode'] || 'Row', error: err.message });
        }
    }

    await logAction({
        entityType: 'CUSTOMER', entityId: 'bulk-import', action: 'IMPORT',
        details: { imported: results.imported, skipped: results.skipped },
        userId: user.id, performedBy: user.displayName, branchId
    });

    return { created, updated, ...results };
}

/**
 * Machines Import/Export
 */
async function importMachines(buffer, branchId, user) {
    const rows = await parseExcelFile(buffer);
    const machineParams = await db.machineParameter.findMany();

    const results = { imported: 0, updated: 0, skipped: 0, errors: [] };

    const detectMachineInfo = (serialNumber) => {
        const sn = String(serialNumber);
        const param = machineParams.find(p => sn.startsWith(p.prefix));
        return param ? { model: param.model, manufacturer: param.manufacturer } : { model: null, manufacturer: null };
    };

    for (const row of rows) {
        try {
            const serialNumber = String(row.serialNumber || row['S/N'] || row['Serial'] || '').trim();
            const customerCode = String(row.customerId || row['Customer Code'] || '').trim();
            const posId = String(row.posId || row['POS ID'] || '').trim();

            if (!serialNumber) {
                results.skipped++;
                results.errors.push({ row, error: 'السيريال مطلوب' });
                continue;
            }

            let actualCustomerId = null;
            if (customerCode) {
                const customer = await db.customer.findFirst({ where: { bkcode: customerCode, branchId } });
                if (!customer) {
                    results.errors.push({ row: serialNumber, error: `العميل ${customerCode} غير موجود بالفرع` });
                    continue;
                }
                actualCustomerId = customer.id;
            }

            const { model, manufacturer } = detectMachineInfo(serialNumber);
            const existing = await db.posMachine.findFirst({
                where: { serialNumber, OR: [{ branchId: branchId }, { branchId: null }] }
            });

            if (existing) {
                await db.posMachine.update({
                    where: { id: existing.id },
                    data: {
                        customerId: actualCustomerId || existing.customerId,
                        branchId,
                        model: model || existing.model,
                        manufacturer: manufacturer || existing.manufacturer,
                        posId: posId || existing.posId
                    }
                });
                results.updated++;
            } else {
                await db.posMachine.create({
                    data: {
                        serialNumber, branchId, customerId: actualCustomerId,
                        model, manufacturer, posId
                    }
                });
                results.imported++;
            }
        } catch (err) {
            results.errors.push({ row: row.serialNumber || 'Raw', error: err.message });
        }
    }

    await logAction({
        entityType: 'POS_MACHINE', entityId: 'bulk-import', action: 'IMPORT',
        details: results, userId: user.id, performedBy: user.displayName, branchId
    });

    return results;
}

/**
 * Spare Parts Import
 */
async function importSpareParts(buffer, user) {
    const rows = await parseExcelFile(buffer);
    const results = { created: 0, skipped: 0, errors: [] };

    for (const row of rows) {
        try {
            const name = String(row['الاسم'] || row['name'] || '').trim();
            if (!name) continue;

            const existing = await db.sparePart.findFirst({ 
                where: { name: { equals: name } }
            });

            if (existing) {
                results.skipped++;
                continue;
            }

            const count = await db.sparePart.count();
            const partNumber = `SP${String(count + 1 + results.created).padStart(4, '0')}`;

            await db.sparePart.create({
                data: {
                    partNumber,
                    name,
                    description: row['الوصف'] || row['description'] || '',
                    compatibleModels: row['الموديلات المتوافقة'] || row['compatibleModels'] || '',
                    defaultCost: parseFloat(row['التكلفة الافتراضية'] || row['cost']) || 0,
                    isConsumable: row['قابلة للاستهلاك'] === 'نعم' || row['isConsumable'] === true,
                    allowsMultiple: row['متعددة'] === 'نعم' || row['allowsMultiple'] === true
                }
            });
            results.created++;
        } catch (err) {
            results.errors.push({ name: row.name, error: err.message });
        }
    }

    return results;
}

/**
 * SIM Cards Import
 */
async function importSims(buffer, branchId, user) {
    const rows = await parseExcelFile(buffer);
    const results = { imported: 0, skipped: 0, errors: [] };

    for (const row of rows) {
        try {
            const serialNumber = String(row.serialNumber || row['serialNumber'] || '').trim();
            const customerCode = String(row.customerId || row['customerId'] || '').trim();

            if (!serialNumber) {
                results.skipped++;
                continue;
            }

            // Check if exists globally (SimCard or WarehouseSim)
            const [existsC, existsW] = await Promise.all([
                db.simCard.findFirst({ where: { serialNumber, _skipBranchEnforcer: true } }),
                db.warehouseSim.findFirst({ where: { serialNumber, _skipBranchEnforcer: true } })
            ]);

            if (existsC || existsW) {
                results.skipped++;
                continue;
            }

            let actualCustomerId = null;
            if (customerCode) {
                const customer = await db.customer.findFirst({ where: { bkcode: customerCode, branchId } });
                if (customer) actualCustomerId = customer.id;
            }

            await db.simCard.create({
                data: {
                    serialNumber,
                    type: String(row.type || '').trim(),
                    networkType: String(row.networkType || '').trim(),
                    customerId: actualCustomerId,
                    branchId
                }
            });
            results.imported++;
        } catch (err) {
            results.errors.push({ row: row.serialNumber || 'Raw', error: err.message });
        }
    }

    return results;
}

/**
 * Warehouse SIM Cards Import
 */
async function importWarehouseSims(buffer, branchId, user) {
    const rows = await parseExcelFile(buffer);
    const results = { imported: 0, skipped: 0, errors: [] };

    for (const row of rows) {
        try {
            const serialNumber = String(row.serialNumber || row['مسلسل الشريحة'] || row['السيريال'] || '').trim();
            if (!serialNumber) {
                results.skipped++;
                continue;
            }

            // Check if exists globally (SimCard or WarehouseSim)
            const [existsC, existsW] = await Promise.all([
                db.simCard.findFirst({ where: { serialNumber, _skipBranchEnforcer: true } }),
                db.warehouseSim.findFirst({ where: { serialNumber, _skipBranchEnforcer: true } })
            ]);

            if (existsC || existsW) {
                results.skipped++;
                results.errors.push({ row: serialNumber, error: 'الشريحة موجودة بالفعل' });
                continue;
            }

            await db.warehouseSim.create({
                data: {
                    serialNumber,
                    type: String(row.type || row['الشركة (Type)'] || row['النوع'] || '').trim(),
                    networkType: String(row.networkType || row['الشبكة (Network)'] || row['الشبكة'] || '').trim(),
                    status: String(row.status || row['الحالة'] || 'ACTIVE').trim(),
                    notes: String(row.notes || row['ملاحظات'] || '').trim(),
                    branchId
                }
            });
            results.imported++;
        } catch (err) {
            results.errors.push({ row: row.serialNumber || 'Raw', error: err.message });
        }
    }

    return results;
}

/**
 * Users Import
 */
async function importUsers(buffer, user) {
    const rows = await parseExcelFile(buffer);
    const results = { created: 0, skipped: 0, errors: [] };
    const bcrypt = require('bcryptjs');

    for (const row of rows) {
        try {
            const email = String(row['البريد'] || row['email'] || '').trim();
            const displayName = String(row['الاسم'] || row['اسم المستخدم'] || row['displayName'] || row['name'] || '').trim();
            const role = String(row['الدور'] || row['role'] || 'CS_AGENT').toUpperCase().trim();
            const branchCode = String(row['كود الفرع'] || row['branchCode'] || '').trim();

            if (!displayName) {
                results.skipped++;
                results.errors.push({ row: displayName || 'Unknown', error: 'الاسم مطلوب' });
                continue;
            }

            // Check if email exists if provided
            if (email) {
                const existing = await db.user.findFirst({ where: { email } });
                if (existing) {
                    results.skipped++;
                    results.errors.push({ row: email, error: 'البريد الإلكتروني موجود بالفعل' });
                    continue;
                }
            }

            let branchId = null;
            if (branchCode) {
                const branch = await db.branch.findFirst({ where: { code: branchCode } });
                if (branch) branchId = branch.id;
            }

            const defaultPassword = await bcrypt.hash('1234567890Aa!', 10);

            await db.user.create({
                data: {
                    displayName,
                    email: email || null,
                    role,
                    branchId,
                    password: defaultPassword,
                    isActive: true,
                    canDoMaintenance: row['فني'] === 'نعم' || row['canDoMaintenance'] === true || row['صيانة'] === 'نعم'
                }
            });
            results.created++;
        } catch (err) {
            results.errors.push({ row: row['email'] || 'Raw', error: err.message });
        }
    }

    return results;
}

module.exports = {
    importCustomers,
    importMachines,
    importSpareParts,
    importSims,
    importWarehouseSims,
    importUsers
};
