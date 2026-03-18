import React from 'react';
import { SIM_TYPES, NETWORK_TYPES } from './constants';
import { X, Smartphone, Save } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';

interface FormModalProps {
    isOpen: boolean;
    onClose: () => void;
    editingSim: any;
    formData: any;
    setFormData: (data: any) => void;
    handleSubmit: (e: React.FormEvent) => void;
    isAdmin: boolean;
    branches: any[] | undefined;
    isPending: boolean;
}

export function SimFormModal({
    isOpen,
    onClose,
    editingSim,
    formData,
    setFormData,
    handleSubmit,
    isAdmin,
    branches,
    isPending
}: FormModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[150] p-4 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white rounded-[32px] w-full max-w-sm sm:max-w-md shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 flex flex-col max-h-[90vh] overflow-hidden border border-slate-200">
                <div className="p-8 pb-4 flex justify-between items-center bg-slate-50/50 border-b border-slate-100 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary text-white rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
                            <Smartphone size={24} />
                        </div>
                        <h2 className="text-xl font-black text-slate-900">
                            {editingSim ? 'تعديل بيانات الشريحة' : 'إضافة شريحة جديدة'}
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-8 space-y-6">
                        {isAdmin && !editingSim && (
                            <div>
                                <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-2 mr-1">الفرع المسئول *</label>
                                <select
                                    className="w-full border-slate-200 rounded-2xl px-5 py-4 bg-slate-50/50 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white outline-none transition-all font-bold text-slate-700"
                                    value={formData.branchId || ''}
                                    onChange={e => setFormData({ ...formData, branchId: e.target.value })}
                                    required={!editingSim}
                                >
                                    <option value="">اختر الفرع المستلم...</option>
                                    {branches?.map((branch: any) => (
                                        <option key={branch.id} value={branch.id}>{branch.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-2 mr-1">مسلسل الشريحة (SN) *</label>
                            <input
                                type="text"
                                value={formData.serialNumber}
                                onChange={e => setFormData({ ...formData, serialNumber: e.target.value })}
                                className="w-full border-slate-200 rounded-2xl px-5 py-4 bg-slate-50/50 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white outline-none transition-all font-mono font-bold text-slate-900 text-lg shadow-inner"
                                placeholder="8920100000000001"
                                required
                                dir="ltr"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-2 mr-1">الشركة المشغلة</label>
                                <select
                                    value={formData.type}
                                    onChange={e => setFormData({ ...formData, type: e.target.value })}
                                    className="w-full border-slate-200 rounded-2xl px-5 py-4 bg-slate-50/50 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white outline-none transition-all font-bold text-slate-700"
                                >
                                    <option value="">-- اختر --</option>
                                    {SIM_TYPES.map(t => (
                                        <option key={t} value={t}>{t}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-2 mr-1">نوع الشبكة</label>
                                <select
                                    value={formData.networkType || ''}
                                    onChange={e => setFormData({ ...formData, networkType: e.target.value })}
                                    className="w-full border-slate-200 rounded-2xl px-5 py-4 bg-slate-50/50 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white outline-none transition-all font-bold text-slate-700"
                                >
                                    <option value="">-- تلقائي --</option>
                                    {NETWORK_TYPES.map(t => (
                                        <option key={t} value={t}>{t}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-2 mr-1">جودة الحالة التشغيلية</label>
                            <div className="flex gap-4 p-1">
                                <label className={cn(
                                    "flex-1 flex items-center justify-center gap-2 p-4 rounded-2xl border-2 transition-all cursor-pointer font-black text-sm",
                                    formData.status === 'ACTIVE'
                                        ? "bg-emerald-50 border-emerald-500 text-emerald-700 shadow-lg shadow-emerald-100"
                                        : "bg-white border-slate-100 text-slate-400 grayscale"
                                )}>
                                    <input
                                        type="radio"
                                        name="status"
                                        value="ACTIVE"
                                        checked={formData.status === 'ACTIVE'}
                                        onChange={() => setFormData({ ...formData, status: 'ACTIVE' })}
                                        className="sr-only"
                                    />
                                    <span>سليمة (نشطة)</span>
                                </label>
                                <label className={cn(
                                    "flex-1 flex items-center justify-center gap-2 p-4 rounded-2xl border-2 transition-all cursor-pointer font-black text-sm",
                                    formData.status === 'DEFECTIVE'
                                        ? "bg-red-50 border-red-500 text-red-700 shadow-lg shadow-red-100"
                                        : "bg-white border-slate-100 text-slate-400 grayscale"
                                )}>
                                    <input
                                        type="radio"
                                        name="status"
                                        value="DEFECTIVE"
                                        checked={formData.status === 'DEFECTIVE'}
                                        onChange={() => setFormData({ ...formData, status: 'DEFECTIVE' })}
                                        className="sr-only"
                                    />
                                    <span>تالفة (معطلة)</span>
                                </label>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-2 mr-1">ملاحظات إضافية</label>
                            <textarea
                                value={formData.notes}
                                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                className="w-full border-slate-200 rounded-2xl px-5 py-4 bg-slate-50/50 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white outline-none transition-all font-medium text-slate-700 min-h-[100px]"
                                placeholder="أضف أي تفاصيل أو ملاحظات هنا..."
                            />
                        </div>
                    </div>

                    <div className="p-8 pt-4 border-t bg-slate-50/50 shrink-0 flex gap-4">
                        <Button
                            type="submit"
                            disabled={isPending}
                            className="flex-[2] bg-primary hover:bg-primary/90 text-white rounded-2xl py-7 font-black shadow-xl shadow-primary/20 transition-all gap-2"
                        >
                            <Save size={20} />
                            {isPending ? 'جاري الحفظ...' : editingSim ? 'تحديث الشريحة' : 'حفظ الشريحة'}
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            className="flex-1 border-slate-200 text-slate-600 rounded-2xl py-7 font-bold hover:bg-white transition-all shadow-sm"
                        >
                            إلغاء
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
