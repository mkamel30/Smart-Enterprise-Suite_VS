import React, { useState, useEffect } from 'react';
import { X, UserPlus, Search, Wrench, ChevronLeft, User, Loader2, CheckCircle, ShieldCheck, Sparkles, Inbox } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { api } from '../../api/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { Dialog, DialogContent } from '../ui/dialog';
import { cn } from '../../lib/utils';

interface AssignTechnicianModalProps {
    isOpen: boolean;
    onClose: () => void;
    machineId: string;
    serialNumber: string;
}

export function AssignTechnicianModal({ isOpen, onClose, machineId, serialNumber }: AssignTechnicianModalProps) {
    const { user } = useAuth();
    const [selectedTechId, setSelectedTechId] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const queryClient = useQueryClient();

    const { data: technicians } = useQuery({
        queryKey: ['technicians', user?.branchId],
        queryFn: () => api.getTechnicians()
    });

    // ESC key handler
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedTechId) {
            toast.error('يرجى اختيار فني للصيانة');
            return;
        }

        const technician = (technicians || []).find((t: any) => t.id === selectedTechId);

        setIsLoading(true);
        try {
            await api.post('/service-assignments', {
                machineId,
                serialNumber,
                technicianId: selectedTechId,
                technicianName: technician?.displayName || 'Unknown',
                branchId: user?.branchId
            });

            toast.success(`تم تعيين الفني بنجاح`);
            queryClient.invalidateQueries({ queryKey: ['service-assignments'] });
            queryClient.invalidateQueries({ queryKey: ['warehouse-machines'] }); // Update Kanban
            onClose();
        } catch (error: any) {
            toast.error(error.message || 'فشل التعيين');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="p-0 border-0 flex flex-col max-h-[92vh] h-auto overflow-hidden sm:max-w-md rounded-[2.5rem] shadow-2xl bg-white [&>button]:hidden text-right" dir="rtl">

                {/* Header Section with Tech-Blue Gradient */}
                <div className="modal-header shrink-0 p-8 pb-6 bg-gradient-to-br from-primary to-primary/90 relative overflow-hidden text-right">
                    {/* Visual Decor */}
                    <div className="absolute top-0 left-0 w-full h-full opacity-15 pointer-events-none">
                        <div className="absolute -top-1/2 -left-1/4 w-[150%] h-[150%] bg-white rounded-full blur-[100px] rotate-12"></div>
                        <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[80%] bg-primary/40 rounded-full blur-[60px]"></div>
                    </div>

                    <div className="modal-header-content relative z-10 text-right">
                        <div className="flex items-center gap-5 justify-end sm:justify-start">
                            <div className="p-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-xl text-white">
                                <UserPlus size={28} strokeWidth={3} />
                            </div>
                            <div className="text-right">
                                <h2 className="modal-title font-black text-white leading-tight tracking-tight text-2xl">تكليف فني صيانة</h2>
                                <div className="flex items-center gap-2 mt-1 justify-end">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-300 animate-pulse"></div>
                                    <p className="text-blue-50 font-bold text-[10px] uppercase tracking-widest opacity-90">إدارة المهام الفنية</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <button type="button" className="modal-close bg-white/10 hover:bg-white/20 text-white transition-all p-2 rounded-xl backdrop-blur-sm" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden bg-slate-50/30">
                    <div className="flex-1 overflow-y-auto px-8 py-8 space-y-8 custom-scroll text-right">

                        {/* Machine Context Banner */}
                        <div className="relative group">
                            <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-primary rounded-[2.2rem] blur opacity-15 group-hover:opacity-25 transition duration-500"></div>
                            <div className="relative bg-white border border-slate-100/50 rounded-[2rem] p-6 flex items-center justify-between shadow-sm">
                                <div className="flex items-center gap-5">
                                        <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center border-2 border-white shadow-inner shrink-0">
                                        <Wrench size={32} strokeWidth={2.5} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 leading-none">الجهاز قيد التكليف</span>
                                        <div className="flex items-center gap-3">
                                            <span className="text-lg font-black text-slate-900 font-mono tracking-wider">{serialNumber}</span>
                                            <span className="px-2.5 py-1 bg-amber-50 text-amber-600 text-[9px] font-black rounded-lg border border-amber-100 shadow-sm leading-none flex items-center gap-1">
                                                <Inbox size={10} />
                                                PENDING
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <Sparkles className="text-primary/20" size={24} />
                            </div>
                        </div>

                        {/* Tech Selection Control */}
                        <div className="space-y-4">
                            <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 leading-none">
                                <User size={14} className="text-blue-500" />
                                اختيار الفني المسؤول عن الصيانة
                            </label>
                            <div className="relative group/picker">
                                <div className="absolute top-1/2 -translate-y-1/2 right-6 p-2 bg-slate-100 text-slate-400 rounded-xl group-focus-within/picker:bg-primary group-focus-within/picker:text-white transition-all duration-300 pointer-events-none z-10 border border-slate-200 shadow-sm">
                                    <Search size={24} strokeWidth={3} />
                                </div>
                                <select
                                    value={selectedTechId}
                                    onChange={(e) => setSelectedTechId(e.target.value)}
                                    className="smart-input h-20 pr-18 pl-8 rounded-[2rem] border-2 bg-white border-slate-200 focus:border-primary font-black text-sm appearance-none outline-none transition-all cursor-pointer shadow-xl shadow-slate-400/5"
                                    required
                                >
                                    <option value="" disabled>اضغط للبحث واختيار الفني المتاح...</option>
                                    {technicians?.map((tech: any) => (
                                        <option key={tech.id} value={tech.id} className="font-bold py-4">{tech.displayName}</option>
                                    ))}
                                </select>
                                <div className="absolute left-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                                </div>
                            </div>
                        </div>

                        {/* Workflow Notification Banner */}
                        <div className="p-6 bg-blue-50/50 rounded-[2.5rem] border border-blue-100/50 flex items-start gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
                            <ShieldCheck size={20} className="text-blue-500 shrink-0 mt-0.5" />
                            <p className="text-[11px] font-bold text-blue-800 leading-relaxed text-right">
                                <span className="block font-black mb-1">تدفق العمليات الفنية:</span>
                                سيصل إشعار فوري للفني المختار على لوحة التحكم الخاصة به. سيتم نقل الماكينة فوراً إلى قسم <strong className="text-blue-700 underline underline-offset-2">"تحت الصيانة"</strong>. لا يمكن صرف هذه الوحدة لعميل حالياً.
                            </p>
                        </div>
                    </div>

                    {/* Industrial Footer Actions */}
                    <div className="modal-footer p-8 bg-white border-t border-slate-100 shrink-0 gap-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="smart-btn-secondary flex-1 h-18 border-2 border-slate-100 text-slate-500 px-8 font-black text-sm"
                        >
                            إلغاء التكليف
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading || !selectedTechId}
                            className={cn(
                                "smart-btn-primary flex-[2] h-18 font-black text-lg flex items-center justify-center gap-3 shadow-2xl transition-all active:scale-[0.98] disabled:grayscale disabled:opacity-40",
                                selectedTechId
                                    ? "bg-primary border-b-4 border-primary/90 hover:bg-primary/90 shadow-primary/20 text-white"
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
                                    <CheckCircle size={24} strokeWidth={3} />
                                    تأكيد التعيين
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

