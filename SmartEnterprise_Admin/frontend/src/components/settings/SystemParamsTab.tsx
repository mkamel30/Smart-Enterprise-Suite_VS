import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Settings, Save, RefreshCw, Send } from 'lucide-react';
import { settingsApi } from '../../api/settingsApi';
import { useApiMutation } from '../../hooks/useApiMutation';
import toast from 'react-hot-toast';

export function SystemParamsTab() {
    const { data: params, isLoading } = useQuery({
        queryKey: ['global-parameters'],
        queryFn: () => settingsApi.getGlobalParameters()
    });

    const updateMutation = useApiMutation({
        mutationFn: ({ id, value }: { id: string; value: string }) => 
            settingsApi.updateGlobalParameter(id, { value }),
        successMessage: 'تم تحديث الإعداد بنجاح',
        invalidateKeys: [['global-parameters']]
    });

    const broadcastMutation = useApiMutation({
        mutationFn: () => settingsApi.broadcastGlobalParameters(),
        successMessage: 'تم بث تحديثات الإعدادات لجميع الفروع',
        errorMessage: 'فشل بث التحديثات'
    });

    const [editingValues, setEditingValues] = useState<Record<string, string>>({});

    const handleValueChange = (id: string, value: string) => {
        setEditingValues(prev => ({ ...prev, [id]: value }));
    };

    const handleSave = (id: string) => {
        const value = editingValues[id];
        if (value === undefined) return;
        updateMutation.mutate({ id, value });
    };

    if (isLoading) return <div className="p-10 text-center">جاري التحميل...</div>;

    return (
        <div className="bg-card rounded-[2.5rem] border border-border shadow-2xl overflow-hidden animate-fade-in">
            <div className="p-8 border-b border-border flex justify-between items-center bg-muted/20">
                <div>
                    <h3 className="text-xl font-black flex items-center gap-3">
                        <Settings className="text-primary" size={24} />
                        إعدادات النظام العامة
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">تؤثر هذه الإعدادات على جميع الفروع فور المزامنة</p>
                </div>
                <button
                    onClick={() => broadcastMutation.mutate({})}
                    disabled={broadcastMutation.isPending}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-2xl font-black transition-all hover:shadow-lg active:scale-95 disabled:opacity-50"
                >
                    {broadcastMutation.isPending ? <RefreshCw className="animate-spin" size={18} /> : <Send size={18} />}
                    بث الإعدادات للفروع فوراً
                </button>
            </div>

            <div className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {params?.map((p: any) => (
                        <div key={p.id} className="bg-muted/30 border border-border rounded-2xl p-6 space-y-3 transition-all hover:border-primary/20">
                            <div className="flex justify-between items-start">
                                <div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-primary bg-primary/10 px-2 py-0.5 rounded-full mb-1 inline-block">
                                        {p.group || 'عام'}
                                    </span>
                                    <h4 className="font-black text-foreground">{p.key}</h4>
                                </div>
                                <button
                                    onClick={() => handleSave(p.id)}
                                    disabled={updateMutation.isPending || editingValues[p.id] === undefined}
                                    className="p-2 text-primary hover:bg-primary/10 rounded-xl transition-all disabled:opacity-30"
                                    title="حفظ التغيير"
                                >
                                    <Save size={20} />
                                </button>
                            </div>
                            
                            <div className="relative">
                                {p.type === 'boolean' ? (
                                    <select
                                        value={editingValues[p.id] !== undefined ? editingValues[p.id] : p.value}
                                        onChange={(e) => handleValueChange(p.id, e.target.value)}
                                        className="w-full bg-card border border-border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary transition-all font-bold"
                                    >
                                        <option value="true">مفعل (True)</option>
                                        <option value="false">معطل (False)</option>
                                    </select>
                                ) : (
                                    <input
                                        type={p.type === 'number' ? 'number' : 'text'}
                                        value={editingValues[p.id] !== undefined ? editingValues[p.id] : p.value}
                                        onChange={(e) => handleValueChange(p.id, e.target.value)}
                                        className="w-full bg-card border border-border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary transition-all font-bold"
                                    />
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
