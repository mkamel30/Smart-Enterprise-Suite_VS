import React, { useState, useEffect } from 'react';
import { X, RotateCcw, Search, AlertTriangle, Monitor, Loader2, ArrowLeftRight, User, Hash, FileText, CheckCircle, Smartphone, Building2 } from 'lucide-react';
import { api } from '../../api/client';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../ui/dialog';
import { cn } from '../../lib/utils';

interface MachineExchangeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: any) => void;
    selectedMachine: any; // The machine going OUT from warehouse
    isLoading: boolean;
    performedBy: string;
}

export const MachineExchangeModal: React.FC<MachineExchangeModalProps> = ({
    isOpen,
    onClose,
    onSubmit,
    selectedMachine,
    isLoading,
    performedBy
}) => {
    const [clientSearch, setClientSearch] = useState('');
    const [showClientList, setShowClientList] = useState(false);
    const [selectedClient, setSelectedClient] = useState<any>(null);
    const [clientMachines, setClientMachines] = useState<any[]>([]);
    const [isLoadingMachines, setIsLoadingMachines] = useState(false);
    const [exchangeData, setExchangeData] = useState<{
        incomingMachineId: string;
        incomingStatus: 'STANDBY' | 'DEFECTIVE' | 'CLIENT_REPAIR';
        incomingNotes: string;
    }>({
        incomingMachineId: '',
        incomingStatus: 'STANDBY',
        incomingNotes: ''
    });

    // ESC key handler
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

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

    const handleSelectClient = async (client: any) => {
        setSelectedClient(client);
        setClientSearch(`${client.client_name} (${client.bkcode})`);
        setShowClientList(false);
        setIsLoadingMachines(true);
        try {
            const machines = await api.getCustomerMachines(client.bkcode);
            setClientMachines(machines as any[]);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoadingMachines(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedClient || !exchangeData.incomingMachineId) return;

        onSubmit({
            outgoingMachineId: selectedMachine.id,
            customerId: selectedClient.bkcode,
            ...exchangeData,
            performedBy
        });
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="p-0 border-0 flex flex-col max-h-[95vh] h-auto overflow-hidden sm:max-w-xl rounded-[2.5rem] shadow-2xl bg-white [&>button]:hidden text-right" dir="rtl">
                <DialogTitle className="sr-only">استبدال ماكينة</DialogTitle>
                <DialogDescription className="sr-only">اختيار ماكينة بديلة من المخزن</DialogDescription>

                {/* Header Section with Indigo Gradient */}
                <div className="modal-header shrink-0 p-8 pb-6 bg-gradient-to-br from-primary to-primary/90 relative overflow-hidden">
                    {/* Abstract Decor */}
                    <div className="absolute top-0 left-0 w-full h-full opacity-15 pointer-events-none">
                        <div className="absolute -top-1/2 -left-1/4 w-[120%] h-[150%] bg-primary/30 rounded-full blur-[100px] rotate-12"></div>
                    </div>

                    <div className="modal-header-content relative z-10">
                        <div className="flex items-center gap-5">
                            <div className="p-4 bg-white/15 backdrop-blur-md rounded-2xl border border-white/20 shadow-xl text-white">
                                <ArrowLeftRight size={28} strokeWidth={3} />
                            </div>
                            <div>
                                <h2 className="modal-title text-2xl font-black text-white leading-tight tracking-tight">استبدال عهدة</h2>
                                <div className="flex items-center gap-2 mt-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary/30 animate-pulse"></div>
                                    <p className="text-primary/10 font-bold text-[10px] uppercase tracking-widest opacity-90">تبديل ماكينة المخزن بماكينة عميل</p>
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

                        {/* Inventory Context (Outgoing Machine) */}
                        <div className="relative group">
                            <div className="absolute -inset-1 bg-gradient-to-r from-primary to-primary rounded-[2.2rem] blur opacity-15 group-hover:opacity-25 transition duration-500"></div>
                            <div className="relative bg-white border border-slate-100/50 rounded-[2rem] p-6 flex flex-col gap-4 shadow-sm">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-primary/10 text-primary/70 rounded-xl flex items-center justify-center border border-primary/10 shadow-inner">
                                            <Monitor size={22} strokeWidth={2.5} />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">الماكينة المصروفة (جديدة)</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-lg font-black text-slate-900 font-mono tracking-wider">{selectedMachine?.serialNumber}</span>
                                                <span className="px-2 py-0.5 bg-primary/5 text-primary text-[10px] font-black rounded-lg border border-primary/20">{selectedMachine?.model}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-300">
                                        <CheckCircle size={20} strokeWidth={2.5} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Customer Search Interface */}
                        <div className="space-y-4 relative group/search">
                            <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 leading-none">
                                <User size={14} className="text-primary/70" />
                                البحث عن العميل صاحب الاستبدال
                            </label>
                            <div className="relative">
                                <div className="absolute top-1/2 -translate-y-1/2 right-6 p-2 bg-primary/10 text-primary rounded-xl group-focus-within/search:bg-primary group-focus-within/search:text-white transition-all duration-300 pointer-events-none z-10">
                                    <Search size={22} strokeWidth={2.5} />
                                </div>
                                <input
                                    placeholder="ابدأ بكتابة اسم العميل، الكود، أو بريفكس البحث..."
                                    value={clientSearch}
                                    onChange={(e) => {
                                        setClientSearch(e.target.value);
                                        setSelectedClient(null);
                                        setShowClientList(true);
                                    }}
                                    onFocus={() => setShowClientList(true)}
                                    className="smart-input h-20 pr-18 pl-8 text-sm font-black bg-white border-2 border-slate-100 focus:border-primary shadow-sm transition-all"
                                />
                            </div>

                            {/* Dynamic Search Results */}
                            {showClientList && clientSearch.length > 0 && (
                                <div className="absolute z-[110] w-full bg-white border-2 border-slate-100 rounded-[2rem] shadow-2xl mt-3 max-h-64 overflow-y-auto custom-scroll animate-in fade-in slide-in-from-top-4 duration-500">
                                    {isSearching ? (
                                        <div className="p-8 text-center text-slate-500 flex flex-col items-center justify-center gap-4">
                                            <Loader2 size={32} className="animate-spin text-primary/70" />
                                            <span className="font-black text-xs uppercase tracking-widest text-slate-400">جاري مسح قاعدة البيانات...</span>
                                        </div>
                                    ) : filteredClients.length === 0 ? (
                                        <div className="p-8 text-center text-slate-400 flex flex-col items-center gap-4">
                                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center border border-slate-100">
                                                <AlertTriangle size={32} className="opacity-20" />
                                            </div>
                                            <span className="font-black text-xs uppercase tracking-widest">لم نعثر على هذا العميل</span>
                                        </div>
                                    ) : (
                                        <div className="p-3 space-y-2">
                                            {filteredClients.map(c => (
                                                <button
                                                    key={c.bkcode}
                                                    type="button"
                                                    onClick={() => handleSelectClient(c)}
                                                    className="w-full group flex items-center justify-between p-5 bg-white hover:bg-primary/10 rounded-2xl transition-all border-2 border-transparent hover:border-primary/10 text-right active:scale-[0.98]"
                                                >
                                                    <div className="flex flex-col gap-1">
                                                        <span className="font-black text-slate-900 text-base group-hover:text-primary transition-colors uppercase">{c.client_name}</span>
                                                        <div className="flex items-center gap-2">
                                                            <Building2 size={12} className="text-slate-300" />
                                                            <span className="text-[10px] font-bold text-slate-400 tracking-tight truncate max-w-[220px]">{c.client_address || 'العنوان غير مسجل'}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-[10px] font-black text-primary/70 bg-primary/10 px-2 py-0.5 rounded-lg border border-primary/10">{c.bkcode}</span>
                                                            <span className="text-[8px] font-black text-slate-300 mt-1 uppercase tracking-widest">Client Code</span>
                                                        </div>
                                                        <Hash size={18} className="text-slate-200 group-hover:text-primary/40 transition-colors" />
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Incoming Configuration (Contextual) */}
                        {selectedClient && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-500">
                                <div className="h-0.5 bg-gradient-to-r from-transparent via-slate-200 to-transparent w-full"></div>

                                {/* Machine Selection from Client Stock */}
                                <div className="space-y-4">
                                    <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 leading-none">
                                        <Smartphone size={14} className="text-primary/70" />
                                        الماكينة المستلمة من العميل
                                    </label>
                                    <div className="relative group/m-select">
                                        <div className="absolute top-1/2 -translate-y-1/2 right-6 p-2 bg-slate-50 text-slate-400 group-focus-within/m-select:bg-primary group-focus-within/m-select:text-white transition-all duration-300 z-10 rounded-xl pointer-events-none">
                                            <Monitor size={22} strokeWidth={2.5} />
                                        </div>
                                        <select
                                            value={exchangeData.incomingMachineId}
                                            onChange={(e) => setExchangeData(prev => ({ ...prev, incomingMachineId: e.target.value }))}
                                            className={cn(
                                                "smart-select h-20 pr-18 pl-12 text-lg font-black bg-white border-2 border-slate-100 focus:border-primary shadow-inner transition-all appearance-none cursor-pointer",
                                                !exchangeData.incomingMachineId ? "text-slate-400" : "text-slate-900"
                                            )}
                                            required
                                        >
                                            <option value="">-- اختر الماكينة المطلوب سحبها --</option>
                                            {Array.isArray(clientMachines) && clientMachines.map(m => (
                                                <option key={m.id} value={m.id}>
                                                    {m.serialNumber} [{m.model}]
                                                </option>
                                            ))}
                                        </select>

                                        {isLoadingMachines && (
                                            <div className="absolute left-6 top-1/2 -translate-y-1/2">
                                                <Loader2 size={18} className="animate-spin text-primary/50" />
                                            </div>
                                        )}
                                    </div>

                                    {!isLoadingMachines && clientMachines.length === 0 && (
                                        <div className="p-5 bg-red-50/50 rounded-3xl border border-red-100 text-red-600 flex items-start gap-4 animate-in zoom-in-95 duration-300">
                                            <AlertTriangle size={20} className="shrink-0 mt-0.5" strokeWidth={2.5} />
                                            <p className="text-xs font-bold leading-relaxed">
                                                <span className="block font-black mb-1 italic">خطأ تقني:</span>
                                                لا توجد أي ماكينات مسجلة تحت كود هذا العميل حالياً. يرجى مراجعة سجل المبيعات والعهدة أولاً.
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {exchangeData.incomingMachineId && (
                                    <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500 bg-white/50 p-6 rounded-[2.5rem] border-2 border-white shadow-xl">
                                        <div className="space-y-4">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 flex items-center gap-2">
                                                الحالة التشغيلية عند الاستلام
                                            </label>
                                            <div className="grid grid-cols-1 gap-3">
                                                {['STANDBY', 'DEFECTIVE', 'CLIENT_REPAIR'].map((status) => (
                                                    <button
                                                        key={status}
                                                        type="button"
                                                        onClick={() => setExchangeData(prev => ({ ...prev, incomingStatus: status as any }))}
                                                        className={cn(
                                                            "h-16 px-6 rounded-2xl border-2 flex items-center justify-between font-black text-sm transition-all group/btn",
                                                            exchangeData.incomingStatus === status
                                                                ? "bg-primary/10 border-primary text-primary shadow-primary/20/50"
                                                                : "bg-white border-slate-100 text-slate-400 hover:border-slate-200"
                                                        )}
                                                    >
                                                        <div className="flex items-center gap-4">
                                                            <div className={cn(
                                                                "w-2.5 h-2.5 rounded-full transition-all duration-300",
                                                                exchangeData.incomingStatus === status ? "bg-primary scale-125 shadow-lg shadow-primary/30" : "bg-slate-200"
                                                            )}></div>
                                                            <span>
                                                                {status === 'STANDBY' && 'سليمة (STANDBY) - صالحة فوراً'}
                                                                {status === 'DEFECTIVE' && 'تالفة (DEFECTIVE) - تحتاج ورشة'}
                                                                {status === 'CLIENT_REPAIR' && 'صيانة (CLIENT_REPAIR) - ملوثة/تصليح بسيط'}
                                                            </span>
                                                        </div>
                                                        <div className={cn(
                                                            "p-2 rounded-lg transition-all",
                                                            exchangeData.incomingStatus === status ? "bg-primary/5 text-primary" : "bg-slate-50 text-slate-300"
                                                        )}>
                                                            <CheckCircle size={16} strokeWidth={exchangeData.incomingStatus === status ? 3 : 2} />
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 leading-none">
                                                <FileText size={14} className="text-slate-300" />
                                                تقرير حالة الاستلام / سبب الاستبدال
                                            </label>
                                            <textarea
                                                placeholder="اكتب سرد مفصل لحالة الماكينة، الكسور، أو ملاحظات الفني المستلم..."
                                                value={exchangeData.incomingNotes}
                                                onChange={(e) => setExchangeData(prev => ({ ...prev, incomingNotes: e.target.value }))}
                                                required={exchangeData.incomingStatus === 'DEFECTIVE'}
                                                className="smart-input min-h-[120px] py-5 px-6 text-sm font-bold resize-none bg-white border-2 shadow-inner leading-relaxed focus:border-primary transition-all"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Footer Actions */}
                    <div className="modal-footer p-8 bg-white border-t border-slate-100 shrink-0 gap-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="smart-btn-secondary flex-1 h-18 border-2 border-slate-100 text-slate-500 px-8 font-black text-sm"
                        >
                            إلغاء العملية
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading || !exchangeData.incomingMachineId}
                            className={cn(
                                "smart-btn-primary flex-[2] h-18 font-black text-lg flex items-center justify-center gap-3 shadow-xl transition-all active:scale-[0.98] disabled:grayscale disabled:opacity-40",
                                exchangeData.incomingMachineId
                                    ? "bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/90 shadow-primary/20 text-white"
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
                                    <RotateCcw size={22} strokeWidth={2.5} />
                                    تأكيد إتمام الاستبدال
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
};

