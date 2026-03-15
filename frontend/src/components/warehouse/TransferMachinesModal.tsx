import React, { useState, useEffect } from 'react';
import { X, Send, MapPin, ClipboardList, CheckCircle, Loader2, Building2, ExternalLink, Info } from 'lucide-react';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useAuth } from '../../context/AuthContext';
import { Dialog, DialogContent } from '../ui/dialog';
import { cn } from '../../lib/utils';

interface TransferMachinesModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (targetBranchId: string, notes: string) => void;
    selectedCount: number;
    branches: any[];
    isLoading: boolean;
}

export const TransferMachinesModal: React.FC<TransferMachinesModalProps> = ({
    isOpen,
    onClose,
    onSubmit,
    selectedCount,
    branches,
    isLoading
}) => {
    const { user } = useAuth();
    const [targetBranchId, setTargetBranchId] = useState('');
    const [notes, setNotes] = useState('');

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
            setTargetBranchId('');
            setNotes('');
        }
    }, [isOpen]);

    // Filter out: 1) Current user's branch (source), 2) ADMIN_AFFAIRS type branches
    const filteredBranches = Array.isArray(branches)
        ? branches.filter((b: any) => b.id !== user?.branchId && b.type !== 'ADMIN_AFFAIRS')
        : [];

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(targetBranchId, notes);
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="p-0 border-0 flex flex-col max-h-[95vh] h-auto overflow-hidden sm:max-w-md rounded-[2.5rem] shadow-2xl bg-white [&>button]:hidden text-right" dir="rtl">

                {/* Header Section with Blue Gradient */}
                <div className="modal-header shrink-0 p-8 pb-6 bg-gradient-to-br from-blue-600 to-indigo-700 relative overflow-hidden">
                    {/* Visual Decor */}
                    <div className="absolute top-0 left-0 w-full h-full opacity-15 pointer-events-none">
                        <div className="absolute -top-1/2 -left-1/4 w-[120%] h-[150%] bg-white rounded-full blur-[100px] rotate-12"></div>
                    </div>

                    <div className="modal-header-content relative z-10 text-right">
                        <div className="flex items-center gap-5 justify-end sm:justify-start">
                            <div className="p-4 bg-white/15 backdrop-blur-md rounded-2xl border border-white/20 shadow-xl text-white">
                                <Send size={28} strokeWidth={3} />
                            </div>
                            <div className="text-right">
                                <h2 className="modal-title text-2xl font-black text-white leading-tight tracking-tight">تحويل عهدة ماكينات</h2>
                                <div className="flex items-center gap-2 mt-1 justify-end">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-300 animate-pulse"></div>
                                    <p className="text-blue-50 font-bold text-[10px] uppercase tracking-widest opacity-90">نقل مخزني بين الفروع</p>
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

                        {/* Batch Statistics Hero */}
                        <div className="relative group">
                            <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-[2.2rem] blur opacity-15 group-hover:opacity-25 transition duration-500"></div>
                            <div className="relative bg-white border border-slate-100/50 rounded-[2rem] p-6 flex items-center justify-between shadow-sm">
                                <div className="flex items-center gap-5">
                                    <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center border-2 border-white shadow-inner shrink-0">
                                        <ClipboardList size={32} strokeWidth={2.5} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 leading-none">إجمالي الماكينات المختارة</span>
                                        <div className="flex items-center gap-3">
                                            <span className="text-3xl font-black text-slate-900 leading-none">{selectedCount}</span>
                                            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-black rounded-lg border border-emerald-100 uppercase tracking-widest">Selected Units</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="w-12 h-12 rounded-full border-2 border-slate-100 flex items-center justify-center text-slate-200">
                                    <ExternalLink size={20} />
                                </div>
                            </div>
                        </div>

                        {/* Smart Destination Selector */}
                        <div className="space-y-4">
                            <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 leading-none">
                                <MapPin size={14} className="text-blue-500" />
                                الفرع المستلم لوجهة التحويل
                            </label>
                            <div className="relative group/picker">
                                <div className="absolute top-1/2 -translate-y-1/2 right-6 p-2 bg-slate-50 text-slate-400 rounded-xl group-focus-within/picker:bg-blue-600 group-focus-within/picker:text-white transition-all duration-300 pointer-events-none z-10 border border-slate-100">
                                    <Building2 size={24} strokeWidth={3} />
                                </div>
                                <Select value={targetBranchId} onValueChange={setTargetBranchId} required>
                                    <SelectTrigger className="h-20 pr-18 pl-8 rounded-[2rem] border-2 bg-white border-slate-100 focus:border-blue-500 font-black text-sm shadow-xl shadow-slate-400/5 focus-visible:ring-0 outline-none transition-all">
                                        <SelectValue placeholder="اضغط هنا لاختيار الفرع الوجهة..." />
                                    </SelectTrigger>
                                    <SelectContent className="z-[99999] rounded-[2rem] border-2 border-slate-100 shadow-2xl p-3 max-h-64 overflow-hidden" dir="rtl">
                                        <div className="p-3 mb-2 bg-slate-50 rounded-2xl border border-slate-100">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">الفروع المتاحة للاستقبال</p>
                                        </div>
                                        {Array.isArray(filteredBranches) && filteredBranches.map((b: any) => (
                                            <SelectItem
                                                key={b.id}
                                                value={b.id}
                                                className="rounded-2xl p-4 font-black text-sm focus:bg-blue-50 focus:text-blue-700 transition-all mb-1 cursor-pointer"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-2 h-2 rounded-full bg-blue-500 shadow-sm shadow-blue-100"></div>
                                                    {b.name}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Logistics Context Info */}
                        <div className="p-5 bg-indigo-50/50 rounded-[2rem] border border-blue-100 flex items-start gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
                            <Info size={20} className="text-blue-500 shrink-0 mt-0.5" />
                            <p className="text-[11px] font-bold text-blue-800 leading-relaxed">
                                <span className="block font-black mb-1">تنبيه لوجيستي:</span>
                                سيتم خصم هذه الماكينات من عهدة <strong className="text-blue-600 underline underline-offset-2">فرعك الحالي</strong> وإضافتها كتحويل معلق "برسم الاستلام" في الفرع المختار. لن تدخل العهدة نهائياً إلا بعد قبول الفرع الآخر للطلب.
                            </p>
                        </div>

                        {/* Documentation / Order Notes */}
                        <div className="space-y-4">
                            <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 leading-none">
                                <ClipboardList size={14} className="text-blue-500" />
                                ملاحظات وتوجيهات أمر الشحن
                            </label>
                            <div className="relative">
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    className="smart-input min-h-[140px] p-8 text-sm font-bold bg-white border-2 border-white focus:border-blue-500 shadow-xl shadow-slate-400/5 resize-none leading-relaxed placeholder:text-slate-300 transition-all"
                                    placeholder="اكتب تفاصيل حالة الشحن، اسم المندوب، أو أي ملاحظات فنية عن الماكينات المحولة..."
                                />
                                <div className="absolute bottom-6 left-6 text-[10px] font-black text-slate-300 uppercase tracking-widest opacity-40">Shipment Log</div>
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
                            تراجع
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading || !targetBranchId}
                            className={cn(
                                "smart-btn-primary flex-[2] h-18 font-black text-lg flex items-center justify-center gap-3 shadow-2xl transition-all active:scale-[0.98] disabled:grayscale disabled:opacity-40",
                                targetBranchId
                                    ? "bg-blue-600 border-b-4 border-blue-700 hover:bg-blue-700 shadow-blue-100 text-white"
                                    : "bg-slate-200 text-slate-400 border-0 shadow-none"
                            )}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-6 h-6 animate-spin" />
                                    جاري المعالجة...
                                </>
                            ) : (
                                <>
                                    <Send size={24} strokeWidth={3} />
                                    تأكيد وإرسال التحويل
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
};

