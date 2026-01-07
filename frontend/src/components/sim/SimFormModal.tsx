import React from 'react';
import { SIM_TYPES } from './constants';

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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[150] p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-sm sm:max-w-md shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] overflow-hidden">
                <h2 className="text-xl font-black p-6 pb-4 border-b text-slate-900 shrink-0">
                    {editingSim ? 'تعديل شريحة' : 'إضافة شريحة جديدة'}
                </h2>

                <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                        {isAdmin && !editingSim && (
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1.5">الفرع *</label>
                                <select
                                    className="w-full border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
                                    value={formData.branchId || ''}
                                    onChange={e => setFormData({ ...formData, branchId: e.target.value })}
                                    required={!editingSim}
                                >
                                    <option value="">اختر الفرع...</option>
                                    {branches?.map((branch: any) => (
                                        <option key={branch.id} value={branch.id}>{branch.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1.5">مسلسل الشريحة *</label>
                            <input
                                type="text"
                                value={formData.serialNumber}
                                onChange={e => setFormData({ ...formData, serialNumber: e.target.value })}
                                className="w-full border rounded-xl px-4 py-2.5 font-mono focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
                                placeholder="8920100000000001"
                                required
                                dir="ltr"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1.5">نوع الشريحة</label>
                            <select
                                value={formData.type}
                                onChange={e => setFormData({ ...formData, type: e.target.value })}
                                className="w-full border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
                            >
                                <option value="">-- اختر --</option>
                                {SIM_TYPES.map(t => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1.5">الحالة</label>
                            <div className="flex gap-6 p-1">
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <input
                                        type="radio"
                                        name="status"
                                        value="ACTIVE"
                                        checked={formData.status === 'ACTIVE'}
                                        onChange={() => setFormData({ ...formData, status: 'ACTIVE' })}
                                        className="w-4 h-4 text-green-600 focus:ring-green-500 border-slate-300"
                                    />
                                    <span className="text-green-700 font-bold group-hover:text-green-800 transition-colors">سليمة</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <input
                                        type="radio"
                                        name="status"
                                        value="DEFECTIVE"
                                        checked={formData.status === 'DEFECTIVE'}
                                        onChange={() => setFormData({ ...formData, status: 'DEFECTIVE' })}
                                        className="w-4 h-4 text-red-600 focus:ring-red-500 border-slate-300"
                                    />
                                    <span className="text-red-700 font-bold group-hover:text-red-800 transition-colors">تالفة</span>
                                </label>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1.5">ملاحظات</label>
                            <textarea
                                value={formData.notes}
                                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                className="w-full border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
                                rows={3}
                                placeholder="أضف ملاحظاتك هنا..."
                            />
                        </div>
                    </div>

                    <div className="p-6 pt-4 border-t bg-slate-50/50 shrink-0 flex gap-3">
                        <button
                            type="submit"
                            className="flex-1 bg-purple-600 text-white py-3 rounded-xl font-black hover:bg-purple-700 shadow-lg shadow-purple-600/20 transition-all active:scale-95 disabled:opacity-50"
                            disabled={isPending}
                        >
                            {isPending ? 'جاري الحفظ...' : 'حفظ البيانات'}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 border-2 border-slate-100 text-slate-600 py-3 rounded-xl font-bold hover:bg-slate-50 transition-all"
                        >
                            إلغاء
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
