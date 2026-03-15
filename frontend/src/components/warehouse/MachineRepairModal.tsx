import React, { useState, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Wrench, ArrowUpRight, Hash, FileText, Loader2, Cpu, Database, Settings2 } from 'lucide-react';
import { Dialog, DialogContent } from '../ui/dialog';
import { cn } from '../../lib/utils';

interface MachineRepairModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (notes: string) => void;
    selectedMachine: any;
    isLoading: boolean;
}

export const MachineRepairModal: React.FC<MachineRepairModalProps> = ({
    isOpen,
    onClose,
    onSubmit,
    selectedMachine,
    isLoading
}) => {
    const [notes, setNotes] = useState('');

    // ESC key handler
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    // Reset notes on open
    useEffect(() => {
        if (isOpen) setNotes('');
    }, [isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(notes);
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="p-0 border-0 flex flex-col max-h-[95vh] h-auto overflow-hidden sm:max-w-md rounded-[2.5rem] shadow-2xl bg-white [&>button]:hidden text-right" dir="rtl">

                {/* Header Section with Emerald Gradient */}
                <div className="modal-header shrink-0 p-8 pb-6 bg-gradient-to-br from-emerald-600 to-teal-700 relative overflow-hidden">
                    {/* Visual Decor */}
                    <div className="absolute top-0 left-0 w-full h-full opacity-15 pointer-events-none">
                        <div className="absolute -top-1/2 -left-1/4 w-[150%] h-[150%] bg-white rounded-full blur-[100px] rotate-12"></div>
                    </div>

                    <div className="modal-header-content relative z-10">
                        <div className="flex items-center gap-5">
                            <div className="p-4 bg-white/15 backdrop-blur-md rounded-2xl border border-white/20 shadow-xl text-white">
                                <Wrench size={28} strokeWidth={3} />
                            </div>
                            <div>
                                <h2 className="modal-title text-2xl font-black text-white leading-tight tracking-tight">إصلاح وتنسيق الحالة</h2>
                                <div className="flex items-center gap-2 mt-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse"></div>
                                    <p className="text-emerald-50 font-bold text-[10px] uppercase tracking-widest opacity-90">تسوية فنية وإرجاع للمخزن</p>
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

                        {/* Technical Information Banner */}
                        <div className="relative group">
                            <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-[2.2rem] blur opacity-10 group-hover:opacity-20 transition duration-500"></div>
                            <div className="relative bg-white border border-emerald-100/50 rounded-[2rem] p-6 shadow-sm">
                                <div className="flex flex-col gap-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                                                <Hash size={16} strokeWidth={3} />
                                            </div>
                                            <span className="text-xl font-black text-slate-900 font-mono tracking-wider">{selectedMachine?.serialNumber}</span>
                                        </div>
                                        <div className="px-3 py-1 bg-red-50 text-red-600 text-[10px] font-black rounded-full border border-red-100 uppercase tracking-widest">
                                            Status: Defective
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 pt-2">
                                        <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 rounded-xl border border-slate-100">
                                            <Cpu size={14} className="text-slate-400" />
                                            <span className="text-xs font-bold text-slate-600 truncate">{selectedMachine?.model}</span>
                                        </div>
                                        <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 rounded-xl border border-slate-100">
                                            <Database size={14} className="text-slate-400" />
                                            <span className="text-xs font-bold text-slate-600 truncate">{selectedMachine?.manufacturer}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Transition Context Banner */}
                        <div className="bg-indigo-50/70 border-2 border-indigo-100 p-6 rounded-[2rem] flex items-start gap-5 group">
                            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-50 group-hover:scale-110 transition-transform duration-500 shrink-0">
                                <ArrowUpRight size={24} strokeWidth={3} />
                            </div>
                            <div className="space-y-1.5">
                                <h4 className="font-black text-indigo-900 text-sm tracking-tight leading-none">تغيير الحالة اللوجستية</h4>
                                <p className="text-[11px] font-bold text-indigo-700/80 leading-relaxed">
                                    سيتم إخراج الماكينة من سجل الأعطال ونقلها إلى خانة <strong className="text-indigo-900 font-black underline decoration-indigo-200">الاستبدال (STANDBY)</strong> لتكون متاحة لطلبات الصرف فور الحفظ.
                                </p>
                            </div>
                        </div>

                        {/* technical log input */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between px-2">
                                <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                                    <FileText size={14} className="text-emerald-500" />
                                    تقرير الصيانة وقطع الغيار
                                </label>
                                <div className="flex items-center gap-1.5 bg-amber-50 text-amber-600 px-2.5 py-1 rounded-lg border border-amber-100">
                                    <Settings2 size={12} strokeWidth={3} />
                                    <span className="text-[9px] font-black uppercase">Technical Entry</span>
                                </div>
                            </div>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className="smart-input min-h-[160px] p-6 text-sm font-bold bg-white border-2 border-slate-100 focus:border-emerald-500 shadow-inner resize-none leading-relaxed transition-all"
                                placeholder="صف بالتفصيل ما تم تنفيذه: سوفت وير جديد، تغيير شاشة، إصلاح سوكيت الشحن، إلخ..."
                                required
                            />
                            <div className="flex items-start gap-3 p-4 bg-slate-100/50 rounded-2xl border border-slate-200/50">
                                <AlertCircle size={16} className="text-slate-400 shrink-0 mt-0.5" />
                                <p className="text-[10px] font-bold text-slate-500 leading-relaxed">
                                    تذكير: هذه البيانات جزء من سجل الأداء الفني للماكينة، برجاء التأكد من دقة المعلومات المدخلة لأغراض الجودة والضمان.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="modal-footer p-8 bg-white border-t border-slate-100 shrink-0 gap-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="smart-btn-secondary flex-1 h-16 border-2 border-slate-100 text-slate-500 px-8 font-black text-sm"
                        >
                            تراجع عن العملية
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading || !notes}
                            className={cn(
                                "smart-btn-primary flex-[2] h-16 font-black text-lg flex items-center justify-center gap-3 shadow-xl transition-all active:scale-[0.98] disabled:grayscale disabled:opacity-40",
                                notes
                                    ? "bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 shadow-emerald-100 text-white"
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
                                    <CheckCircle size={24} strokeWidth={2.5} />
                                    تأكيد الإصلاح والإرجاع
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
};

