import React, { useState, useEffect } from 'react';
import { X, ShoppingCart, Search, DollarSign, Wallet, Calendar, Loader2, User, Hash, FileText, Info, CheckCircle, AlertCircle, TrendingUp, Receipt, Building2, CreditCard, Sparkles, Tag } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { PaymentFields, usePaymentForm } from '../PaymentFields';
import { cn } from '../../lib/utils';
import { api } from '../../api/client';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../ui/dialog';
import toast from 'react-hot-toast';

interface MachineSaleModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: any) => void;
    selectedMachine: any;
    isLoading: boolean;
    performedBy: string;
    userBranchId?: string;
}

export const MachineSaleModal: React.FC<MachineSaleModalProps> = ({
    isOpen,
    onClose,
    onSubmit,
    selectedMachine,
    isLoading,
    performedBy,
    userBranchId
}) => {
    const [clientSearch, setClientSearch] = useState('');
    const [showClientList, setShowClientList] = useState(false);
    const [selectedClient, setSelectedClient] = useState<any>(null);
    const [saleForm, setSaleForm] = useState({
        type: 'CASH' as 'CASH' | 'INSTALLMENT',
        totalPrice: 0,
        totalPriceInput: '',
        installmentCount: 12,
        notes: ''
    });

    const [receiptStatus, setReceiptStatus] = useState<'idle' | 'checking' | 'exists' | 'clear'>('idle');

    const paymentForm = usePaymentForm();

    const handlePaymentChange = (field: keyof typeof paymentForm.data, value: any) => {
        paymentForm.updateField(field as any, value);
        if (field === 'receiptNumber') {
            setReceiptStatus('idle');
        }
    };

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

    const handleSelectClient = (client: any) => {
        setSelectedClient(client);
        setClientSearch(`${client.client_name} (${client.bkcode})`);
        setShowClientList(false);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedClient) return;
        if (receiptStatus === 'exists') return;

        const branchId = selectedMachine?.branchId || selectedClient?.branchId || userBranchId;
        if (!branchId) {
            toast.error('لا يوجد فرع محدد للعميل أو الماكينة');
            return;
        }

        onSubmit({
            type: saleForm.type,
            totalPrice: Math.round(parseFloat(String(saleForm.totalPrice)) * 100) / 100,
            installmentCount: saleForm.installmentCount,
            notes: saleForm.notes,
            customerId: selectedClient.bkcode,
            serialNumber: selectedMachine.serialNumber,
            branchId,
            paidAmount: Math.round(parseFloat(String(paymentForm.data.amount)) * 100) / 100,
            receiptNumber: paymentForm.data.receiptNumber,
            paymentMethod: paymentForm.data.paymentPlace,
            paymentPlace: paymentForm.data.paymentPlace,
            performedBy
        });
    };

    const prevTypeIsCash = () => saleForm.type === 'CASH';

    const formatCurrency = (value: number) => {
        if (!value || Number.isNaN(value)) return '';
        return value.toLocaleString('ar-EG', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    };

    const handleTotalPriceChange = (raw: string) => {
        const sanitized = raw.replace(/[^0-9.,]/g, '').replace(',', '.');
        const parsed = parseFloat(sanitized);
        const amount = Number.isFinite(parsed) ? parsed : 0;

        setSaleForm(prev => ({ ...prev, totalPrice: amount, totalPriceInput: raw }));

        if (prevTypeIsCash()) {
            paymentForm.updateField('amount', amount);
        }
    };

    const handleTotalPriceBlur = () => {
        if (!saleForm.totalPrice) {
            setSaleForm(prev => ({ ...prev, totalPriceInput: '' }));
            if (prevTypeIsCash()) paymentForm.updateField('amount', 0);
            return;
        }
        const formatted = formatCurrency(saleForm.totalPrice);
        setSaleForm(prev => ({ ...prev, totalPriceInput: formatted }));
    };

    const handleTypeChange = (type: 'CASH' | 'INSTALLMENT') => {
        setSaleForm(prev => ({ ...prev, type }));
        if (type === 'CASH' && saleForm.totalPrice > 0) {
            paymentForm.updateField('amount', saleForm.totalPrice);
        }
    };

    const handleReceiptBlur = async (value: string) => {
        const receipt = value.trim();
        if (!receipt) {
            setReceiptStatus('idle');
            return;
        }
        try {
            setReceiptStatus('checking');
            const res = await api.checkReceipt(receipt);
            if (res?.exists) {
                setReceiptStatus('exists');
                toast.error('رقم الإيصال مستخدم بالفعل');
            } else {
                setReceiptStatus('clear');
            }
        } catch (error: any) {
            setReceiptStatus('idle');
            toast.error(error?.message || 'تعذر التحقق من رقم الإيصال');
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="p-0 border-0 flex flex-col max-h-[96vh] h-auto overflow-hidden sm:max-w-3xl rounded-[2.5rem] shadow-2xl bg-white [&>button]:hidden text-right" dir="rtl">

                {/* Industrial Header Section - More Compact */}
                <div className="modal-header shrink-0 p-6 bg-gradient-to-br from-emerald-600 to-teal-700 relative overflow-hidden text-right">
                    <div className="absolute top-0 left-0 w-full h-full opacity-15 pointer-events-none">
                        <div className="absolute -top-1/2 -left-1/4 w-[150%] h-[150%] bg-white rounded-full blur-[120px] rotate-12"></div>
                        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[100%] bg-emerald-300 rounded-full blur-[90px]"></div>
                    </div>

                    <div className="modal-header-content relative z-10 text-right">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 shadow-lg text-white">
                                <ShoppingCart size={22} strokeWidth={3} />
                            </div>
                            <div className="text-right">
                                <DialogTitle className="modal-title font-black text-white leading-tight tracking-tight text-xl">تسجيل عملية بيع</DialogTitle>
                                <DialogDescription className="text-emerald-50 font-bold text-[9px] uppercase tracking-widest opacity-90 mt-0.5">تحويل ملكية الماكينة للعملاء</DialogDescription>
                            </div>
                        </div>
                    </div>

                    <button type="button" className="modal-close bg-white/10 hover:bg-white/20 text-white transition-all p-2 rounded-lg backdrop-blur-sm" onClick={onClose}>
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                    <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 bg-slate-50/30 custom-scroll">

                        {/* More Compact Machine Card */}
                        <div className="relative group">
                            <div className="relative bg-white border border-slate-100 p-5 rounded-[1.5rem] flex items-center justify-between shadow-sm overflow-hidden transition-all duration-500 hover:shadow-lg">
                                <div className="absolute right-0 top-0 w-24 h-24 bg-emerald-50/50 rounded-full blur-2xl -mr-8 -mt-8"></div>
                                <div className="flex items-center gap-6 relative z-10">
                                    <div className="w-14 h-14 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200">
                                        <Hash size={24} strokeWidth={3} className="text-white" />
                                    </div>
                                    <div className="flex flex-col text-right">
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">الماكينة المستهدفة</span>
                                        <div className="flex items-center gap-3">
                                            <span className="text-xl font-black text-slate-900 font-mono tracking-tighter">{selectedMachine?.serialNumber}</span>
                                            <div className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[9px] font-black border border-emerald-100 uppercase">متاح بالمخزن</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="hidden sm:flex flex-col items-end gap-1 relative z-10 pr-6 border-r border-slate-100">
                                    <span className="text-[9px] font-black text-slate-300 uppercase leading-none">الحالة</span>
                                    <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full">تلقائي: تم البيع</span>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Configuration Section */}
                            <div className="space-y-6">
                                {/* Compact Customer Search */}
                                <div className="space-y-2 relative group/search text-right">
                                    <label className="flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 leading-none justify-end">
                                        العميل المستفيد
                                        <User size={12} className="text-emerald-500" />
                                    </label>
                                    <div className="relative">
                                        <Search className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within/search:text-emerald-600 transition-all" strokeWidth={3} />
                                        <input
                                            placeholder="اكتب الاسم أو الكود..."
                                            value={clientSearch}
                                            onChange={(e) => {
                                                setClientSearch(e.target.value);
                                                if (selectedClient && e.target.value !== `${selectedClient.client_name} (${selectedClient.bkcode})`) {
                                                    setSelectedClient(null);
                                                }
                                                setShowClientList(true);
                                            }}
                                            onFocus={() => !selectedClient && setShowClientList(true)}
                                            className="smart-input h-14 pr-12 pl-6 text-sm font-black bg-white border-2 border-slate-100 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 placeholder:text-slate-200 transition-all duration-300"
                                        />
                                        {selectedClient && (
                                            <div className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedClient(null);
                                                        setClientSearch('');
                                                        setShowClientList(true);
                                                    }}
                                                    className="p-1.5 bg-red-50 text-red-400 hover:text-red-600 rounded-lg transition-all"
                                                >
                                                    <X size={16} strokeWidth={3} />
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {showClientList && clientSearch.length > 0 && (
                                        <div className="absolute z-[110] w-full bg-white border-2 border-slate-100 rounded-2xl shadow-xl mt-1 max-h-60 overflow-y-auto custom-scroll p-1">
                                            {isSearching ? (
                                                <div className="p-6 text-center flex flex-col items-center gap-2">
                                                    <Loader2 size={24} className="animate-spin text-emerald-500" />
                                                    <span className="font-bold text-slate-400 text-xs">جاري البحث...</span>
                                                </div>
                                            ) : filteredClients.length === 0 ? (
                                                <div className="p-6 text-center font-bold text-slate-400 text-xs">لم نعثر على هذا العميل</div>
                                            ) : (
                                                <div className="space-y-0.5">
                                                    {filteredClients.map(c => (
                                                        <button
                                                            key={c.bkcode}
                                                            type="button"
                                                            onClick={() => handleSelectClient(c)}
                                                            className="w-full group flex items-center justify-between p-3 hover:bg-emerald-50 rounded-xl transition-all text-right border border-transparent hover:border-emerald-100"
                                                        >
                                                            <div className="flex flex-col gap-0.5">
                                                                <span className="font-black text-slate-900 text-sm">{c.client_name}</span>
                                                                <div className="flex items-center gap-2">
                                                                    <Tag size={10} className="text-emerald-400" />
                                                                    <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded uppercase">{c.clienttype === 'GENERAL' ? 'عام' : (c.clienttype || 'عام')}</span>
                                                                </div>
                                                            </div>
                                                            <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                                                                <span className="text-[10px] font-black text-slate-600 font-mono">{c.bkcode}</span>
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Sale System Selector */}
                                <div className="space-y-2 text-right">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 leading-none">نظام السداد</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            type="button"
                                            onClick={() => handleTypeChange('CASH')}
                                            className={cn(
                                                "p-4 rounded-2xl border-2 flex items-center gap-3 transition-all relative overflow-hidden group",
                                                saleForm.type === 'CASH'
                                                    ? "bg-emerald-50 border-emerald-500 text-emerald-900 shadow-lg"
                                                    : "bg-white border-slate-100 text-slate-400 hover:border-slate-200"
                                            )}
                                        >
                                            <div className={cn("p-2 rounded-xl", saleForm.type === 'CASH' ? "bg-emerald-600 text-white" : "bg-slate-50 text-slate-300")}>
                                                <Wallet size={18} strokeWidth={3} />
                                            </div>
                                            <span className="font-black text-xs">نقدي (Cash)</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleTypeChange('INSTALLMENT')}
                                            className={cn(
                                                "p-4 rounded-2xl border-2 flex items-center gap-3 transition-all relative overflow-hidden group",
                                                saleForm.type === 'INSTALLMENT'
                                                    ? "bg-blue-50 border-blue-600 text-blue-900 shadow-lg"
                                                    : "bg-white border-slate-100 text-slate-400 hover:border-slate-200"
                                            )}
                                        >
                                            <div className={cn("p-2 rounded-xl", saleForm.type === 'INSTALLMENT' ? "bg-blue-600 text-white" : "bg-slate-50 text-slate-300")}>
                                                <Calendar size={18} strokeWidth={3} />
                                            </div>
                                            <span className="font-black text-xs">تقسيط شهري</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Price Field */}
                                <div className="space-y-2 text-right">
                                    <label className="flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 leading-none justify-end">
                                        القيمة النهائية
                                        <DollarSign size={12} className="text-emerald-500" />
                                    </label>
                                    <div className="relative group/price">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-300 text-xs tracking-widest">ج.م</div>
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            value={saleForm.totalPriceInput}
                                            onChange={(e) => handleTotalPriceChange(e.target.value)}
                                            onBlur={handleTotalPriceBlur}
                                            placeholder="0,000.00"
                                            className="smart-input h-14 px-6 text-2xl font-black bg-white border-2 border-slate-100 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 text-emerald-600 placeholder:text-slate-100 transition-all font-mono tracking-tighter"
                                        />
                                    </div>
                                </div>

                                {saleForm.type === 'INSTALLMENT' && (
                                    <div className="space-y-2 text-right animate-in fade-in slide-in-from-top-2 duration-300">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 leading-none">الشهور</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                value={saleForm.installmentCount}
                                                onChange={(e) => setSaleForm(prev => ({ ...prev, installmentCount: parseInt(e.target.value) || 0 }))}
                                                className="smart-input h-12 pr-6 pl-4 text-lg font-black bg-white border-2 border-slate-100 focus:ring-2 focus:ring-blue-500/10 transition-all font-mono"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Payment Logic Panel */}
                            <div className="flex flex-col bg-white p-6 rounded-[2rem] border border-slate-100 space-y-6 shadow-xl shadow-slate-200/50">
                                <h3 className="font-black text-slate-900 flex items-center gap-2 text-base justify-end">
                                    {saleForm.type === 'CASH' ? 'تسوية السداد' : 'المقدم النقدي'}
                                    <CreditCard size={18} className="text-emerald-600" />
                                </h3>

                                <div className="space-y-6">
                                    <PaymentFields
                                        data={paymentForm.data}
                                        onChange={handlePaymentChange}
                                        onReceiptBlur={handleReceiptBlur}
                                        receiptExists={receiptStatus === 'exists'}
                                        receiptChecking={receiptStatus === 'checking'}
                                    />

                                    <div className="space-y-2 text-right">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 leading-none block">ملاحظات</label>
                                        <textarea
                                            value={saleForm.notes}
                                            onChange={(e) => setSaleForm(prev => ({ ...prev, notes: e.target.value }))}
                                            className="smart-input min-h-[80px] p-4 text-xs font-bold bg-slate-50/50 border-2 border-slate-100 focus:border-emerald-500 focus:bg-white resize-none transition-all"
                                            placeholder="اكتب أي ملاحظات إضافية..."
                                        />
                                    </div>
                                </div>

                                {/* Summary Chip Compact */}
                                <div className="bg-slate-900 p-4 rounded-xl flex items-center justify-between">
                                    <div className="flex flex-col text-right">
                                        <span className="text-[8px] font-black text-slate-500 uppercase">إجمالي المعاملة</span>
                                        <span className="text-xl font-black text-white font-mono">{saleForm.totalPriceInput || '0.00'}</span>
                                    </div>
                                    <Receipt size={20} className="text-emerald-500" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Compact Footer */}
                    <div className="modal-footer p-6 bg-white border-t border-slate-100 shrink-0 flex items-center gap-4 justify-between">
                        <button
                            type="button"
                            onClick={onClose}
                            className="smart-btn-secondary h-14 px-8 border-2 border-slate-100 text-slate-500 font-black text-sm transition-all hover:bg-slate-50"
                        >
                            إلغاء
                        </button>

                        <button
                            type="submit"
                            disabled={isLoading || !selectedClient || !paymentForm.isValid || receiptStatus === 'exists'}
                            className={cn(
                                "smart-btn-primary flex-1 h-14 transition-all font-black text-base flex items-center justify-center gap-3",
                                (selectedClient && paymentForm.isValid && receiptStatus !== 'exists')
                                    ? "bg-slate-900 hover:bg-slate-800 text-white shadow-lg"
                                    : "bg-slate-100 text-slate-300 cursor-not-allowed pointer-events-none grayscale"
                            )}
                        >
                            {isLoading ? <Loader2 size={20} className="animate-spin" /> : <TrendingUp size={20} />}
                            تأكيد وإتمام البيع
                        </button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
};
