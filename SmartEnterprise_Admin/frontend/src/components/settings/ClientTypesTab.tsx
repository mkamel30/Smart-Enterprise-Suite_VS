import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2, Users, Edit } from 'lucide-react';
import { api } from '../../api/client';
import { useApiMutation } from '../../hooks/useApiMutation';

interface ClientType {
    id: string;
    name: string;
    description?: string;
}

export function ClientTypesTab() {
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingType, setEditingType] = useState<ClientType | null>(null);
    const [newType, setNewType] = useState<Omit<ClientType, 'id'>>({ name: '', description: '' });

    const { data: types, isLoading } = useQuery<ClientType[]>({
        queryKey: ['client-types'],
        queryFn: () => api.getClientTypes()
    });

    const createMutation = useApiMutation({
        mutationFn: (data: Omit<ClientType, 'id'>) => api.createClientType(data),
        successMessage: 'تم إضافة تصنيف العميل بنجاح',
        errorMessage: 'فشل إضافة التصنيف',
        invalidateKeys: [['client-types']],
        onSuccess: () => {
            closeModal();
        }
    });

    const updateMutation = useApiMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => api.updateClientType(id, data),
        successMessage: 'تم تحديث التصنيف بنجاح',
        errorMessage: 'فشل تحديث التصنيف',
        invalidateKeys: [['client-types']],
        onSuccess: () => {
            closeModal();
        }
    });

    const closeModal = () => {
        setShowAddForm(false);
        setEditingType(null);
        setNewType({ name: '', description: '' });
    };

    const deleteMutation = useApiMutation({
        mutationFn: (id: string) => api.deleteClientType(id),
        successMessage: 'تم حذف التصنيف',
        errorMessage: 'فشل حذف التصنيف',
        invalidateKeys: [['client-types']]
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingType) {
            updateMutation.mutate({ id: editingType.id, data: newType });
        } else {
            createMutation.mutate(newType);
        }
    };

    const handleEdit = (type: any) => {
        setEditingType(type);
        setNewType({ name: type.name, description: type.description || '' });
        setShowAddForm(true);
    };

    if (isLoading) return <div>جاري التحميل...</div>;

    return (
        <div className="bg-card rounded-[2rem] border border-border shadow-2xl overflow-hidden animate-fade-in transition-all">
            <div className="p-10 border-b border-border flex justify-between items-center bg-muted/20">
                <div>
                    <h3 className="text-2xl font-black flex items-center gap-3">
                        <Users className="text-primary" size={32} />
                        تصنيفات العملاء
                    </h3>
                    <p className="text-sm text-muted-foreground mt-2">إجمالي التصنيفات المعتمدة: {types?.length || 0}</p>
                </div>
                <button onClick={() => setShowAddForm(true)} className="flex items-center gap-3 bg-primary text-primary-foreground px-8 py-4 rounded-[1.5rem] font-black transition-all hover:shadow-xl hover:shadow-primary/20 hover:-translate-y-1 active:scale-95 shadow-lg">
                    <Plus size={24} strokeWidth={3} />
                    إضافة تصنيف جديد
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 p-6 bg-muted/5">
                {types?.map((t: any) => (
                    <div key={t.id} className="group relative bg-card border border-border rounded-2xl p-5 hover:shadow-lg hover:border-primary/30 transition-all duration-300 overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl -mr-12 -mt-12 group-hover:bg-primary/10 transition-colors" />

                        <div className="flex justify-between items-start mb-3 relative z-10">
                            <div className="p-2.5 bg-primary/10 rounded-xl text-primary group-hover:bg-primary group-hover:text-white transition-all duration-300">
                                <Users size={20} />
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                <button
                                    onClick={() => handleEdit(t)}
                                    className="p-1.5 text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10 rounded-lg transition-all"
                                    title="تعديل التصنيف"
                                >
                                    <Edit size={16} />
                                </button>
                                <button
                                    onClick={() => deleteMutation.mutate(t.id)}
                                    className="p-1.5 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all"
                                    title="حذف التصنيف"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>

                        <h4 className="text-base font-black text-foreground mb-1 relative z-10">{t.name}</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed relative z-10 line-clamp-2">
                            {t.description || "لا يوجد وصف محدد لهذا التصنيف."}
                        </p>
                    </div>
                ))}

                {(!types?.length) && (
                    <div className="col-span-full py-20 text-center text-muted-foreground border-2 border-dashed border-border rounded-[2.5rem]">
                        <Users size={64} className="mx-auto mb-6 opacity-20" />
                        <p className="text-xl font-black opacity-40">لم يتم تسجيل أي تصنيفات حتى الآن</p>
                    </div>
                )}
            </div>

            {showAddForm && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
                    <div className="bg-card rounded-[2.5rem] p-10 w-full max-w-md border border-border shadow-2xl animate-scale-in relative overflow-hidden">
                        <h2 className="text-2xl font-black mb-8 flex items-center gap-3 text-foreground relative z-10">
                            {editingType ? <Edit className="text-primary" size={28} /> : <Plus className="text-primary" size={28} />}
                            {editingType ? 'تعديل تصنيف العميل' : 'إضافة تصنيف عميل'}
                        </h2>

                        <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
                            <div className="space-y-1.5">
                                <label className="block text-xs font-black uppercase tracking-widest text-muted-foreground mr-1">اسم التصنيف</label>
                                <input
                                    placeholder="مثال: تموين، مخبز،..."
                                    value={newType.name}
                                    onChange={e => setNewType({ ...newType, name: e.target.value })}
                                    className="w-full bg-muted/50 border border-border rounded-2xl px-4 py-4 focus:ring-4 focus:ring-primary/10 transition-all outline-none font-black"
                                    required
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="block text-xs font-black uppercase tracking-widest text-muted-foreground mr-1">وصف التصنيف (اختياري)</label>
                                <textarea
                                    placeholder="شرح موجز لاستخدام هذا التصنيف..."
                                    value={newType.description}
                                    onChange={e => setNewType({ ...newType, description: e.target.value })}
                                    className="w-full bg-muted/50 border border-border rounded-2xl px-4 py-4 focus:ring-4 focus:ring-primary/10 transition-all outline-none font-bold min-h-[100px]"
                                />
                            </div>
                            <div className="flex gap-4 pt-4">
                                <button type="submit" className="flex-1 bg-primary text-primary-foreground py-4 rounded-2xl font-black text-lg shadow-lg shadow-primary/20 transition-all active:scale-95">
                                    {editingType ? 'حفظ التغييرات' : 'حفظ التصنيف'}
                                </button>
                                <button type="button" onClick={closeModal} className="flex-1 bg-muted hover:bg-accent text-foreground py-4 rounded-2xl font-black text-lg transition-all active:scale-95">إلغاء</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
