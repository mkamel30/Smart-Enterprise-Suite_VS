import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Package, Edit, Download, Upload, History, Check, X, Briefcase } from 'lucide-react';
import { Checkbox } from '../ui/checkbox';
import * as XLSX from 'xlsx';
import { api } from '../../api/client';
import { useApiMutation } from '../../hooks/useApiMutation';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

export function SparePartsTab() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [showAddForm, setShowAddForm] = useState(false);
    const [showEditForm, setShowEditForm] = useState(false);
    const [showImportDialog, setShowImportDialog] = useState(false);
    const [showPriceLogs, setShowPriceLogs] = useState(false);
    const [selectedPart, setSelectedPart] = useState<any>(null);
    const [importData, setImportData] = useState<any[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [modelFilter, setModelFilter] = useState('');

    // ESC key handler for modals
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setShowAddForm(false);
                setShowEditForm(false);
                setShowImportDialog(false);
                setShowPriceLogs(false);
            }
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, []);

    const [newPart, setNewPart] = useState({
        name: '', compatibleModels: '', defaultCost: 0, allowsMultiple: false
    });

    const { data: partsData, isLoading } = useQuery<any>({
        queryKey: ['spare-parts'],
        queryFn: () => api.getSpareParts()
    });

    const parts = Array.isArray(partsData) ? partsData : (partsData?.data || []);

    const createMutation = useApiMutation({
        mutationFn: (data: any) => api.createSparePart({
            ...data,
            userId: user?.id,
            userName: user?.displayName || user?.email,
            branchId: user?.branchId
        }),
        successMessage: 'تم إضافة القطعة بنجاح',
        errorMessage: 'فشل إضافة القطعة',
        invalidateKeys: [['spare-parts']],
        onSuccess: () => {
            setShowAddForm(false);
            setNewPart({ name: '', compatibleModels: '', defaultCost: 0, allowsMultiple: false });
        }
    });

    const updateMutation = useApiMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => api.updateSparePart(id, {
            ...data,
            userId: user?.id,
            userName: user?.displayName || user?.email,
            branchId: user?.branchId
        }),
        successMessage: 'تم تحديث القطعة بنجاح',
        errorMessage: 'فشل تحديث القطعة',
        invalidateKeys: [['spare-parts']],
        onSuccess: () => {
            setShowEditForm(false);
            setSelectedPart(null);
        }
    });

    const deleteMutation = useApiMutation({
        mutationFn: (id: string) => api.deleteSparePart(id),
        successMessage: 'تم حذف القطعة',
        errorMessage: 'فشل حذف القطعة',
        invalidateKeys: [['spare-parts']]
    });

    const bulkDeleteMutation = useApiMutation({
        mutationFn: (ids: string[]) => api.post('/spare-parts/bulk-delete', {
            ids,
            userId: user?.id,
            userName: user?.displayName || user?.email,
            branchId: user?.branchId
        }),
        successMessage: 'تم حذف القطع المحددة',
        errorMessage: 'فشل حذف القطع',
        invalidateKeys: [['spare-parts']],
        onSuccess: () => {
            setSelectedIds(new Set());
        }
    });

    // Extract unique models for classification
    const allModels = Array.from(new Set(
        parts.flatMap((p: any) => p.compatibleModels?.split(';').filter(Boolean).map((m: string) => m.trim()) || [])
    )).sort();

    // Filter parts based on search and model
    const filteredParts = parts.filter((p: any) => {
        const matchesSearch = !searchTerm ||
            p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.partNumber?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesModel = !modelFilter ||
            p.compatibleModels?.toLowerCase().split(';').map((m: string) => m.trim()).includes(modelFilter.toLowerCase());

        return matchesSearch && matchesModel;
    });

    const importMutation = useApiMutation({
        mutationFn: (parts: any[]) => api.post('/spare-parts/import', {
            parts,
            userId: user?.id,
            userName: user?.displayName || user?.email,
            branchId: user?.branchId
        }),
        successMessage: 'تم استيراد البيانات بنجاح',
        errorMessage: 'فشل استيراد البيانات',
        invalidateKeys: [['spare-parts']],
        onSuccess: (data: any) => {
            setShowImportDialog(false);
            setImportData([]);
            if (fileInputRef.current) fileInputRef.current.value = '';
            if (data?.skipped > 0) {
                toast(`تم تخطي ${data?.skipped} عنصر مكرر`, { icon: 'ℹ️' });
            }
        }
    });

    const broadcastMutation = useApiMutation({
        mutationFn: () => api.broadcastSpareParts(),
        successMessage: 'تم بث تحديثات قطع الغيار لجميع الفروع بنجاح',
        errorMessage: 'فشل بث التحديثات للقانون',
    });

    const toggleSelectAll = () => {
        if (selectedIds.size === parts?.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(parts?.map((p: any) => p.id)));
        }
    };

    const toggleSelect = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const handleDownloadTemplate = () => {
        const templateData = [
            { 'اسم القطعة': 'شاشة LCD', 'الموديلات المتوافقة': 's90;d210;vx520', 'السعر': 150, 'يسمح بأكثر من قطعة': 'نعم' },
            { 'اسم القطعة': 'لوحة مفاتيح', 'الموديلات المتوافقة': 'vx680;s80', 'السعر': 80, 'يسمح بأكثر من قطعة': 'لا' },
        ];
        const ws = XLSX.utils.json_to_sheet(templateData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'قطع الغيار');
        XLSX.writeFile(wb, 'spare_parts_parameters_import.xlsx');
    };

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

            const parsed = jsonData.map((row: any) => ({
                name: row['اسم القطعة'] || '',
                compatibleModels: row['الموديلات المتوافقة'] || '',
                defaultCost: parseFloat(row['السعر']) || 0,
                allowsMultiple: row['يسمح بأكثر من قطعة'] === 'نعم' || row['يسمح بأكثر من قطعة'] === true
            })).filter((p: any) => p.name);

            setImportData(parsed);
            setShowImportDialog(true);
        };
        reader.readAsArrayBuffer(file);
    };

    const handleConfirmImport = async () => {
        importMutation.mutate(importData);
    };

    const handleExport = () => {
        if (!parts?.length) return;
        const exportData = parts.map((p: any) => ({
            'رقم القطعة': p.partNumber,
            'اسم القطعة': p.name,
            'الموديلات المتوافقة': p.compatibleModels || '',
            'السعر': p.defaultCost,
            'يسمح بأكثر من قطعة': p.allowsMultiple ? 'نعم' : 'لا'
        }));
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'قطع الغيار');
        XLSX.writeFile(wb, 'spare_parts.xlsx');
    };

    if (isLoading) return <div>جاري التحميل...</div>;

    return (
        <div className="bg-card rounded-[2rem] border border-border shadow-2xl overflow-hidden animate-fade-in">
            <div className="p-8 border-b border-border flex flex-col md:flex-row justify-between items-start md:items-center bg-muted/20 gap-6">
                <div>
                    <h3 className="text-2xl font-black flex items-center gap-3">
                        <Package className="text-primary" size={28} />
                        قانون قطع الغيار
                    </h3>
                    <p className="text-sm text-muted-foreground mt-2">
                        الموديلات مفصولة بفاصلة منقوطة (;) • الحروف الصغيرة فقط
                    </p>
                </div>
                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                    {selectedIds.size > 0 && (
                        <button
                            onClick={() => {
                                if (confirm(`هل أنت متأكد من حذف ${selectedIds.size} عنصر؟`)) {
                                    bulkDeleteMutation.mutate(Array.from(selectedIds));
                                }
                            }}
                            className="bg-red-500 hover:bg-red-600 text-white px-4 py-3 rounded-2xl font-black text-xs transition-all shadow-lg animate-pulse"
                        >
                            <Trash2 size={16} className="inline ml-2" />
                            حذف المحدد ({selectedIds.size})
                        </button>
                    )}
                    <button onClick={handleDownloadTemplate} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-muted hover:bg-accent text-foreground px-4 py-3 rounded-2xl font-black text-xs transition-all border border-border">
                        <Download size={16} /> قالب Excel
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-muted hover:bg-accent text-foreground px-4 py-3 rounded-2xl font-black text-xs transition-all border border-border">
                        <Upload size={16} /> استيراد
                    </button>
                    <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="hidden" />
                    <button onClick={handleExport} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-muted hover:bg-accent text-foreground px-4 py-3 rounded-2xl font-black text-xs transition-all border border-border">
                        <Download size={16} /> تصدير
                    </button>
                    <button
                        onClick={() => broadcastMutation.mutate({})}
                        disabled={broadcastMutation.isPending}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 rounded-2xl font-black text-xs transition-all shadow-lg active:scale-95 disabled:opacity-50"
                        title="إرسال قائمة قطع الغيار لجميع الفروع فوراً"
                    >
                        {broadcastMutation.isPending ? '⏳ جاري البث...' : '📡 بث للقانون'}
                    </button>
                    <button onClick={() => setShowAddForm(true)} className="w-full md:w-auto flex items-center justify-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-2xl font-black transition-all hover:shadow-lg active:scale-95">
                        <Plus size={20} strokeWidth={3} /> إضافة قطعة
                    </button>
                </div>
            </div>

            {/* Search and Classification Bar */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="flex-1 relative">
                    <input
                        type="text"
                        placeholder="بحث بالاسم أو الكود..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-muted/30 border border-border rounded-2xl px-12 py-3 text-sm font-bold focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    />
                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-muted-foreground">
                        <Package size={18} />
                    </div>
                </div>
                <div className="w-full md:w-64 relative">
                    <select
                        value={modelFilter}
                        onChange={(e) => setModelFilter(e.target.value)}
                        className="w-full bg-muted/30 border border-border rounded-2xl px-10 py-3 text-sm font-bold appearance-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    >
                        <option value="">كل الموديلات</option>
                        {allModels.map((m: any) => (
                            <option key={m} value={m}>{m.toUpperCase()}</option>
                        ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-muted-foreground">
                        <Briefcase size={16} />
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto max-h-[600px] custom-scroll">
                <table className="w-full">
                    <thead className="bg-muted/90 backdrop-blur-md sticky top-0 z-10 border-b border-border">
                        <tr>
                            <th className="p-5 text-center w-12 bg-muted/90">
                                <div className="flex justify-center">
                                    <Checkbox
                                        checked={selectedIds.size > 0 && selectedIds.size === parts?.length}
                                        onCheckedChange={toggleSelectAll}
                                        className="h-5 w-5 rounded-md"
                                    />
                                </div>
                            </th>
                            <th className="text-center p-5 text-xs font-black uppercase tracking-widest text-muted-foreground bg-muted/90">الكود</th>
                            <th className="text-center p-5 text-xs font-black uppercase tracking-widest text-muted-foreground bg-muted/90">اسم القطعة</th>
                            <th className="text-center p-5 text-xs font-black uppercase tracking-widest text-muted-foreground bg-muted/90">الموديلات المتوافقة</th>
                            <th className="text-center p-5 text-xs font-black uppercase tracking-widest text-muted-foreground bg-muted/90">السعر الرسمي</th>
                            <th className="text-center p-5 text-xs font-black uppercase tracking-widest text-muted-foreground bg-muted/90">متعدد؟</th>
                            <th className="text-center p-5 text-xs font-black uppercase tracking-widest text-muted-foreground bg-muted/90">إجراءات</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                        {filteredParts?.map((p: any) => (
                            <tr key={p.id} className={`hover:bg-muted/30 transition-colors group ${selectedIds.has(p.id) ? 'bg-primary/5' : ''}`}>
                                <td className="p-5 text-center">
                                    <div className="flex justify-center">
                                        <Checkbox
                                            checked={selectedIds.has(p.id)}
                                            onCheckedChange={() => toggleSelect(p.id)}
                                            className="h-5 w-5 rounded-md"
                                        />
                                    </div>
                                </td>
                                <td className="p-5 font-mono font-black text-primary text-sm">{p.partNumber}</td>
                                <td className="p-5 font-black text-foreground">{p.name}</td>
                                <td className="p-5">
                                    <div className="flex flex-wrap gap-1">
                                        {p.compatibleModels?.split(';').map((m: string, i: number) => (
                                            <span key={i} className="px-2 py-0.5 bg-primary/5 text-primary border border-primary/10 rounded-full text-[10px] font-black uppercase">{m}</span>
                                        )) || '-'}
                                    </div>
                                </td>
                                <td className="p-5 font-bold text-emerald-500">{p.defaultCost} ج.م</td>
                                <td className="p-5 text-center">
                                    {p.allowsMultiple ?
                                        <span className="bg-emerald-500/10 text-emerald-500 p-1 rounded-lg inline-block"><Check size={16} /></span> :
                                        <span className="bg-muted text-muted-foreground/30 p-1 rounded-lg inline-block"><Check size={16} /></span>
                                    }
                                </td>
                                <td className="p-5">
                                    <div className="flex gap-2">
                                        <button onClick={() => { setSelectedPart({ ...p }); setShowEditForm(true); }} className="p-2 text-blue-500 hover:bg-blue-500/10 rounded-xl transition-all" title="تعديل"><Edit size={18} /></button>
                                        <button onClick={() => { setSelectedPart(p); setShowPriceLogs(true); }} className="p-2 text-purple-500 hover:bg-purple-500/10 rounded-xl transition-all" title="سجل الأسعار"><History size={18} /></button>
                                        <button onClick={() => { if (confirm('حذف هذه القطعة من القانون نهائياً؟')) deleteMutation.mutate(p.id); }} className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all" title="حذف"><Trash2 size={18} /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {(!filteredParts?.length) && (
                            <tr><td colSpan={7} className="p-20 text-center text-muted-foreground">
                                <Package size={64} className="mx-auto mb-4 opacity-20" />
                                <p className="font-black text-xl">لا توجد قطع غيار مسجلة</p>
                                <p className="text-sm mt-1">ابدأ بإضافة قطع يدوياً أو استيراد ملف Excel</p>
                            </td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {showAddForm && (
                <PartFormModal
                    title="إضافة قطعة غيار"
                    initialData={newPart}
                    onSubmit={(data: any) => createMutation.mutate(data)}
                    onClose={() => setShowAddForm(false)}
                />
            )}

            {showEditForm && selectedPart && (
                <PartFormModal
                    title="تعديل بيانات القطعة"
                    initialData={selectedPart}
                    onSubmit={(data: any) => updateMutation.mutate({ id: selectedPart.id, data })}
                    onClose={() => { setShowEditForm(false); setSelectedPart(null); }}
                />
            )}

            {showPriceLogs && selectedPart && (
                <PriceLogsModal partId={selectedPart.id} partName={selectedPart.name} onClose={() => setShowPriceLogs(false)} />
            )}

            {showImportDialog && (
                <div className="modal-overlay" onClick={() => { setShowImportDialog(false); setImportData([]); }}>
                    <div className="modal-container modal-sm" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-header-content">
                                <Upload className="modal-icon text-primary" size={24} />
                                <h2 className="modal-title">تأكيد استيراد البيانات</h2>
                            </div>
                            <button type="button" className="modal-close" onClick={() => { setShowImportDialog(false); setImportData([]); }}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className="modal-body">
                            <p className="text-muted-foreground mb-6">
                                سيتم إضافة <span className="text-foreground font-black underline decoration-primary decoration-4">{importData.length}</span> قطعة غيار جديدة للقانون.
                            </p>

                            <div className="border border-border rounded-xl overflow-hidden mb-6">
                                <div className="max-h-60 overflow-y-auto bg-muted/30 custom-scroll">
                                    {Array.isArray(importData) && importData.map((p, i) => (
                                        <div key={i} className="px-4 py-3 border-b border-border/50 last:border-0 flex justify-between items-center bg-white/50">
                                            <div>
                                                <div className="font-bold text-sm">{p.name}</div>
                                                <div className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase">{p.compatibleModels}</div>
                                            </div>
                                            <div className="text-emerald-600 font-bold text-sm">{p.defaultCost} ج.م</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button
                                onClick={() => { setShowImportDialog(false); setImportData([]); }}
                                className="smart-btn-secondary"
                            >
                                إلغاء
                            </button>
                            <button
                                onClick={handleConfirmImport}
                                className="smart-btn-primary bg-emerald-600 hover:bg-emerald-700"
                            >
                                تأكيد الاستيراد
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function PartFormModal({ title, initialData, onSubmit, onClose }: any) {
    const [formData, setFormData] = useState(initialData);

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-container modal-sm" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-header-content">
                        <Package className="modal-icon text-primary" size={24} />
                        <h2 className="modal-title">{title}</h2>
                    </div>
                    <button type="button" className="modal-close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={(e) => { e.preventDefault(); onSubmit(formData); }}>
                    <div className="modal-body space-y-4">
                        <div className="modal-form-field">
                            <label className="modal-form-label required uppercase tracking-widest text-[10px]">اسم القطعة</label>
                            <input
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                className="smart-input"
                                required
                            />
                        </div>

                        <div className="modal-form-field">
                            <label className="modal-form-label uppercase tracking-widest text-[10px]">الموديلات المتوافقة</label>
                            <input
                                placeholder="s90;d210;vx520"
                                value={formData.compatibleModels}
                                onChange={e => setFormData({ ...formData, compatibleModels: e.target.value })}
                                className="smart-input font-mono"
                            />
                            <p className="text-[10px] text-slate-400 mt-1">افصل بين الموديلات بفاصلة منقوطة (;)</p>
                        </div>

                        <div className="modal-form-field">
                            <label className="modal-form-label required uppercase tracking-widest text-[10px]">السعر الرسمي (ج.م)</label>
                            <input
                                type="number"
                                value={formData.defaultCost}
                                onChange={e => setFormData({ ...formData, defaultCost: parseFloat(e.target.value) })}
                                className="smart-input font-bold text-emerald-600"
                                required
                            />
                        </div>

                        <div
                            className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all cursor-pointer shadow-sm ${formData.allowsMultiple
                                ? 'bg-primary/5 border-primary/20 ring-4 ring-primary/5'
                                : 'bg-slate-50 border-slate-100 hover:border-primary/20 hover:bg-white'
                                }`}
                            onClick={() => setFormData({ ...formData, allowsMultiple: !formData.allowsMultiple })}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${formData.allowsMultiple ? 'bg-primary text-white' : 'bg-slate-200 text-slate-500'}`}>
                                    <Package size={18} />
                                </div>
                                <span className="text-xs font-black text-slate-700">تعدد الاستخدام</span>
                            </div>
                            <Checkbox
                                checked={formData.allowsMultiple}
                                onCheckedChange={(checked) => setFormData({ ...formData, allowsMultiple: !!checked })}
                                className="h-6 w-6 rounded-lg"
                            />
                        </div>
                    </div>

                    <div className="modal-footer">
                        <button type="button" onClick={onClose} className="smart-btn-secondary">إلغاء</button>
                        <button type="submit" className="smart-btn-primary">حفظ البيانات</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function PriceLogsModal({ partId, partName, onClose }: { partId: string; partName: string; onClose: () => void }) {
    const { data: logs, isLoading } = useQuery({
        queryKey: ['price-logs', partId],
        queryFn: () => api.get(`/spare-parts/${partId}/price-logs`)
    });

    const displayLogs = Array.isArray(logs) ? logs : [];

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-container modal-sm" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-header-content">
                        <History className="modal-icon text-purple-600" size={24} />
                        <h2 className="modal-title">سجل تغييرات السعر</h2>
                    </div>
                    <button type="button" className="modal-close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="modal-body">
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6">
                        <span className="text-xs text-slate-500 block mb-1">اسم القطعة</span>
                        <span className="font-bold">{partName}</span>
                    </div>

                    {isLoading ? (
                        <div className="text-center py-8 text-slate-500">جاري التحميل...</div>
                    ) : (
                        <div className="border rounded-xl overflow-hidden">
                            <div className="max-h-60 overflow-y-auto custom-scroll">
                                {displayLogs.length === 0 ? (
                                    <div className="p-8 text-center text-slate-500">لا توجد تغييرات في السعر</div>
                                ) : (
                                    <table className="w-full text-right text-sm">
                                        <thead className="bg-slate-50 sticky top-0 border-b">
                                            <tr>
                                                <th className="px-4 py-2 border-l">السعر القديم</th>
                                                <th className="px-4 py-2 border-l">السعر الجديد</th>
                                                <th className="px-4 py-2">التاريخ</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {displayLogs.map((log: any) => (
                                                <tr key={log.id} className="hover:bg-slate-50">
                                                    <td className="px-4 py-2 text-red-500 font-bold">{log.oldCost} ج.م</td>
                                                    <td className="px-4 py-2 text-emerald-600 font-bold">{log.newCost} ج.م</td>
                                                    <td className="px-4 py-2 text-[10px] text-slate-500">{new Date(log.changedAt).toLocaleString('ar-EG')}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    <button onClick={onClose} className="smart-btn-secondary w-full">إغلاق</button>
                </div>
            </div>
        </div>
    );
}
