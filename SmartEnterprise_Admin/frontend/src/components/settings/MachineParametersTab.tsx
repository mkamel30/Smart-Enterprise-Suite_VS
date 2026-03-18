import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '../../api/client';
import { useApiMutation } from '../../hooks/useApiMutation';
import type { ClientType, MachineParameter } from '../../lib/types';

export function MachineParametersTab() {
    const [showAddForm, setShowAddForm] = useState(false);
    const [newParam, setNewParam] = useState({ prefix: '', model: '', manufacturer: '' });

    const { data: params, isLoading } = useQuery<MachineParameter[]>({
        queryKey: ['machine-parameters'],
        queryFn: async () => {
            const data = await api.getMachineParameters();
            return data as MachineParameter[];
        }
    });

    const createMutation = useApiMutation({
        mutationFn: (data: any) => api.createMachineParameter(data),
        successMessage: 'تم إضافة البارامتر بنجاح',
        errorMessage: 'فشل إضافة البارامتر',
        invalidateKeys: [['machine-parameters']],
        onSuccess: () => {
            setShowAddForm(false);
            setNewParam({ prefix: '', model: '', manufacturer: '' });
        }
    });

    const deleteMutation = useApiMutation({
        mutationFn: (id: string) => api.deleteMachineParameter(id),
        successMessage: 'تم حذف البارامتر',
        errorMessage: 'فشل حذف البارامتر',
        invalidateKeys: [['machine-parameters']]
    });

    const [updateResult, setUpdateResult] = useState<string | null>(null);
    const forceUpdateMutation = useApiMutation({
        mutationFn: () => api.forceUpdateMachineModels(),
        successMessage: 'تم تحديث الموديلات',
        errorMessage: 'فشل تحديث الموديلات',
        invalidateKeys: [['warehouse-machines'], ['machine-parameters']],
        onSuccess: (data: any) => {
            setUpdateResult(`تحديث: ${data?.warehouseUpdated} مخازن، ${data?.customerUpdated} عملاء، ${data?.adminStoreUpdated} شئون إدارية`);
            setTimeout(() => setUpdateResult(null), 5000);
        }
    });

    const broadcastMutation = useApiMutation({
        mutationFn: () => api.broadcastMachineParameters(),
        successMessage: 'تم بث التحديثات لجميع الفروع بنجاح',
        errorMessage: 'فشل بث التحديثات للفروع',
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        createMutation.mutate(newParam);
    };

    if (isLoading) return <div>جاري التحميل...</div>;

    return (
        <div className="bg-card rounded-[2rem] border border-border shadow-2xl overflow-hidden animate-fade-in">
            <div className="p-8 border-b border-border flex flex-wrap justify-between items-center bg-muted/20 gap-4">
                <div>
                    <h3 className="text-xl font-black">بارامترات الماكينات</h3>
                    <p className="text-sm text-muted-foreground mt-1">إجمالي البارامترات المسجلة: {params?.length || 0}</p>
                </div>
                <div className="flex gap-3 flex-wrap">
                    <button
                        onClick={() => broadcastMutation.mutate({})}
                        disabled={broadcastMutation.isPending}
                        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-2xl font-black transition-all hover:shadow-lg active:scale-95 disabled:opacity-50"
                        title="إرسال هذه البارامترات لجميع الفروع فوراً"
                    >
                        {broadcastMutation.isPending ? '⏳ جاري البث...' : '📡 بث التحديث للفروع'}
                    </button>
                    <button
                        onClick={() => forceUpdateMutation.mutate({})}
                        disabled={forceUpdateMutation.isPending}
                        className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-6 py-3 rounded-2xl font-black transition-all hover:shadow-lg active:scale-95 disabled:opacity-50"
                        title="تحديث موديل ومصنع جميع الماكينات التي لم يتم تعيينها"
                    >
                        {forceUpdateMutation.isPending ? '⏳ جاري التحديث...' : '🔄 تحديث جميع الموديلات'}
                    </button>
                    <button onClick={() => setShowAddForm(true)} className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-2xl font-black transition-all hover:shadow-lg active:scale-95" title="إضافة بارامتر جديد (بادئة - موديل - شركة)">
                        <Plus size={22} strokeWidth={3} />
                        إضافة بادئة جديدة
                    </button>
                </div>
            </div>
            {updateResult && (
                <div className="bg-emerald-500/10 text-emerald-600 p-4 text-center font-bold border-b border-emerald-500/20">
                    ✅ {updateResult}
                </div>
            )}
            <div className="overflow-x-auto max-h-[600px] custom-scroll">
                <table className="w-full">
                    <thead className="bg-muted/90 backdrop-blur-md sticky top-0 z-10 border-b border-border">
                        <tr>
                            <th className="text-center p-5 text-xs font-black uppercase tracking-widest text-muted-foreground bg-muted/90">البادئة</th>
                            <th className="text-center p-5 text-xs font-black uppercase tracking-widest text-muted-foreground bg-muted/90">الموديل</th>
                            <th className="text-center p-5 text-xs font-black uppercase tracking-widest text-muted-foreground bg-muted/90">الشركة المصنعة</th>
                            <th className="text-center p-5 text-xs font-black uppercase tracking-widest text-muted-foreground bg-muted/90">إجراءات</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                        {params?.map((p: MachineParameter) => (
                            <tr key={p.id} className="hover:bg-muted/30 transition-colors group">
                                <td className="p-5 font-mono font-black text-primary group-hover:scale-105 transition-transform origin-right">{p.prefix}</td>
                                <td className="p-5 font-bold">{p.model}</td>
                                <td className="p-5 text-muted-foreground">{p.manufacturer}</td>
                                <td className="p-5">
                                    <button
                                        onClick={() => deleteMutation.mutate(p.id)}
                                        className="p-2.5 text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all"
                                        title="حذف البارامتر"
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showAddForm && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
                    <div className="bg-card rounded-[2.5rem] p-10 w-full max-w-md border border-border shadow-2xl animate-scale-in">
                        <h2 className="text-2xl font-black mb-8 flex items-center gap-3 text-foreground">
                            <Plus size={28} className="text-primary" />
                            إضافة بارامتر
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="space-y-1.5">
                                <label className="text-xs font-black text-muted-foreground mr-1">البادئة (Prefix)</label>
                                <input placeholder="مثال: 3C او 3K" value={newParam.prefix} onChange={e => setNewParam({ ...newParam, prefix: e.target.value.toUpperCase() })} className="w-full bg-muted/50 border border-border rounded-2xl px-4 py-4 focus:ring-4 focus:ring-primary/10 transition-all outline-none font-black uppercase" required />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-black text-muted-foreground mr-1">الموديل (Model)</label>
                                <input placeholder="مثال: S90" value={newParam.model} onChange={e => setNewParam({ ...newParam, model: e.target.value.toUpperCase() })} className="w-full bg-muted/50 border border-border rounded-2xl px-4 py-4 focus:ring-4 focus:ring-primary/10 transition-all outline-none font-bold uppercase" required />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-black text-muted-foreground mr-1">الشركة المصنعة</label>
                                <input placeholder="مثال: PAX" value={newParam.manufacturer} onChange={e => setNewParam({ ...newParam, manufacturer: e.target.value.toUpperCase() })} className="w-full bg-muted/50 border border-border rounded-2xl px-4 py-4 focus:ring-4 focus:ring-primary/10 transition-all outline-none font-bold uppercase" required />
                            </div>
                            <div className="flex gap-4 pt-4">
                                <button type="submit" className="flex-1 bg-primary text-primary-foreground py-4 rounded-2xl font-black text-lg shadow-lg shadow-primary/20 transition-all active:scale-95">حفظ</button>
                                <button type="button" onClick={() => setShowAddForm(false)} className="flex-1 bg-muted hover:bg-accent text-foreground py-4 rounded-2xl font-black text-lg transition-all active:scale-95">إلغاء</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
