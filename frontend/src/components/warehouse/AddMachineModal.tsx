import React, { useState, useEffect } from 'react';
import { X, Plus, AlertCircle, Cpu, Fingerprint, Database, Info, Save, Building2, Tag, FileText, CheckCircle, Loader2, Sparkles, Box } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Dialog, DialogContent } from '../ui/dialog';
import { cn } from '../../lib/utils';

interface AddMachineModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: any) => void;
    branches: any[];
    isAdmin: boolean;
    parameters: any[];
    isLoading: boolean;
}

export const AddMachineModal: React.FC<AddMachineModalProps> = ({
    isOpen,
    onClose,
    onSubmit,
    branches,
    isAdmin,
    parameters,
    isLoading
}) => {
    const { user } = useAuth();
    const isAffairs = user?.role === 'ADMIN_AFFAIRS';

    const [formData, setFormData] = useState({
        serialNumber: '',
        model: '',
        manufacturer: '',
        status: 'NEW', // Default strict for all initially
        notes: '',
        branchId: ''
    });

    // Reset form when modal opens
    useEffect(() => {
        if (isOpen) {
            setFormData({
                serialNumber: '',
                model: '',
                manufacturer: '',
                status: 'NEW',
                notes: '',
                branchId: ''
            });
        }
    }, [isOpen]);

    // ESC key handler
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    const handleSerialChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const sn = e.target.value.toUpperCase();
        const prefixMatch = parameters
            ?.sort((a: any, b: any) => b.prefix.length - a.prefix.length)
            .find((p: any) => sn.startsWith(p.prefix.toUpperCase()));

        setFormData(prev => ({
            ...prev,
            serialNumber: sn,
            model: prefixMatch?.model || '',
            manufacturer: prefixMatch?.manufacturer || ''
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(formData);
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="p-0 border-0 flex flex-col max-h-[95vh] h-auto overflow-hidden sm:max-w-xl rounded-[2.5rem] shadow-2xl bg-white [&>button]:hidden text-right" dir="rtl">

                {/* Header Section with Emerald Gradient */}
                <div className="modal-header shrink-0 p-8 pb-6 bg-gradient-to-br from-emerald-600 to-teal-700 relative overflow-hidden">
                    {/* Abstract Visual Elements */}
                    <div className="absolute top-0 left-0 w-full h-full opacity-15 pointer-events-none">
                        <div className="absolute -top-1/2 -left-1/4 w-[120%] h-[150%] bg-white rounded-full blur-[120px] rotate-12"></div>
                        <div className="absolute bottom-[-20%] right-[-10%] w-[40%] h-[100%] bg-emerald-300 rounded-full blur-[80px]"></div>
                    </div>

                    <div className="modal-header-content relative z-10 text-right">
                        <div className="flex items-center gap-5 justify-end sm:justify-start">
                            <div className="p-4 bg-white/15 backdrop-blur-md rounded-2xl border border-white/20 shadow-xl text-white">
                                <Plus size={28} strokeWidth={3} />
                            </div>
                            <div className="text-right">
                                <h2 className="modal-title text-2xl font-black text-white leading-tight tracking-tight">إضافة عهدة جديدة</h2>
                                <div className="flex items-center gap-2 mt-1 justify-end">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse"></div>
                                    <p className="text-emerald-50 font-bold text-[10px] uppercase tracking-widest opacity-90">تسجيل ماكينات POS في النظام</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <button type="button" className="modal-close bg-white/10 hover:bg-white/20 text-white transition-all p-2 rounded-xl backdrop-blur-sm" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden bg-slate-50/30">
                    <div className="flex-1 overflow-y-auto px-8 py-8 space-y-8 custom-scroll">

                        {/* Inventory Identity Banner */}
                        <div className="relative group">
                            <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-[2.2rem] blur opacity-15 group-hover:opacity-25 transition duration-500"></div>
                            <div className="relative bg-white border border-slate-100/50 rounded-[2rem] p-6 flex items-center justify-between shadow-sm">
                                <div className="flex items-center gap-5">
                                    <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center border-2 border-white shadow-inner shrink-0">
                                        <Box size={32} strokeWidth={2.5} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 leading-none">بيانات مخزنية ذكية</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg font-black text-slate-900">إضافة وحدة واحدة</span>
                                            <div className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[9px] font-black rounded border border-blue-100 uppercase tracking-tighter">Manual Entry</div>
                                        </div>
                                    </div>
                                </div>
                                <Sparkles className="text-emerald-200" size={24} />
                            </div>
                        </div>

                        {/* Serial & Auto-Recognition Engine */}
                        <div className="space-y-6">
                            <div className="relative group/field">
                                <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-3">
                                    <Fingerprint size={14} className="text-emerald-500" />
                                    الرقم التسلسلي للجهاز (S/N)
                                </label>
                                <div className="relative">
                                    <input
                                        placeholder="000-000-000"
                                        value={formData.serialNumber}
                                        onChange={handleSerialChange}
                                        required
                                        autoFocus
                                        className="smart-input text-2xl font-mono tracking-[0.2em] font-black h-20 py-4 px-10 border-2 border-white focus:border-emerald-500 bg-white shadow-xl shadow-slate-200/40 transition-all placeholder:text-slate-200"
                                    />
                                    {formData.serialNumber.length > 5 && (
                                        <div className="absolute left-6 top-1/2 -translate-y-1/2 animate-in fade-in zoom-in duration-500">
                                            {formData.model ? (
                                                <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl shadow-sm border border-emerald-200">
                                                    <CheckCircle size={20} strokeWidth={3} />
                                                </div>
                                            ) : (
                                                <div className="p-2 bg-amber-100 text-amber-600 rounded-xl shadow-sm border border-amber-200">
                                                    <Info size={20} strokeWidth={3} />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Intelligent Device Profiling */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">موديل الماكينة</label>
                                    <div className={cn(
                                        "h-18 flex items-center px-6 rounded-[1.5rem] border-2 transition-all duration-500",
                                        formData.model
                                            ? "bg-white border-emerald-500 text-emerald-900 font-black shadow-lg shadow-emerald-50"
                                            : "bg-slate-100 border-slate-100 text-slate-300 font-bold"
                                    )}>
                                        <Cpu className={cn("ml-3 transition-colors", formData.model ? "text-emerald-500 animate-pulse" : "opacity-20")} size={22} strokeWidth={2.5} />
                                        <span className="text-xs tracking-tight truncate">{formData.model || 'جاري التعرف على الموديل...'}</span>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">العلامة التجارية</label>
                                    <div className={cn(
                                        "h-18 flex items-center px-6 rounded-[1.5rem] border-2 transition-all duration-500",
                                        formData.manufacturer
                                            ? "bg-white border-blue-500 text-blue-900 font-black shadow-lg shadow-blue-50"
                                            : "bg-slate-100 border-slate-100 text-slate-300 font-bold"
                                    )}>
                                        <Database className={cn("ml-3 transition-colors", formData.manufacturer ? "text-blue-500" : "opacity-20")} size={22} strokeWidth={2.5} />
                                        <span className="text-xs tracking-tight truncate">{formData.manufacturer || 'تحديد المنتج...'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Status Selection Logic */}
                        <div className="space-y-4">
                            <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">
                                <Tag size={14} className="text-emerald-500" />
                                الفئة التشغيلية للوحدة
                            </label>
                            <div className="relative group/picker">
                                <div className="absolute top-1/2 -translate-y-1/2 right-6 p-2 bg-slate-100 text-slate-400 rounded-xl group-focus-within/picker:bg-emerald-600 group-focus-within/picker:text-white transition-all duration-300 pointer-events-none z-10 border border-slate-100">
                                    <Tag size={20} strokeWidth={3} />
                                </div>
                                <select
                                    value={formData.status}
                                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                                    className="smart-input h-18 pr-18 pl-8 rounded-2xl bg-white border-2 border-white focus:border-emerald-500 font-black text-sm appearance-none outline-none transition-all shadow-xl shadow-slate-400/5"
                                >
                                    <option value="NEW">ماكينات جديدة</option>
                                    {!isAffairs && <option value="STANDBY">ماكينات استبدال</option>}
                                    <option value="DEFECTIVE">ماكينات تالفة</option>
                                    {!isAffairs && <option value="CLIENT_REPAIR">صيانة عملاء</option>}
                                    {!isAffairs && <option value="REPAIRED">ماكينات من الصيانة</option>}
                                </select>
                                <div className="absolute left-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                                </div>
                            </div>
                        </div>

                        {/* Global Distribution (Admin Only) */}
                        {isAdmin && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                                <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">
                                    <Building2 size={14} className="text-emerald-500" />
                                    توجيه العهدة لفرع محدد
                                </label>
                                <div className="relative group/picker">
                                    <div className="absolute top-1/2 -translate-y-1/2 right-6 p-2 bg-slate-100 text-slate-400 rounded-xl group-focus-within/picker:bg-emerald-600 group-focus-within/picker:text-white transition-all duration-300 pointer-events-none z-10 border border-slate-100">
                                        <Building2 size={20} strokeWidth={3} />
                                    </div>
                                    <select
                                        value={formData.branchId}
                                        onChange={(e) => setFormData(prev => ({ ...prev, branchId: e.target.value }))}
                                        required
                                        className="smart-input h-18 pr-18 pl-8 rounded-2xl bg-white border-2 border-white focus:border-emerald-500 font-black text-sm appearance-none outline-none transition-all shadow-xl shadow-slate-400/5"
                                    >
                                        <option value="">اضغط لاختيار الفرع المستلم...</option>
                                        {Array.isArray(branches) && branches.map((b) => (
                                            <option key={b.id} value={b.id}>{b.name}</option>
                                        ))}
                                    </select>
                                    <div className="absolute left-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Inventory Notes Area */}
                        <div className="space-y-4">
                            <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">
                                <FileText size={14} className="text-emerald-500" />
                                سيرة الماكينة / ملخص الحالة
                            </label>
                            <div className="relative">
                                <textarea
                                    value={formData.notes}
                                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                                    placeholder="اكتب أي ملاحظات فنية، رقم عقد المورد، أو حالة الكرتونة..."
                                    className="smart-input min-h-[140px] p-8 text-sm font-bold bg-white border-2 border-white focus:border-emerald-500 shadow-xl shadow-slate-400/5 resize-none leading-relaxed placeholder:text-slate-200 transition-all"
                                />
                                <div className="absolute bottom-6 left-6 text-[10px] font-black text-slate-300 uppercase tracking-widest opacity-40">Hardware Log</div>
                            </div>
                        </div>

                        {/* Dynamic Warning Engine */}
                        {!formData.model && formData.serialNumber.length > 5 && (
                            <div className="p-5 bg-amber-50/50 rounded-[2rem] border border-amber-100/50 flex items-start gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
                                <AlertCircle className="text-amber-500 shrink-0 mt-0.5" size={20} strokeWidth={2.5} />
                                <div className="text-right">
                                    <p className="text-[11px] font-black text-amber-900 uppercase tracking-tighter mb-1">تنبيه: السيريال غير مسجل مسبقاً</p>
                                    <p className="text-[11px] font-bold text-amber-700 leading-relaxed">
                                        رقم السيريال المدخل لا ينتمي لأي فئة (Prefix) مسجلة في الإعدادات. سيتم تسجيل الماكينة كنوع <span className="underline underline-offset-2">"غير معروف"</span> حتى يتم تعديل بياناتها لاحقاً من قبل المدير.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Industrial Footer Actions */}
                    <div className="modal-footer p-8 bg-white border-t border-slate-100 shrink-0 gap-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="smart-btn-secondary flex-1 h-18 border-2 border-slate-100 text-slate-500 px-8 font-black text-sm"
                        >
                            تراجع
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading || !formData.serialNumber}
                            className={cn(
                                "smart-btn-primary flex-[2] h-18 font-black text-lg flex items-center justify-center gap-3 shadow-2xl transition-all active:scale-[0.98] disabled:grayscale disabled:opacity-40",
                                formData.serialNumber
                                    ? "bg-emerald-600 border-b-4 border-emerald-700 hover:bg-emerald-700 shadow-emerald-100 text-white"
                                    : "bg-slate-200 text-slate-400 border-0 shadow-none"
                            )}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-6 h-6 animate-spin" />
                                    جاري الحفظ...
                                </>
                            ) : (
                                <>
                                    <Save size={24} strokeWidth={3} />
                                    حفظ الماكينة للمخزن
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
};

