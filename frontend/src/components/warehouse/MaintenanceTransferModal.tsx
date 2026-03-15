import React, { useState, useEffect } from 'react';
import { X, Wrench, Send, Truck, FileText, MapPin, Hash, CheckCircle, Loader2, Package, Inbox, ClipboardList, Info } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { api } from '../../api/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { Dialog, DialogContent } from '../ui/dialog';
import { cn } from '../../lib/utils';

interface MaintenanceTransferModalProps {
    selectedMachines: string[];
    onClose: () => void;
    performedBy: string;
}

export function MaintenanceTransferModal({ selectedMachines, onClose, performedBy }: MaintenanceTransferModalProps) {
    const { user } = useAuth();
    const [targetBranchId, setTargetBranchId] = useState('');
    const [waybillNumber, setWaybillNumber] = useState('');
    const [notes, setNotes] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const queryClient = useQueryClient();

    // Fetch Maintenance Centers
    const { data: maintenanceCenters } = useQuery({
        queryKey: ['maintenance-centers'],
        queryFn: () => api.getBranchesByType('MAINTENANCE_CENTER')
    });

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
        setWaybillNumber('');
        setNotes('');
    }, []);

    // Effect to auto-select maintenance center
    useEffect(() => {
        const fetchBranchDetails = async () => {
            if (user?.branchId && !targetBranchId) {
                try {
                    const branch = await api.getBranch(user.branchId);
                    if (branch?.maintenanceCenterId) {
                        setTargetBranchId(branch.maintenanceCenterId);
                    }
                } catch (e) {
                    // Ignore error
                }
            }
        };
        fetchBranchDetails();
    }, [user?.branchId, targetBranchId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!targetBranchId) {
            toast.error('يرجى اختيار مركز الصيانة');
            return;
        }

        setIsLoading(true);
        try {
            await api.bulkTransferMachines({
                serialNumbers: selectedMachines,
                toBranchId: targetBranchId,
                waybillNumber,
                notes,
                performedBy
            });

            toast.success(`تم تحويل ${selectedMachines.length} ماكينة بنجاح`);
            queryClient.invalidateQueries({ queryKey: ['warehouse-machines'] });
            queryClient.invalidateQueries({ queryKey: ['transfer-orders'] });
            onClose();
        } catch (error: any) {
            toast.error(error.message || 'فشل عملية التحويل');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="p-0 border-0 flex flex-col max-h-[95vh] h-auto overflow-hidden sm:max-w-md rounded-[2.5rem] shadow-2xl bg-white [&>button]:hidden text-right" dir="rtl">

                {/* Header Section with Amber Gradient */}
                <div className="modal-header shrink-0 p-8 pb-6 bg-gradient-to-br from-amber-500 to-orange-600 relative overflow-hidden">
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
                                <h2 className="modal-title text-2xl font-black text-white leading-tight tracking-tight">تحويل لصيانة خارجية</h2>
                                <div className="flex items-center gap-2 mt-1 justify-end">
                                    <div className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-pulse"></div>
                                    <p className="text-amber-50 font-bold text-[10px] uppercase tracking-widest opacity-90">دعم فني مركزي</p>
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

                        {/* Inventory Context Banner */}
                        <div className="relative group">
                            <div className="absolute -inset-1 bg-gradient-to-r from-amber-500 to-orange-500 rounded-[2.2rem] blur opacity-15 group-hover:opacity-25 transition duration-500"></div>
                            <div className="relative bg-white border border-slate-100/50 rounded-[2rem] p-6 flex items-center justify-between shadow-sm">
                                <div className="flex items-center gap-5">
                                    <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center border-2 border-white shadow-inner shrink-0">
                                        <Package size={32} strokeWidth={2.5} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 leading-none">إجمالي الماكينات المحولة</span>
                                        <div className="flex items-center gap-3">
                                            <span className="text-3xl font-black text-slate-900 leading-none">{selectedMachines.length}</span>
                                            <span className="px-2.5 py-1 bg-blue-50 text-blue-600 text-[10px] font-black rounded-lg border border-blue-100 uppercase tracking-widest">Units for Repair</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="w-12 h-12 rounded-full border-2 border-slate-100 flex items-center justify-center text-slate-200">
                                    <Inbox size={20} />
                                </div>
                            </div>
                        </div>

                        {/* Maintenance Center Picker */}
                        <div className="space-y-4">
                            <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 leading-none">
                                <MapPin size={14} className="text-amber-500" />
                                مركز الصيانة المعتمد (الاستلام)
                            </label>
                            <div className="relative group/picker">
                                <div className="absolute top-1/2 -translate-y-1/2 right-6 p-2 bg-slate-100 text-slate-400 rounded-xl group-focus-within/picker:bg-amber-600 group-focus-within/picker:text-white transition-all duration-300 pointer-events-none z-10 border border-slate-200">
                                    <MapPin size={24} strokeWidth={3} />
                                </div>
                                <select
                                    value={targetBranchId}
                                    onChange={(e) => setTargetBranchId(e.target.value)}
                                    className="smart-input h-20 pr-18 pl-8 rounded-[2rem] border-2 bg-white border-slate-200 focus:border-amber-500 font-black text-sm appearance-none outline-none transition-all cursor-pointer shadow-xl shadow-slate-400/5"
                                    required
                                >
                                    <option value="" disabled>اضغط لاختيار مركز الصيانة المعتمد...</option>
                                    {maintenanceCenters?.map((center: any) => (
                                        <option key={center.id} value={center.id}>{center.name}</option>
                                    ))}
                                </select>
                                <div className="absolute left-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                                </div>
                            </div>
                        </div>

                        {/* Waybill / Tracking Number */}
                        <div className="space-y-4">
                            <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 leading-none">
                                <Truck size={14} className="text-amber-500" />
                                رقم البوليصة / بيانات الشحن
                            </label>
                            <div className="relative group/input">
                                <div className="absolute top-1/2 -translate-y-1/2 right-6 text-slate-300 group-focus-within/input:text-amber-600 transition-colors pointer-events-none z-10">
                                    <Truck size={22} strokeWidth={2.5} />
                                </div>
                                <input
                                    type="text"
                                    value={waybillNumber}
                                    onChange={(e) => setWaybillNumber(e.target.value)}
                                    placeholder="مثال: AWB-123456789 (اختياري)"
                                    className="smart-input h-16 pr-18 pl-8 rounded-2xl bg-white border-2 border-slate-100 focus:border-amber-500 font-bold text-sm shadow-inner transition-all"
                                />
                            </div>
                        </div>

                        {/* Workflow Context Info */}
                        <div className="p-5 bg-orange-50/50 rounded-[2rem] border border-amber-100 flex items-start gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
                            <Info size={20} className="text-orange-500 shrink-0 mt-0.5" />
                            <p className="text-[11px] font-bold text-orange-800 leading-relaxed">
                                <span className="block font-black mb-1">تدفق العمليات الفنية:</span>
                                سيتم نقل الماكينات فوراً إلى قسم <strong className="text-orange-700 underline underline-offset-2">"تحت الصيانة الخارجية"</strong>. لا يمكن صرف هذه الوحدات أو استبدالها إلا بعد إرجاعها من المركز الفني.
                            </p>
                        </div>

                        {/* Technical Notes / Instructions */}
                        <div className="space-y-4">
                            <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 leading-none">
                                <ClipboardList size={14} className="text-amber-500" />
                                تعليمات الفحص والملاحظات الفنية
                            </label>
                            <div className="relative">
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    className="smart-input min-h-[140px] p-8 text-sm font-bold bg-white border-2 border-white focus:border-amber-500 shadow-xl shadow-slate-400/5 resize-none leading-relaxed placeholder:text-slate-300 transition-all"
                                    placeholder="صف العيوب الفنية في الشحنة، أو تعليمات خاصة لمركز الصيانة..."
                                />
                                <div className="absolute bottom-6 left-6 text-[10px] font-black text-slate-300 uppercase tracking-widest opacity-40">Maintenance Log</div>
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
                            إلغاء
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading || !targetBranchId}
                            className={cn(
                                "smart-btn-primary flex-[2] h-18 font-black text-lg flex items-center justify-center gap-3 shadow-2xl transition-all active:scale-[0.98] disabled:grayscale disabled:opacity-40",
                                targetBranchId
                                    ? "bg-amber-600 border-b-4 border-amber-700 hover:bg-amber-700 shadow-amber-100 text-white"
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
                                    تأكيد تحويل الشحنة
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

