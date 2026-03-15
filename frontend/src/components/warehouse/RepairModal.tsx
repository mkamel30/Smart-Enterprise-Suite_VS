import React, { useState, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Wrench, Plus, Trash2, Package, Hash, Settings, Info, Minus, Loader2, Gauge, Activity, Cpu } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Dialog, DialogContent } from '../ui/dialog';
import { cn } from '../../lib/utils';

interface RepairModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (payload: any) => void;
    selectedMachine: any;
    isLoading: boolean;
}

export const RepairModal: React.FC<RepairModalProps> = ({
    isOpen,
    onClose,
    onSubmit,
    selectedMachine,
    isLoading
}) => {
    const { user } = useAuth();
    const [notes, setNotes] = useState('');
    const [resolution, setResolution] = useState<'REPAIRED' | 'SCRAPPED' | 'REJECTED_REPAIR'>('REPAIRED');
    const [usedParts, setUsedParts] = useState<{ partId: string; name: string; quantity: number; cost: number }[]>([]);

    // ESC key handler
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    // Reset state on open
    useEffect(() => {
        if (isOpen) {
            setNotes('');
            setResolution('REPAIRED');
            setUsedParts([]);
        }
    }, [isOpen]);

    const { data: inventory } = useQuery({
        queryKey: ['spare-parts-inventory'],
        queryFn: () => api.getInventoryLite() as any,
        enabled: !!user && resolution === 'REPAIRED'
    });

    const addPart = (partId: string) => {
        const part = (inventory as any[])?.find(p => p.partId === partId);
        if (!part) return;

        if (usedParts.find(p => p.partId === partId)) return;

        setUsedParts([...usedParts, {
            partId: part.partId,
            name: part.part.name,
            quantity: 1,
            cost: part.part.defaultCost
        }]);
    };

    const removePart = (partId: string) => {
        setUsedParts(usedParts.filter(p => p.partId !== partId));
    };

    const updatePartQuantity = (partId: string, qty: number) => {
        setUsedParts(usedParts.map(p => p.partId === partId ? { ...p, quantity: Math.max(1, qty) } : p));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit({
            resolution,
            notes,
            parts: usedParts
        });
    };

    const totalCost = usedParts.reduce((acc, p) => acc + (p.cost * p.quantity), 0);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="p-0 border-0 flex flex-col max-h-[95vh] h-auto overflow-hidden sm:max-w-2xl rounded-[2.5rem] shadow-2xl bg-white [&>button]:hidden text-right" dir="rtl">

                {/* Header Section with Purple Gradient */}
                <div className="modal-header shrink-0 p-8 pb-6 bg-gradient-to-br from-indigo-600 to-purple-700 relative overflow-hidden">
                    {/* Visual Decor */}
                    <div className="absolute top-0 left-0 w-full h-full opacity-15 pointer-events-none">
                        <div className="absolute -top-1/2 -left-1/4 w-[120%] h-[150%] bg-white rounded-full blur-[100px] rotate-12"></div>
                    </div>

                    <div className="modal-header-content relative z-10 text-right">
                        <div className="flex items-center gap-5 justify-end sm:justify-start">
                            <div className="p-4 bg-white/15 backdrop-blur-md rounded-2xl border border-white/20 shadow-xl text-white">
                                <Wrench size={28} strokeWidth={3} />
                            </div>
                            <div className="text-right">
                                <h2 className="modal-title text-2xl font-black text-white leading-tight tracking-tight">تقرير الحل الفني</h2>
                                <div className="flex items-center gap-2 mt-1 justify-end">
                                    <div className="w-1.5 h-1.5 rounded-full bg-purple-300 animate-pulse"></div>
                                    <p className="text-purple-50 font-bold text-[10px] uppercase tracking-widest opacity-90">تسجيل الصيانة وقطع الغيار</p>
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
                            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-[2.2rem] blur opacity-15 group-hover:opacity-25 transition duration-500"></div>
                            <div className="relative bg-white border border-slate-100/50 rounded-[2rem] p-6 flex flex-col gap-6 shadow-sm">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-5">
                                        <div className="w-14 h-14 bg-indigo-50 text-indigo-500 rounded-2xl flex items-center justify-center border-2 border-white shadow-inner shrink-0">
                                            <Hash size={24} strokeWidth={2.5} />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 leading-none">الماكينة تحت الإجراء</span>
                                            <div className="flex items-center gap-3">
                                                <span className="text-xl font-black text-slate-900 font-mono tracking-wider">{selectedMachine?.serialNumber}</span>
                                                <div className="px-2.5 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-black rounded-lg border border-indigo-100 uppercase tracking-widest">In Inspection</div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="hidden sm:flex flex-col items-end">
                                        <p className="text-sm font-black text-slate-900 leading-none">{selectedMachine?.model || '---'}</p>
                                        <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-tight">{selectedMachine?.manufacturer || 'Unknown Brand'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Strategic Resolution Picker */}
                        <div className="space-y-4">
                            <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 leading-none">
                                <Gauge size={14} className="text-indigo-500" />
                                القرار الفني واللوجستي النهائي
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {[
                                    { id: 'REPAIRED', label: 'تم الإصلاح', desc: 'إرجاع للخدمة', icon: CheckCircle, color: 'emerald' },
                                    { id: 'SCRAPPED', label: 'تخريد كلي', desc: 'سحب كقطع غيار', icon: AlertCircle, color: 'red' },
                                    { id: 'REJECTED_REPAIR', label: 'رفض الإصلاح', desc: 'إرجاع تالفة', icon: Minus, color: 'slate' }
                                ].map((item) => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => setResolution(item.id as any)}
                                        className={cn(
                                            "group relative p-5 rounded-[2rem] border-2 transition-all duration-500 text-right overflow-hidden active:scale-[0.98]",
                                            resolution === item.id
                                                ? `bg-white border-${item.color}-500 shadow-xl shadow-${item.color}-100/50`
                                                : "bg-white/50 border-slate-100 hover:border-slate-300 opacity-60 hover:opacity-100"
                                        )}
                                    >
                                        <div className="relative z-10 flex items-center gap-4">
                                            <div className={cn(
                                                "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500",
                                                resolution === item.id
                                                    ? `bg-${item.color}-50 text-${item.color}-600 border-${item.color}-100 border`
                                                    : "bg-slate-50 text-slate-300"
                                            )}>
                                                <item.icon size={22} strokeWidth={2.5} />
                                            </div>
                                            <div className="flex flex-col text-right">
                                                <span className={cn(
                                                    "font-black text-sm",
                                                    resolution === item.id ? `text-${item.color}-700` : "text-slate-500"
                                                )}>{item.label}</span>
                                                <span className="text-[10px] font-bold text-slate-300 mt-1 uppercase tracking-tight">{item.desc}</span>
                                            </div>
                                        </div>
                                        {resolution === item.id && (
                                            <div className={cn(
                                                "absolute -top-1 -right-1 w-8 h-8 flex items-center justify-center rounded-bl-2xl",
                                                `bg-${item.color}-500 text-white shadow-lg`
                                            )}>
                                                <CheckCircle size={14} strokeWidth={3} />
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Parts & Materials Management (Contextual) */}
                        {resolution === 'REPAIRED' && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-top-6 duration-700">
                                <div className="flex items-center justify-between px-2">
                                    <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                                        <Package size={14} className="text-indigo-500" />
                                        إدارة قطع الغيار المستهلكة
                                    </label>
                                    <div className="px-4 py-1.5 bg-emerald-600 text-white rounded-xl text-[11px] font-black shadow-lg shadow-emerald-100 border border-emerald-500 leading-none">
                                        التكلفة: {totalCost?.toLocaleString()} ج.م
                                    </div>
                                </div>

                                <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/20 overflow-hidden min-h-[180px] flex flex-col">
                                    {/* Selection Row */}
                                    <div className="p-5 bg-slate-50 border-b border-white">
                                        <div className="relative group/select">
                                            <div className="absolute top-1/2 -translate-y-1/2 right-5 p-2 bg-white text-indigo-500 rounded-xl shadow-sm border border-slate-100 group-focus-within/select:bg-indigo-600 group-focus-within/select:text-white transition-all duration-300 pointer-events-none z-10">
                                                <Plus size={20} strokeWidth={3} />
                                            </div>
                                            <select
                                                className="w-full h-16 pr-18 pl-6 rounded-2xl bg-white border-2 border-slate-100 focus:border-indigo-500 font-black text-sm appearance-none outline-none transition-all cursor-pointer shadow-inner"
                                                onChange={(e) => addPart(e.target.value)}
                                                value=""
                                            >
                                                <option value="" disabled>اضغط للبحث عن قطعة غيار في مخزن الفني...</option>
                                                {(inventory as any[])?.sort((a, b) => b.quantity - a.quantity).map(item => (
                                                    <option key={item.partId} value={item.partId} disabled={item.quantity <= 0}>
                                                        {item.part.name} (المخزون: {item.quantity}) • {item.part.defaultCost} ج.م
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Detailed List */}
                                    <div className="flex-1 divide-y divide-slate-50 overflow-y-auto max-h-[280px] custom-scroll">
                                        {usedParts.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center p-16 text-slate-300 gap-4">
                                                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center border border-slate-100 opacity-40">
                                                    <Activity size={32} />
                                                </div>
                                                <p className="text-[10px] font-bold uppercase tracking-widest">لم يتم تسجيل أي قطع حتى الآن</p>
                                            </div>
                                        ) : (
                                            usedParts.map(part => (
                                                <div key={part.partId} className="p-5 flex items-center justify-between group hover:bg-indigo-50/30 transition-all duration-300 border-r-4 border-transparent hover:border-indigo-500">
                                                    <div className="flex-1 pr-3">
                                                        <p className="text-sm font-black text-slate-900 leading-tight group-hover:text-indigo-800 transition-colors uppercase">{part.name}</p>
                                                        <div className="flex items-center gap-2 mt-1.5">
                                                            <div className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-black rounded-md">{part.cost?.toLocaleString()} EGP/Unit</div>
                                                            <div className="w-1 h-1 rounded-full bg-slate-200"></div>
                                                            <span className="text-[10px] font-black text-emerald-600">Subtotal: {(part.cost * part.quantity).toLocaleString()} ج.م</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-6">
                                                        <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border border-slate-100 shadow-sm group-hover:shadow-md transition-all">
                                                            <button
                                                                type="button"
                                                                onClick={() => updatePartQuantity(part.partId, part.quantity - 1)}
                                                                className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-all active:scale-90"
                                                            ><Minus size={16} strokeWidth={3} /></button>
                                                            <span className="text-base font-black w-8 text-center text-slate-900 font-mono tracking-tight">{part.quantity}</span>
                                                            <button
                                                                type="button"
                                                                onClick={() => updatePartQuantity(part.partId, part.quantity + 1)}
                                                                className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center hover:bg-emerald-50 hover:text-emerald-500 transition-all active:scale-90"
                                                            ><Plus size={16} strokeWidth={3} /></button>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => removePart(part.partId)}
                                                            className="w-10 h-10 rounded-xl bg-white text-slate-200 hover:text-red-500 hover:bg-red-50 hover:border-red-100 border-2 border-transparent transition-all"
                                                        >
                                                            <Trash2 size={20} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Engineering Technical Report */}
                        <div className="space-y-4">
                            <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 leading-none">
                                <Cpu size={14} className="text-indigo-500" />
                                التقرير الفني وحالة الاختبار
                            </label>
                            <div className="relative">
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    className="smart-input min-h-[160px] p-8 text-sm font-bold bg-white border-2 border-white focus:border-purple-500 shadow-xl shadow-slate-400/5 resize-none leading-relaxed placeholder:text-slate-300 transition-all"
                                    placeholder="اكتب التقرير الفني النهائي هنا (الأعطال المكتشفة، الحلول المنفذة، نتيجة اختبار الشتغيل)..."
                                    required
                                />
                                <div className="absolute bottom-6 left-6 text-[10px] font-black text-slate-300 uppercase tracking-widest opacity-40">Engineering Log</div>
                            </div>
                            <div className="p-5 bg-blue-50/50 rounded-3xl border border-blue-100 flex items-start gap-4">
                                <Info size={18} className="text-blue-500 shrink-0 mt-0.5" />
                                <p className="text-[11px] font-bold text-blue-700 leading-relaxed">
                                    هذا التقرير سيتم إرفاقه بسيرة حياة الماكينة (Asset History) وسيكون متاحاً لمدير المخزن وعمليات الفحص اللاحقة.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="modal-footer p-8 bg-white border-t border-slate-100 shrink-0 gap-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="smart-btn-secondary flex-1 h-18 border-2 border-slate-100 text-slate-500 px-8 font-black text-sm"
                        >
                            إلغاء الإجراء
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading || !notes.trim()}
                            className={cn(
                                "smart-btn-primary flex-[2] h-18 font-black text-lg flex items-center justify-center gap-3 shadow-2xl transition-all active:scale-[0.98] disabled:grayscale disabled:opacity-40",
                                notes.trim()
                                    ? "bg-slate-900 border-b-4 border-slate-950 hover:bg-slate-800 shadow-slate-100 text-white"
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
                                    <CheckCircle size={24} className="text-emerald-400" strokeWidth={3} />
                                    حفظ وإغلاق الطلب
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
};

