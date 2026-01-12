import React, { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Package, Edit, Download, Upload, History, Check, Square, CheckSquare } from 'lucide-react';
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

    const [newPart, setNewPart] = useState({
        name: '', compatibleModels: '', defaultCost: 0, allowsMultiple: false
    });

    const { data: parts, isLoading } = useQuery<any[]>({
        queryKey: ['spare-parts'],
        queryFn: () => api.getSpareParts()
    });

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
            if (data.skipped > 0) {
                toast(`تم تخطي ${data.skipped} عنصر مكرر`, { icon: 'ℹ️' });
            }
        }
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
                    <button onClick={() => setShowAddForm(true)} className="w-full md:w-auto flex items-center justify-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-2xl font-black transition-all hover:shadow-lg active:scale-95">
                        <Plus size={20} strokeWidth={3} /> إضافة قطعة
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto max-h-[600px] custom-scroll">
                <table className="w-full">
                    <thead className="bg-muted/90 backdrop-blur-md sticky top-0 z-10 border-b border-border">
                        <tr>
                            <th className="p-5 text-center w-12 bg-muted/90">
                                <button onClick={toggleSelectAll} className="text-muted-foreground hover:text-primary transition-colors">
                                    {selectedIds.size > 0 && selectedIds.size === parts?.length ? <CheckSquare size={20} /> : <Square size={20} />}
                                </button>
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
                        {parts?.map((p: any) => (
                            <tr key={p.id} className={`hover:bg-muted/30 transition-colors group ${selectedIds.has(p.id) ? 'bg-primary/5' : ''}`}>
                                <td className="p-5 text-center">
                                    <button onClick={() => toggleSelect(p.id)} className={`${selectedIds.has(p.id) ? 'text-primary' : 'text-muted-foreground/30 group-hover:text-muted-foreground'} transition-colors`}>
                                        {selectedIds.has(p.id) ? <CheckSquare size={20} /> : <Square size={20} />}
                                    </button>
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
                        {(!parts?.length) && (
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
                <div className="fixed inset-0 bg-background/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
                    <div className="bg-card rounded-[2.5rem] p-10 w-full max-w-lg border border-border shadow-2xl animate-scale-in">
                        <h2 className="text-2xl font-black mb-4 flex items-center gap-3">
                            <Upload className="text-primary" size={28} />
                            تأكيد استيراد البيانات
                        </h2>
                        <p className="text-muted-foreground mb-6">سيتم إضافة <span className="text-foreground font-black underline decoration-primary decoration-4">{importData.length}</span> قطعة غيار جديدة للقانون.</p>
                        <div className="max-h-60 overflow-y-auto border border-border rounded-2xl p-4 mb-8 bg-muted/30 custom-scroll">
                            {importData.map((p, i) => (
                                <div key={i} className="py-3 border-b border-border/50 last:border-0 flex justify-between items-center">
                                    <div>
                                        <div className="font-black">{p.name}</div>
                                        <div className="text-[10px] text-muted-foreground font-bold tracking-widest">{p.compatibleModels}</div>
                                    </div>
                                    <div className="text-emerald-500 font-black">{p.defaultCost} ج.م</div>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-4">
                            <button onClick={handleConfirmImport} className="flex-1 bg-emerald-500 text-white py-4 rounded-2xl font-black text-lg shadow-lg shadow-emerald-500/20 transition-all active:scale-95">تأكيد الاستيراد</button>
                            <button onClick={() => { setShowImportDialog(false); setImportData([]); }} className="flex-1 bg-muted hover:bg-accent text-foreground py-4 rounded-2xl font-black text-lg transition-all active:scale-95">إلغاء</button>
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
        <div className="fixed inset-0 bg-background/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
            <div className="bg-card rounded-[2.5rem] p-10 w-full max-w-md border border-border shadow-2xl animate-scale-in relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16" />
                <h2 className="text-2xl font-black mb-8 relative z-10">{title}</h2>
                <form onSubmit={(e) => { e.preventDefault(); onSubmit(formData); }} className="space-y-5 relative z-10">
                    <div className="space-y-1.5">
                        <label className="text-xs font-black text-muted-foreground mr-1 uppercase tracking-widest">اسم القطعة</label>
                        <input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full bg-muted/50 border border-border rounded-2xl px-5 py-4 focus:ring-4 focus:ring-primary/10 transition-all outline-none font-bold" required />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-black text-muted-foreground mr-1 uppercase tracking-widest">الموديلات المتوافقة</label>
                        <input placeholder="s90;d210;vx520" value={formData.compatibleModels} onChange={e => setFormData({ ...formData, compatibleModels: e.target.value })} className="w-full bg-muted/50 border border-border rounded-2xl px-5 py-4 focus:ring-4 focus:ring-primary/10 transition-all outline-none font-mono" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-black text-muted-foreground mr-1 uppercase tracking-widest">السعر الرسمي (ج.م)</label>
                        <input type="number" value={formData.defaultCost} onChange={e => setFormData({ ...formData, defaultCost: parseFloat(e.target.value) })} className="w-full bg-muted/50 border border-border rounded-2xl px-5 py-4 focus:ring-4 focus:ring-primary/10 transition-all outline-none font-black text-emerald-500" />
                    </div>
                    <label className="flex items-center gap-3 p-4 bg-muted/30 rounded-2xl border border-border/50 cursor-pointer group hover:bg-muted transition-colors">
                        <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${formData.allowsMultiple ? 'bg-primary border-primary' : 'border-border'}`}>
                            {formData.allowsMultiple && <Check size={14} className="text-white" strokeWidth={4} />}
                        </div>
                        <input type="checkbox" className="hidden" checked={formData.allowsMultiple} onChange={e => setFormData({ ...formData, allowsMultiple: e.target.checked })} />
                        <span className="text-sm font-black text-foreground">يسمح بتركيب أكثر من قطعة للماكينة الواحدة</span>
                    </label>
                    <div className="flex gap-4 pt-4">
                        <button type="submit" className="flex-1 bg-primary text-primary-foreground py-4 rounded-2xl font-black text-lg shadow-lg shadow-primary/20 transition-all active:scale-95">حفظ البيانات</button>
                        <button type="button" onClick={onClose} className="flex-1 bg-muted hover:bg-accent text-foreground py-4 rounded-2xl font-black text-lg transition-all active:scale-95">إلغاء</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function PriceLogsModal({ partId, partName, onClose }: { partId: string; partName: string; onClose: () => void }) {
    const { data: logs, isLoading } = useQuery({
        queryKey: ['price-logs', partId],
        queryFn: async () => {
            const res = await fetch(`http://localhost:5000/api/spare-parts/${partId}/price-logs`);
            return res.json();
        }
    });

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
                <h2 className="text-xl font-bold mb-4">سجل تغييرات السعر</h2>
                <p className="text-slate-600 mb-4">{partName}</p>
                {isLoading ? <p>جاري التحميل...</p> : (
                    <div className="max-h-60 overflow-y-auto">
                        {logs?.length === 0 ? (
                            <p className="text-slate-500 text-center py-4">لا توجد تغييرات في السعر</p>
                        ) : (
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-right py-2">السعر القديم</th>
                                        <th className="text-right py-2">السعر الجديد</th>
                                        <th className="text-right py-2">التاريخ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs?.map((log: any) => (
                                        <tr key={log.id} className="border-b">
                                            <td className="py-2 text-red-600">{log.oldCost} ج.م</td>
                                            <td className="py-2 text-green-600 font-bold">{log.newCost} ج.م</td>
                                            <td className="py-2 text-xs">{new Date(log.changedAt).toLocaleString('ar-EG')}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}
                <button onClick={onClose} className="mt-4 w-full bg-slate-900 text-white py-2 rounded-lg">إغلاق</button>
            </div>
        </div>
    );
}
