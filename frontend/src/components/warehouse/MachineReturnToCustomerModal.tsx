import React, { useState, useEffect } from 'react';
import { X, UserCheck, Search, MessageSquare, Monitor, Loader2, User, Hash, FileText, AlertCircle, Building2, CheckCircle, Smartphone } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { Dialog, DialogContent } from '../ui/dialog';
import { cn } from '../../lib/utils';

interface MachineReturnToCustomerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (customerId: string, notes: string) => void;
    selectedMachine: any;
    isLoading: boolean;
}

export const MachineReturnToCustomerModal: React.FC<MachineReturnToCustomerModalProps> = ({
    isOpen,
    onClose,
    onSubmit,
    selectedMachine,
    isLoading
}) => {
    const [clientSearch, setClientSearch] = useState('');
    const [showClientList, setShowClientList] = useState(false);
    const [selectedClient, setSelectedClient] = useState<any>(null);
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
            setClientSearch('');
            setSelectedClient(null);
            setNotes('');
            setShowClientList(false);
        }
    }, [isOpen]);

    // Live search for customers using server-side filtering
    const [debouncedSearch, setDebouncedSearch] = useState('');

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(clientSearch);
        }, 300); // 300ms debounce

        return () => clearTimeout(timer);
    }, [clientSearch]);

    const { data: searchResults, isLoading: isSearching } = useQuery({
        queryKey: ['customer-search', debouncedSearch],
        queryFn: () => api.getCustomersLite(debouncedSearch),
        enabled: debouncedSearch.length > 0 && !selectedClient,
        staleTime: 30000 // Cache for 30 seconds
    });

    const filteredClients = searchResults || [];

    const handleSelectClient = (client: any) => {
        setSelectedClient(client);
        setClientSearch(`${client.client_name} (${client.bkcode})`);
        setShowClientList(false);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedClient) return;
        onSubmit(selectedClient.bkcode, notes);
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="p-0 border-0 flex flex-col max-h-[95vh] h-auto overflow-hidden sm:max-w-lg rounded-[2.5rem] shadow-2xl bg-white [&>button]:hidden text-right" dir="rtl">

                {/* Header Section with Emerald/Teal Gradient */}
                <div className="modal-header shrink-0 p-8 pb-6 bg-gradient-to-br from-emerald-600 to-teal-700 relative overflow-hidden">
                    {/* Visual Decor */}
                    <div className="absolute top-0 left-0 w-full h-full opacity-15 pointer-events-none">
                        <div className="absolute -top-1/2 -left-1/4 w-[150%] h-[150%] bg-white rounded-full blur-[100px] rotate-12"></div>
                    </div>

                    <div className="modal-header-content relative z-10 text-right">
                        <div className="flex items-center gap-5">
                            <div className="p-4 bg-white/15 backdrop-blur-md rounded-2xl border border-white/20 shadow-xl text-white">
                                <UserCheck size={28} strokeWidth={3} />
                            </div>
                            <div className="text-right">
                                <h2 className="modal-title text-2xl font-black text-white leading-tight tracking-tight">إرجاع الماكينة للعميل</h2>
                                <div className="flex items-center gap-2 mt-1 justify-end">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse"></div>
                                    <p className="text-emerald-50 font-bold text-[10px] uppercase tracking-widest opacity-90">إعادة تسليم لعهدة العميل</p>
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

                        {/* Machine Context Display */}
                        <div className="relative group">
                            <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-[2.2rem] blur opacity-15 group-hover:opacity-25 transition duration-500"></div>
                            <div className="relative bg-white border border-slate-100/50 rounded-[2rem] p-6 flex items-center justify-between shadow-sm">
                                <div className="flex items-center gap-5">
                                    <div className="w-14 h-14 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center border-2 border-white shadow-inner shrink-0 leading-none">
                                        <Monitor size={24} strokeWidth={2.5} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 leading-none">الماكينة المستلمة</span>
                                        <div className="flex items-center gap-3">
                                            <span className="text-xl font-black text-slate-900 font-mono tracking-wider">{selectedMachine?.serialNumber}</span>
                                            <span className="px-2.5 py-1 bg-blue-50 text-blue-600 text-[10px] font-black rounded-lg border border-blue-100 uppercase tracking-widest leading-none mt-0.5">Ready to Return</span>
                                        </div>
                                        <p className="text-[11px] font-bold text-slate-500 mt-2">
                                            {selectedMachine?.model} • {selectedMachine?.manufacturer}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Customer Live Search Interface */}
                        <div className="space-y-4 relative group/search">
                            <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 leading-none">
                                <User size={14} className="text-emerald-500" />
                                البحث عن العميل المستلم (كود أو اسم)
                            </label>
                            <div className="relative">
                                <div className="absolute top-1/2 -translate-y-1/2 right-6 p-2 bg-emerald-50 text-emerald-600 rounded-xl group-focus-within/search:bg-emerald-600 group-focus-within/search:text-white transition-all duration-300 pointer-events-none z-10">
                                    <Search size={22} strokeWidth={3} />
                                </div>
                                <input
                                    placeholder="ابدأ بكتابة اسم العميل أو الكود الخاص به..."
                                    value={clientSearch}
                                    onChange={(e) => {
                                        setClientSearch(e.target.value);
                                        setSelectedClient(null);
                                        setShowClientList(true);
                                    }}
                                    onFocus={() => setShowClientList(true)}
                                    className="smart-input h-20 pr-18 pl-8 text-sm font-black bg-white border-2 border-slate-100 focus:border-emerald-500 shadow-sm transition-all"
                                />
                            </div>

                            {/* Dropdown Results */}
                            {showClientList && clientSearch.length > 0 && (
                                <div className="absolute z-[110] w-full bg-white border-2 border-slate-100 rounded-[2rem] shadow-2xl mt-3 max-h-64 overflow-y-auto custom-scroll animate-in fade-in slide-in-from-top-4 duration-500 text-right">
                                    {isSearching ? (
                                        <div className="p-8 text-center text-slate-500 flex flex-col items-center justify-center gap-4">
                                            <Loader2 size={32} className="animate-spin text-emerald-500" />
                                            <span className="font-black text-xs uppercase tracking-widest text-slate-400">جاري مسح قاعدة البيانات...</span>
                                        </div>
                                    ) : filteredClients.length === 0 ? (
                                        <div className="p-8 text-center text-slate-400 flex flex-col items-center gap-4">
                                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center border border-slate-100">
                                                <AlertCircle size={32} className="opacity-20" />
                                            </div>
                                            <span className="font-black text-xs uppercase tracking-widest">لم يتم العثور على العميل</span>
                                        </div>
                                    ) : (
                                        <div className="p-3 space-y-2">
                                            {filteredClients.map(c => (
                                                <button
                                                    key={c.bkcode}
                                                    type="button"
                                                    onClick={() => handleSelectClient(c)}
                                                    className="w-full group flex items-center justify-between p-5 bg-white hover:bg-emerald-50/50 rounded-2xl transition-all border-2 border-transparent hover:border-emerald-100 text-right active:scale-[0.98]"
                                                >
                                                    <div className="flex flex-col gap-1">
                                                        <span className="font-black text-slate-900 text-base group-hover:text-emerald-700 transition-colors uppercase">{c.client_name}</span>
                                                        <div className="flex items-center gap-2">
                                                            <Building2 size={12} className="text-slate-300" />
                                                            <span className="text-[10px] font-bold text-slate-400 tracking-tight truncate max-w-[200px]">{c.client_address || 'العنوان غير مسجل'}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-[10px] font-black text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100">{c.bkcode}</span>
                                                        </div>
                                                        <Hash size={18} className="text-slate-200 group-hover:text-emerald-300 transition-colors" opacity={0.5} />
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Notes Section with visual feedback */}
                        <div className="space-y-4">
                            <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 leading-none">
                                <FileText size={14} className="text-teal-500" />
                                ملاحظات التسليم / الحالة النهائية
                            </label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className="smart-input min-h-[140px] p-6 text-sm font-bold bg-white border-2 border-slate-100 focus:border-emerald-500 shadow-inner resize-none leading-relaxed transition-all"
                                placeholder="صف حالة الماكينة عند التسليم، هل تم تسليمها والتشييك عليها أمام العميل؟"
                            />
                            <div className="flex gap-4 p-5 bg-blue-50/50 rounded-3xl border border-blue-100/30 animate-in fade-in slide-in-from-top-4 duration-500">
                                <Smartphone className="text-blue-500 shrink-0" size={20} strokeWidth={2.5} />
                                <p className="text-[11px] font-bold text-blue-700 leading-relaxed">
                                    <span className="block font-black mb-1">معلومة لوجستية:</span>
                                    بمجرد الحفظ، سيتم نقل ملكية الماكينة في النظام من "المخزن" إلى "عهدة العميل" المختار فوراً.
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
                            disabled={isLoading || !selectedClient}
                            className={cn(
                                "smart-btn-primary flex-[2] h-16 font-black text-lg flex items-center justify-center gap-3 shadow-xl transition-all active:scale-[0.98] disabled:grayscale disabled:opacity-40",
                                selectedClient
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
                                    تأكيد التسليم للعميل
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
};

