import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Edit2, Check, X, Settings as SettingsIcon, Package, Hash, ToggleLeft, ToggleRight } from 'lucide-react';
import { api } from '../api/client';
import { useApiMutation } from '../hooks/useApiMutation';

export default function AdminStoreSettings() {
    const [showAddForm, setShowAddForm] = useState(false);
    const [newItemType, setNewItemType] = useState({
        code: '',
        name: '',
        description: '',
        defaultUnit: 'وحدة',
        trackingMode: 'SERIAL_BASED'
    });

    const { data: itemTypes, isLoading } = useQuery({
        queryKey: ['admin-item-types'],
        queryFn: () => api.getAdminItemTypes()
    });

    const createMutation = useApiMutation({
        mutationFn: (data: any) => api.createAdminItemType(data),
        successMessage: 'تم إضافة نوع الصنف بنجاح',
        errorMessage: 'فشل إضافة نوع الصنف',
        invalidateKeys: [['admin-item-types']],
        onSuccess: () => {
            setShowAddForm(false);
            setNewItemType({
                code: '',
                name: '',
                description: '',
                defaultUnit: 'وحدة',
                trackingMode: 'SERIAL_BASED'
            });
        }
    });

    const updateMutation = useApiMutation({
        mutationFn: ({ id, data }: { id: string, data: any }) => api.updateAdminItemType(id, data),
        successMessage: 'تم تحديث الصنف',
        invalidateKeys: [['admin-item-types']]
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        createMutation.mutate(newItemType);
    };

    const toggleStatus = (type: any) => {
        updateMutation.mutate({ id: type.id, data: { isActive: !type.isActive } });
    };

    if (isLoading) return <div className="p-8 text-center animate-pulse">جاري تحميل الإعدادات...</div>;

    return (
        <div className="px-2 sm:px-8 pt-2 pb-6 space-y-4 sm:space-y-6 animate-fade-in" dir="rtl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
                <div className="text-right">
                    <h1 className="text-2xl sm:text-3xl font-black text-foreground flex items-center justify-end sm:justify-start gap-2 sm:gap-3">
                        <SettingsIcon className="text-primary w-7 h-7 sm:w-8 sm:h-8" />
                        إعدادات مخزن الشئون الإدارية
                    </h1>
                    <p className="text-xs sm:text-sm text-muted-foreground font-bold mt-1">إدارة أنواع الأصناف وطرق تتبعها</p>
                </div>
                <button
                    onClick={() => setShowAddForm(true)}
                    className="flex items-center justify-center gap-2 bg-primary text-primary-foreground px-6 py-3 sm:px-8 sm:py-4 rounded-xl sm:rounded-2xl font-black transition-all hover:shadow-xl active:scale-95 shadow-lg shadow-primary/20 text-sm sm:text-base"
                >
                    <Plus className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={3} />
                    إضافة صنف جديد
                </button>
            </div>

            <div className="bg-card rounded-2xl sm:rounded-[2.5rem] border border-border shadow-2xl overflow-hidden mt-4 sm:mt-6">
                <div className="overflow-x-auto">
                    <table className="w-full text-right">
                        <thead>
                            <tr className="bg-muted/50">
                                <th className="p-3 sm:p-5 text-xs font-black text-muted-foreground uppercase">الكود</th>
                                <th className="p-3 sm:p-5 text-xs font-black text-muted-foreground uppercase">الاسم</th>
                                <th className="p-3 sm:p-5 text-xs font-black text-muted-foreground uppercase hidden sm:table-cell">طريقة التتبع</th>
                                <th className="p-3 sm:p-5 text-xs font-black text-muted-foreground uppercase hidden md:table-cell">الوحدة</th>
                                <th className="p-3 sm:p-5 text-center text-xs font-black text-muted-foreground uppercase">الحالة</th>
                                <th className="p-3 sm:p-5 text-center text-xs font-black text-muted-foreground uppercase">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {itemTypes?.map((type: any) => (
                                <tr key={type.id} className="hover:bg-muted/30 transition-colors group">
                                    <td className="p-3 sm:p-5 font-mono font-black text-primary text-xs sm:text-base">{type.code}</td>
                                    <td className="p-3 sm:p-5 font-bold text-sm sm:text-lg">{type.name}</td>
                                    <td className="p-3 sm:p-5 hidden sm:table-cell">
                                        <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] sm:text-xs font-black ${type.trackingMode === 'SERIAL_BASED'
                                            ? 'bg-blue-500/10 text-blue-600'
                                            : 'bg-amber-500/10 text-amber-600'
                                            }`}>
                                            {type.trackingMode === 'SERIAL_BASED' ? <Hash size={12} /> : <Package size={12} />}
                                            {type.trackingMode === 'SERIAL_BASED' ? 'بالسيريال' : 'كميات فقط'}
                                        </span>
                                    </td>
                                    <td className="p-3 sm:p-5 font-bold text-muted-foreground hidden md:table-cell">{type.defaultUnit}</td>
                                    <td className="p-3 sm:p-5 text-center">
                                        <button
                                            onClick={() => toggleStatus(type)}
                                            className={`transition-all ${type.isActive ? 'text-emerald-500' : 'text-rose-400 opacity-50'}`}
                                        >
                                            {type.isActive ? <ToggleRight size={28} className="sm:w-9 sm:h-9" /> : <ToggleLeft size={28} className="sm:w-9 sm:h-9" />}
                                        </button>
                                    </td>
                                    <td className="p-3 sm:p-5 text-center">
                                        <button className="p-1 sm:p-2 text-muted-foreground hover:text-primary transition-colors">
                                            <Edit2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {itemTypes?.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="p-10 sm:p-20 text-center text-muted-foreground font-bold text-sm">
                                        لا يوجد أصناف معرفة حالياً. أضف أول صنف للبدء.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {showAddForm && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-md flex items-center justify-center z-[100] p-2 sm:p-4 overflow-y-auto">
                    <div className="bg-card rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-10 w-full max-w-lg border border-border shadow-2xl animate-scale-in my-4 text-right">
                        <h2 className="text-xl sm:text-3xl font-black mb-6 sm:mb-8 flex items-center justify-end sm:justify-start gap-2 sm:gap-3 text-foreground">
                            <Plus size={24} className="text-primary sm:w-8 sm:h-8" />
                            تعريف صنف جديد
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                <div className="space-y-1.5 text-right">
                                    <label className="text-xs font-black text-muted-foreground mr-1">كود الصنف (Unique Code)</label>
                                    <input
                                        placeholder="مثال: POS_MACHINE"
                                        value={newItemType.code}
                                        onChange={e => setNewItemType({ ...newItemType, code: e.target.value.toUpperCase() })}
                                        className="w-full bg-muted/50 border border-border rounded-xl sm:rounded-2xl px-4 sm:px-5 py-3 sm:py-4 focus:ring-4 focus:ring-primary/10 transition-all outline-none font-black text-sm sm:text-base"
                                        required
                                    />
                                </div>
                                <div className="space-y-1.5 text-right">
                                    <label className="text-xs font-black text-muted-foreground mr-1">اسم الصنف</label>
                                    <input
                                        placeholder="مثال: ماكينة صرف"
                                        value={newItemType.name}
                                        onChange={e => setNewItemType({ ...newItemType, name: e.target.value })}
                                        className="w-full bg-muted/50 border border-border rounded-xl sm:rounded-2xl px-4 sm:px-5 py-3 sm:py-4 focus:ring-4 focus:ring-primary/10 transition-all outline-none font-bold text-sm sm:text-base"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5 text-right">
                                <label className="text-xs font-black text-muted-foreground mr-1">طريقة التتبع</label>
                                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setNewItemType({ ...newItemType, trackingMode: 'SERIAL_BASED' })}
                                        className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border-2 transition-all flex flex-col items-center gap-1 sm:gap-2 ${newItemType.trackingMode === 'SERIAL_BASED'
                                            ? 'border-primary bg-primary/5 text-primary'
                                            : 'border-border bg-muted/30 text-muted-foreground hover:border-border/80'
                                            }`}
                                    >
                                        <Hash size={20} className="sm:w-6 sm:h-6" />
                                        <span className="font-black text-[10px] sm:text-sm">بالسيريال عهدة</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setNewItemType({ ...newItemType, trackingMode: 'NONE' })}
                                        className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border-2 transition-all flex flex-col items-center gap-1 sm:gap-2 ${newItemType.trackingMode === 'NONE'
                                            ? 'border-primary bg-primary/5 text-primary'
                                            : 'border-border bg-muted/30 text-muted-foreground hover:border-border/80'
                                            }`}
                                    >
                                        <Package size={20} className="sm:w-6 sm:h-6" />
                                        <span className="font-black text-[10px] sm:text-sm">كميات مستهلكة</span>
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-1.5 text-right">
                                <label className="text-xs font-black text-muted-foreground mr-1">الوحدة الافتراضية</label>
                                <select
                                    value={newItemType.defaultUnit}
                                    onChange={e => setNewItemType({ ...newItemType, defaultUnit: e.target.value })}
                                    className="w-full bg-muted/50 border border-border rounded-xl sm:rounded-2xl px-4 sm:px-5 py-3 sm:py-4 focus:ring-4 focus:ring-primary/10 transition-all outline-none font-bold text-sm sm:text-base appearance-none"
                                >
                                    <option value="وحدة">وحدة (ماكينة/شريحة)</option>
                                    <option value="بكرة">بكرة</option>
                                    <option value="كرتونة">كرتونة</option>
                                    <option value="رزمة">رزمة ورق</option>
                                    <option value="لتر">لتر</option>
                                </select>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4">
                                <button
                                    type="submit"
                                    disabled={createMutation.isPending}
                                    className="w-full sm:flex-1 bg-primary text-primary-foreground py-3 sm:py-4 rounded-xl sm:rounded-2xl font-black text-base sm:text-xl shadow-xl shadow-primary/20 transition-all active:scale-95 disabled:opacity-50 order-1 sm:order-2"
                                >
                                    {createMutation.isPending ? 'جاري الحفظ...' : 'حفظ الصنف'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowAddForm(false)}
                                    className="w-full sm:flex-1 bg-muted hover:bg-accent text-foreground py-3 sm:py-4 rounded-xl sm:rounded-2xl font-black text-base sm:text-xl transition-all active:scale-95 order-2 sm:order-1"
                                >
                                    إلغاء
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
