import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useState, useRef, useMemo } from 'react';
import toast from 'react-hot-toast';
import { Package, Download, Upload, ArrowDownCircle, ArrowUpCircle, History, Search, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';

import { useAuth } from '../context/AuthContext';
import { Filter } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import PageHeader from '../components/PageHeader';

export default function Warehouse() {
    const { user } = useAuth();
    const isAdmin = !user?.branchId;
    const [filterBranchId, setFilterBranchId] = useState('');
    const [activeTab, setActiveTab] = useState<'inventory' | 'movements'>('inventory');
    const queryClient = useQueryClient();
    const [movementFilters, setMovementFilters] = useState({
        startDate: '',
        endDate: '',
        search: ''
    });

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [showImportDialog, setShowImportDialog] = useState(false);
    const [importData, setImportData] = useState<any[]>([]);

    const handleConfirmImport = async () => {
        // TODO: Implement import logic
        setShowImportDialog(false);
        setImportData([]);
        toast.success('تمت الإضافة بنجاح (محاكاة)');
    };

    const handleDownloadTemplate = () => {
        const ws = XLSX.utils.json_to_sheet([
            {
                'رقم القطعة': 'PART-001',
                'اسم القطعة': 'مثال - شاشة',
                'الموديلات المتوافقة': 'VX520, VX675',
                'السعر': 150,
                'الكمية': 10
            }
        ]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Template');
        XLSX.writeFile(wb, 'inventory_import_template.xlsx');
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);

                toast.success('تم قراءة الملف بنجاح. وظيفة الاستيراد قيد التطوير.');
                // TODO: Implement actual import API call here using api.importInventory(data)
            } catch (error) {
                console.error('Error reading file:', error);
                toast.error('حدث خطأ أثناء قراءة الملف');
            }
        };
        reader.readAsBinaryString(file);
    };

    const { data: inventory, isLoading } = useQuery({
        queryKey: ['inventory', filterBranchId],
        queryFn: () => api.getInventory({ branchId: filterBranchId }),
        enabled: !!user
    });

    const { data: branches } = useQuery({
        queryKey: ['branches'],
        queryFn: api.getBranches,
        enabled: isAdmin
    });

    const { data: movements, isLoading: isMovementsLoading } = useQuery({
        queryKey: ['stock-movements', filterBranchId, movementFilters],
        queryFn: () => api.getStockMovements({
            branchId: filterBranchId,
            ...movementFilters
        }),
        enabled: !!user
    });

    const { data: machineParams } = useQuery({
        queryKey: ['machine-parameters'],
        queryFn: api.getMachineParameters
    });

    // Model filter state
    const [selectedModel, setSelectedModel] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    // Filter inventory logic
    const filteredInventory = useMemo(() => {
        let result = inventory || [];

        // Filter by Model
        if (selectedModel) {
            result = result.filter((item: any) => {
                const models = item.part?.compatibleModels || '';
                return models.includes(selectedModel);
            });
        }

        // Filter by Search Query
        if (searchQuery) {
            const lowerQuery = searchQuery.toLowerCase();
            result = result.filter((item: any) =>
                item.name?.toLowerCase().includes(lowerQuery) ||
                item.partNumber?.toLowerCase().includes(lowerQuery) ||
                item.part?.compatibleModels?.toLowerCase().includes(lowerQuery)
            );
        }

        return result;
    }, [inventory, selectedModel, searchQuery]);

    // Get available models from parameters AND inventory
    const availableModels = useMemo(() => {
        const modelsSet = new Set<string>();

        // 1. From Machine Parameters (The Master List)
        if (machineParams) {
            machineParams.forEach(p => modelsSet.add(p.model));
        }

        // 2. From Inventory (Legacy/Existing usage)
        if (inventory) {
            inventory.forEach((item: any) => {
                const modelsStr = item.part?.compatibleModels;
                if (modelsStr && typeof modelsStr === 'string') {
                    modelsStr.split(',').forEach(m => modelsSet.add(m.trim()));
                }
            });
        }

        return Array.from(modelsSet).sort();
    }, [inventory, machineParams]);

    const handleExportMovements = () => {
        if (!movements?.length) return;

        const exportData = movements.map((mov: any) => ({
            'النوع': mov.type === 'IN' ? 'دخول' : 'خروج',
            'القطعة': mov.partName,
            'رقم القطعة': mov.partNumber,
            'الكمية': mov.quantity,
            'السبب': mov.reason,
            'كود العميل': mov.customerBkCode || '',
            'سيريال الماكينة': mov.machineSerial || '',
            'القائم بالحركة': mov.performedBy || '',
            'التاريخ': new Date(mov.createdAt).toLocaleString('ar-EG')
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        ws['!dir'] = { rtl: true };
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'سجل الحركة');
        XLSX.writeFile(wb, `movements_log_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    // Export current inventory
    const handleExport = () => {
        if (!inventory?.length) return;

        const exportData = inventory.map((item: any) => ({
            'الكود': item.partNumber,
            'اسم القطعة': item.name,
            'الموديلات المتوافقة': item.compatibleModels,
            'السعر': item.defaultCost,
            'الكمية الحالية': item.quantity
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        ws['!dir'] = { rtl: true };
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'المخزون');
        XLSX.writeFile(wb, `current_stock_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    if (isLoading) {
        return <div className="flex h-full items-center justify-center p-8">جاري التحميل...</div>;
    }

    const filterElement = (
        <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative group">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                <input
                    type="text"
                    placeholder="بحث (اسم، كود...)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pr-10 pl-4 py-2 border-2 border-primary/10 rounded-xl outline-none focus:border-primary/30 font-bold text-sm w-full md:w-48 transition-all focus:md:w-64 bg-white"
                />
            </div>

            {/* Branch Filter */}
            {isAdmin && (
                <div className="flex items-center gap-2 bg-white border-2 border-primary/10 px-3 py-2 rounded-xl shadow-sm">
                    <Filter size={18} className="text-slate-400" />
                    <select
                        value={filterBranchId}
                        onChange={(e) => setFilterBranchId(e.target.value)}
                        className="bg-transparent outline-none text-sm font-bold min-w-[120px]"
                    >
                        <option value="">كل الفروع</option>
                        {(branches as any[])?.map((branch: any) => (
                            <option key={branch.id} value={branch.id}>{branch.name}</option>
                        ))}
                    </select>
                </div>
            )}

            {/* Model Filter */}
            <div className="flex items-center gap-2 bg-white border-2 border-primary/10 px-3 py-2 rounded-xl shadow-sm">
                <label className="text-xs font-black text-primary/60">الموديل:</label>
                <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="bg-transparent outline-none text-sm font-bold min-w-[100px]"
                >
                    <option value="">(الكل)</option>
                    {availableModels.map((model: any) => (
                        <option key={model} value={model}>{model}</option>
                    ))}
                </select>
            </div>
        </div>
    );

    const actionElements = (
        <div className="flex items-center gap-3">
            <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-2 bg-white border-2 border-primary/10 px-4 py-2.5 rounded-xl hover:bg-slate-50 transition-all font-bold text-sm outline-none shadow-sm h-full">
                    <FileSpreadsheet size={18} className="text-emerald-600" />
                    عمليات Excel
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-white rounded-xl p-2 shadow-xl border-2 border-slate-100 min-w-[200px] z-[100]">
                    <DropdownMenuItem onClick={handleDownloadTemplate} className="rounded-lg gap-3 cursor-pointer py-2.5 font-medium hover:bg-slate-50 focus:bg-slate-50">
                        <Download size={16} className="text-slate-500" />
                        تحميل قالب الاستيراد
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => fileInputRef.current?.click()} className="rounded-lg gap-3 cursor-pointer py-2.5 font-medium hover:bg-slate-50 focus:bg-slate-50">
                        <Upload size={16} className="text-blue-500" />
                        استيراد من Excel
                    </DropdownMenuItem>
                    <div className="h-px bg-slate-100 my-1" />
                    <DropdownMenuItem onClick={handleExport} className="rounded-lg gap-3 cursor-pointer py-2.5 font-medium hover:bg-slate-50 focus:bg-slate-50 text-emerald-700">
                        <Download size={16} />
                        تصدير المخزون الحالي
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="hidden" />
        </div>
    );

    return (
        <div className="px-8 pt-4 pb-8 bg-gradient-to-br from-slate-50 to-blue-50/30 min-h-screen" dir="rtl">
            <PageHeader
                title="مخزن قطع الغيار"
                subtitle="إدارة المخزون، سجل الحركة، وعمليات التوريد والاستهلاك"
                filter={filterElement}
                actions={actionElements}
            />

            {/* Tabs */}
            <div className="flex gap-2 mb-8">
                <button
                    onClick={() => setActiveTab('inventory')}
                    className={`px-8 py-3.5 rounded-xl flex items-center gap-2 font-black transition-all ${activeTab === 'inventory' ? 'bg-gradient-to-r from-primary to-primary/90 text-white shadow-lg' : 'bg-white border-2 border-primary/10 text-primary hover:bg-primary/5 shadow-sm'}`}
                >
                    <Package size={18} />
                    المخزون الحالي
                </button>
                <button
                    onClick={() => setActiveTab('movements')}
                    className={`px-8 py-3.5 rounded-xl flex items-center gap-2 font-black transition-all ${activeTab === 'movements' ? 'bg-gradient-to-r from-primary to-primary/90 text-white shadow-lg' : 'bg-white border-2 border-primary/10 text-primary hover:bg-primary/5 shadow-sm'}`}
                >
                    <History size={18} />
                    سجل الحركة
                </button>
            </div>

            {activeTab === 'inventory' && (
                <div className="bg-white rounded-2xl border-2 border-primary/10 shadow-xl overflow-hidden">
                    <div className="p-4 border-b flex justify-between items-center bg-slate-50/5">
                        <p className="font-black text-primary flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            إجمالي الأصناف المتوفرة: {filteredInventory?.length || 0}
                        </p>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full whitespace-nowrap">
                            <thead className="bg-gradient-to-r from-primary to-primary/90 text-white">
                                <tr>
                                    <th className="text-center p-4 font-black">الكود</th>
                                    <th className="text-center p-4 font-black">اسم القطعة</th>
                                    <th className="text-center p-4 font-black">الموديلات</th>
                                    <th className="text-right p-4 font-black">السعر</th>
                                    <th className="text-right p-4 font-black">الكمية</th>
                                    <th className="text-right p-4 font-black">تعديل</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredInventory?.map((item: any) => (
                                    <InventoryRow key={item.id} item={item} onUpdate={() => queryClient.invalidateQueries({ queryKey: ['inventory'] })} />
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'movements' && (
                <div className="bg-white rounded-2xl border-2 border-primary/10 shadow-xl overflow-hidden">
                    <div className="p-4 border-b bg-slate-50/50 flex flex-col md:flex-row justify-between gap-4">
                        <div className="flex flex-wrap items-center gap-4">
                            <div className="relative group">
                                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                                <input
                                    type="text"
                                    placeholder="بحث ذكي..."
                                    value={movementFilters.search}
                                    onChange={(e) => setMovementFilters(prev => ({ ...prev, search: e.target.value }))}
                                    className="pr-10 pl-4 py-2 border-2 border-primary/10 rounded-xl outline-none focus:border-primary/30 font-bold text-sm w-full md:w-64"
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                <label className="text-xs font-bold text-slate-500">من:</label>
                                <input
                                    type="date"
                                    value={movementFilters.startDate}
                                    onChange={(e) => setMovementFilters(prev => ({ ...prev, startDate: e.target.value }))}
                                    className="border-2 border-primary/10 rounded-lg px-2 py-1 text-xs font-bold outline-none"
                                />
                                <label className="text-xs font-bold text-slate-500">إلى:</label>
                                <input
                                    type="date"
                                    value={movementFilters.endDate}
                                    onChange={(e) => setMovementFilters(prev => ({ ...prev, endDate: e.target.value }))}
                                    className="border-2 border-primary/10 rounded-lg px-2 py-1 text-xs font-bold outline-none"
                                />
                            </div>
                        </div>

                        <button
                            onClick={handleExportMovements}
                            className="bg-primary text-white px-4 py-2 rounded-xl hover:shadow-lg hover:shadow-primary/20 transition-all font-bold text-sm flex items-center justify-center gap-2"
                        >
                            <Download size={16} />
                            تصدير السجل
                        </button>
                    </div>

                    <div className="min-h-[400px]">
                        {isMovementsLoading ? (
                            <div className="p-12 text-center text-slate-500 font-bold">جاري تحميل السجل...</div>
                        ) : (
                            <table className="w-full">
                                <thead className="bg-primary text-white">
                                    <tr>
                                        <th className="text-right p-4 font-black">النوع</th>
                                        <th className="text-right p-4 font-black">القطعة</th>
                                        <th className="text-right p-4 font-black">الكمية</th>
                                        <th className="text-right p-4 font-black">التفاصيل / العميل</th>
                                        <th className="text-right p-4 font-black">التاريخ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {movements?.map((mov: any) => (
                                        <tr key={mov.id} className="border-t hover:bg-slate-50 transition-colors">
                                            <td className="p-4">
                                                {mov.type === 'IN' ? (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-50 text-green-700 font-black text-xs border border-green-200">
                                                        <ArrowDownCircle size={14} />
                                                        دخول
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 text-red-700 font-black text-xs border border-red-200">
                                                        <ArrowUpCircle size={14} />
                                                        خروج
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-4">
                                                <div className="font-bold text-slate-800">{mov.partName}</div>
                                                <div className="text-[10px] text-slate-400 font-mono tracking-tighter uppercase">{mov.partNumber}</div>
                                            </td>
                                            <td className="p-4">
                                                <span className="text-lg font-black">{mov.quantity}</span>
                                            </td>
                                            <td className="p-4">
                                                <div className="text-sm font-medium text-slate-700">{mov.reason || '-'}</div>
                                                {(mov.customerBkCode || mov.machineSerial) && (
                                                    <div className="flex flex-col mt-1 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                                                        <div className="flex items-center gap-1.5 text-[11px] text-primary font-black">
                                                            <span>كود العميل: {mov.customerBkCode}</span>
                                                            <span className="text-slate-300">|</span>
                                                            <span>ماكينة: {mov.machineSerial}</span>
                                                        </div>
                                                    </div>
                                                )}
                                                <div className="text-[10px] text-slate-400 mt-0.5">بواسطة: {mov.performedBy || 'System'}</div>
                                            </td>
                                            <td className="p-4 text-xs font-bold text-slate-500">
                                                {new Date(mov.createdAt).toLocaleString('ar-EG')}
                                            </td>
                                        </tr>
                                    ))}
                                    {(!movements?.length) && (
                                        <tr>
                                            <td colSpan={5} className="p-12 text-center text-slate-400 font-bold">
                                                لا توجد حركات مطابقة للبحث
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>
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
