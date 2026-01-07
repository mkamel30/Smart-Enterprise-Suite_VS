import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useState, useRef } from 'react';
import toast from 'react-hot-toast';
import { Package, Download, Upload, ArrowDownCircle, ArrowUpCircle, History } from 'lucide-react';
import * as XLSX from 'xlsx';

import { useAuth } from '../context/AuthContext';
import { Filter } from 'lucide-react';

export default function Warehouse() {
    const { user } = useAuth();
    const isAdmin = !user?.branchId;
    const [filterBranchId, setFilterBranchId] = useState('');
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<'inventory' | 'movements'>('inventory');
    const [showImportDialog, setShowImportDialog] = useState(false);
    const [importData, setImportData] = useState<any[]>([]);
    const [selectedModel, setSelectedModel] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Fetch branches for filter if admin
    const { data: branches } = useQuery({
        queryKey: ['branches'],
        queryFn: () => api.getActiveBranches(),
        enabled: !!user && isAdmin,
        staleTime: 1000 * 60 * 60
    });

    const { data: inventory, isLoading } = useQuery({
        queryKey: ['inventory', filterBranchId],
        queryFn: () => api.getInventory({ branchId: filterBranchId }),
        enabled: !!user
    });

    const { data: movements } = useQuery({
        queryKey: ['stock-movements', filterBranchId],
        queryFn: () => api.getStockMovements({ branchId: filterBranchId }),
        enabled: !!user
    });

    const { data: spareParts } = useQuery({
        queryKey: ['spare-parts'],
        queryFn: () => api.getSpareParts(),
        enabled: !!user
    });

    // Extract unique models from inventory
    const availableModels = Array.from(new Set(
        inventory?.flatMap((item: any) =>
            item.compatibleModels ? item.compatibleModels.split(/[;,]/).map((m: string) => m.trim()) : []
        ) || []
    )).filter(Boolean).sort();

    // Filtered inventory
    const filteredInventory = inventory?.filter((item: any) => {
        if (!selectedModel) return true;
        if (!item.compatibleModels) return false;
        const models = item.compatibleModels.split(/[;,]/).map((m: string) => m.trim());
        return models.includes(selectedModel);
    }) || [];

    // Download template with all parts from catalog (no code - auto generated)
    const handleDownloadTemplate = () => {
        if (!spareParts?.length) {
            toast.error('لا توجد قطع في القانون. أضف قطع في الإعدادات أولاً.');
            return;
        }

        const templateData = spareParts.map((p: any) => ({
            'اسم القطعة': p.name,
            'الكمية المضافة': 0
        }));

        const ws = XLSX.utils.json_to_sheet(templateData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'المخزون');
        XLSX.writeFile(wb, 'spare_parts_stock_import.xlsx');
    };

    // Handle file upload
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const data = new Uint8Array(event.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);

            // Match with spare parts by name
            const parsed = jsonData.map((row: any) => {
                const partName = row['اسم القطعة'] || '';
                const quantity = parseInt(row['الكمية المضافة']) || 0;

                const part = spareParts?.find((p: any) => p.name === partName);

                return {
                    partId: part?.id,
                    partNumber: part?.partNumber,
                    name: partName,
                    quantity
                };
            }).filter((item: any) => item.partId && item.quantity > 0);

            setImportData(parsed);
            setShowImportDialog(true);
        };
        reader.readAsArrayBuffer(file);
    };

    const handleConfirmImport = async () => {
        try {
            const items = importData.map(item => ({
                partId: item.partId,
                quantity: item.quantity
            }));

            await api.importInventory(items, filterBranchId || undefined);

            if (true) {
                queryClient.invalidateQueries({ queryKey: ['inventory'] });
                queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
                setShowImportDialog(false);
                setImportData([]);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        } catch (error) {
            console.error('Import failed:', error);
        }
    };

    // Export current inventory
    const handleExport = () => {
        if (!inventory?.length) return;

        const exportData = inventory.map((item: any) => ({
            'الكود': item.partNumber,
            'اسم القطعة': item.name,
            'الكمية الحالية': item.quantity
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'المخزون');
        XLSX.writeFile(wb, 'current_inventory.xlsx');
    };

    if (isLoading) {
        return <div className="flex h-full items-center justify-center p-8">جاري التحميل...</div>;
    }

    return (
        <div className="px-8 pt-4 pb-8 bg-gradient-to-br from-slate-50 to-blue-50/30 min-h-screen" dir="rtl">
            <h1 className="text-3xl font-black text-[#0A2472] mb-6">مخزن قطع الغيار</h1>

            {/* Tabs */}
            <div className="flex gap-2 mb-6">
                <button
                    onClick={() => setActiveTab('inventory')}
                    className={`px-6 py-3 rounded-xl flex items-center gap-2 font-black transition-all ${activeTab === 'inventory' ? 'bg-gradient-to-r from-[#0A2472] to-[#0A2472]/90 text-white shadow-lg' : 'bg-white border-2 border-[#0A2472]/10 text-[#0A2472] hover:bg-[#0A2472]/5'}`}
                    title="عرض المخزون الحالي من قطع الغيار"
                >
                    <Package size={18} />
                    المخزون الحالي
                </button>
                <button
                    onClick={() => setActiveTab('movements')}
                    className={`px-6 py-3 rounded-xl flex items-center gap-2 font-black transition-all ${activeTab === 'movements' ? 'bg-gradient-to-r from-[#0A2472] to-[#0A2472]/90 text-white shadow-lg' : 'bg-white border-2 border-[#0A2472]/10 text-[#0A2472] hover:bg-[#0A2472]/5'}`}
                    title="عرض سجل حركة الدخول والخروج"
                >
                    <History size={18} />
                    سجل الحركة
                </button>
            </div>

            {activeTab === 'inventory' && (
                <div className="bg-white rounded-2xl border-2 border-[#0A2472]/10 shadow-xl">
                    <div className="p-4 border-b flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <div>
                                <p className="font-medium">إجمالي الأصناف: {filteredInventory?.length || 0}</p>
                                <p className="text-xs text-slate-500">تمبليت يحتوي على كل القطع من القانون مع عمود الكمية</p>
                            </div>

                            {/* Branch Filter */}
                            {isAdmin && (
                                <div className="mr-8 flex items-center gap-2">
                                    <Filter size={18} className="text-slate-400" />
                                    <select
                                        value={filterBranchId}
                                        onChange={(e) => setFilterBranchId(e.target.value)}
                                        className="border rounded-lg px-2 py-1 text-sm min-w-30"
                                    >
                                        <option value="">كل الفروع</option>
                                        {(branches as any[])?.map((branch: any) => (
                                            <option key={branch.id} value={branch.id}>{branch.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Model Filter */}
                            <div className="mr-8 flex items-center gap-2">
                                <label className="text-sm font-medium">تصفية بالموديل:</label>
                                <select
                                    value={selectedModel}
                                    onChange={(e) => setSelectedModel(e.target.value)}
                                    className="border rounded-lg px-2 py-1 text-sm min-w-37.5"
                                >
                                    <option value="">(الكل)</option>
                                    {availableModels.map((model: any) => (
                                        <option key={model} value={model}>{model}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <button onClick={handleDownloadTemplate} className="flex items-center gap-2 border px-3 py-2 rounded-lg hover:bg-slate-50 text-sm" title="تحميل قالب Excel لإضافة كميات جديدة">
                                <Download size={16} />تمبليت Excel
                            </button>
                            <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 border px-3 py-2 rounded-lg hover:bg-slate-50 text-sm" title="استيراد كميات من ملف Excel">
                                <Upload size={16} />استيراد Excel
                            </button>
                            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="hidden" />
                            <button onClick={handleExport} className="flex items-center gap-2 border px-3 py-2 rounded-lg hover:bg-slate-50 text-sm" title="تصدير المخزون الحالي إلى ملف Excel">
                                <Download size={16} />تصدير المخزون
                            </button>
                        </div>
                    </div>

                    <table className="w-full">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="text-center p-4">الكود</th>
                                <th className="text-center p-4">اسم القطعة</th>
                                <th className="text-center p-4">الموديلات</th>
                                <th className="text-right p-4">السعر</th>
                                <th className="text-right p-4">الكمية</th>
                                <th className="text-right p-4">تعديل</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredInventory?.map((item: any) => (
                                <InventoryRow key={item.id} item={item} onUpdate={() => queryClient.invalidateQueries({ queryKey: ['inventory'] })} />
                            ))}
                            {(!filteredInventory?.length) && (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-slate-500">
                                        <Package size={48} className="mx-auto mb-2 opacity-50" />
                                        لا توجد قطع مطابقة للبحث
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {activeTab === 'movements' && (
                <div className="bg-white rounded-lg border shadow-sm">
                    <div className="p-4 border-b">
                        <p className="font-medium">سجل حركة المخزون</p>
                        <p className="text-xs text-slate-500">آخر 100 حركة</p>
                    </div>

                    <table className="w-full">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="text-right p-4">النوع</th>
                                <th className="text-right p-4">القطعة</th>
                                <th className="text-right p-4">الكمية</th>
                                <th className="text-right p-4">السبب</th>
                                <th className="text-right p-4">التاريخ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {movements?.map((mov: any) => (
                                <tr key={mov.id} className="border-t hover:bg-slate-50">
                                    <td className="p-4">
                                        {mov.type === 'IN' ? (
                                            <span className="flex items-center gap-1 text-green-600">
                                                <ArrowDownCircle size={18} />
                                                دخول
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-red-600">
                                                <ArrowUpCircle size={18} />
                                                خروج
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-4">
                                        <div className="font-medium">{mov.partName}</div>
                                        <div className="text-xs text-slate-500">{mov.partNumber}</div>
                                    </td>
                                    <td className="p-4 font-bold">{mov.quantity}</td>
                                    <td className="p-4 text-sm">{mov.reason || '-'}</td>
                                    <td className="p-4 text-sm">{new Date(mov.createdAt).toLocaleString('ar-EG')}</td>
                                </tr>
                            ))}
                            {(!movements?.length) && (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-slate-500">
                                        لا توجد حركات
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Import Dialog */}
            {showImportDialog && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-100">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md">
                        <h2 className="text-xl font-bold mb-4">تأكيد إضافة الكميات</h2>

                        {isAdmin && (
                            <div className="mb-4">
                                <label className="block text-sm font-medium mb-1">إضافة إلى فرع:</label>
                                <select
                                    className="w-full border rounded p-2"
                                    value={filterBranchId || ''}
                                    onChange={(e) => setFilterBranchId(e.target.value)}
                                >
                                    <option value="">-- اختر الفرع --</option>
                                    {(branches as any[])?.map((branch: any) => (
                                        <option key={branch.id} value={branch.id}>{branch.name}</option>
                                    ))}
                                </select>
                                {!filterBranchId && <p className="text-xs text-red-500 mt-1">يجب اختيار الفرع لإتمام العملية</p>}
                            </div>
                        )}

                        <p className="text-slate-600 mb-2">سيتم إضافة الكميات التالية للمخزون:</p>
                        <div className="max-h-48 overflow-y-auto border rounded p-2 mb-4">
                            {importData.map((item, i) => (
                                <div key={i} className="py-2 border-b last:border-0 flex justify-between">
                                    <span>{item.name}</span>
                                    <span className="text-green-600 font-bold">+{item.quantity}</span>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <button onClick={handleConfirmImport} className="flex-1 bg-green-600 text-white py-2 rounded-lg">
                                تأكيد الإضافة
                            </button>
                            <button onClick={() => { setShowImportDialog(false); setImportData([]); }} className="flex-1 border py-2 rounded-lg">
                                إلغاء
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Inventory Row with inline editing
function InventoryRow({ item, onUpdate }: { item: any; onUpdate: () => void }) {
    const [isEditing, setIsEditing] = useState(false);
    const [quantity, setQuantity] = useState(item.quantity);

    const handleSave = async () => {
        try {
            await api.updateInventory(item.id, quantity);
            if (true) {
                setIsEditing(false);
                onUpdate();
            }
        } catch (error) {
            console.error('Failed to update:', error);
        }
    };

    return (
        <tr className="border-t hover:bg-slate-50">
            <td className="p-4 font-mono text-sm">{item.partNumber}</td>
            <td className="p-4 font-medium">{item.name}</td>
            <td className="p-4 text-sm">{item.compatibleModels?.split(';').join(' • ') || '-'}</td>
            <td className="p-4">{item.defaultCost} ج.م</td>
            <td className="p-4">
                {isEditing ? (
                    <input
                        type="number"
                        value={quantity}
                        onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                        className="w-20 border rounded px-2 py-1 text-center"
                        autoFocus
                    />
                ) : (
                    <span className={`px-3 py-1 rounded-full font-bold ${item.quantity > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {item.quantity}
                    </span>
                )}
            </td>
            <td className="p-4">
                {isEditing ? (
                    <div className="flex gap-1">
                        <button onClick={handleSave} className="px-2 py-1 bg-green-600 text-white rounded text-sm">حفظ</button>
                        <button onClick={() => { setIsEditing(false); setQuantity(item.quantity); }} className="px-2 py-1 border rounded text-sm">إلغاء</button>
                    </div>
                ) : (
                    <button onClick={() => setIsEditing(true)} className="px-3 py-1 border rounded hover:bg-slate-100 text-sm">
                        تعديل
                    </button>
                )}
            </td>
        </tr>
    );
}
