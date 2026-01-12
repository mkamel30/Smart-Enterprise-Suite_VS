import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShoppingCart, Search, DollarSign, Wallet, Calendar, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useQuery } from '@tanstack/react-query';

import { PaymentFields, usePaymentForm } from '../PaymentFields';
import { cn } from '../../lib/utils';
import { api } from '../../api/client';
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

    // Live search for customers using server-side filtering
    const [debouncedSearch, setDebouncedSearch] = useState('');

    useEffect(() => {
        const timer = setTimeout(() => {
            console.log('🔍 LIVE SEARCH ACTIVE - Searching for:', clientSearch);
            setDebouncedSearch(clientSearch);
        }, 300); // 300ms debounce

        return () => clearTimeout(timer);
    }, [clientSearch]);

    const { data: searchResults, isLoading: isSearching } = useQuery({
        queryKey: ['customer-search', debouncedSearch],
        queryFn: () => {
            console.log('🌐 API Call - Searching for:', debouncedSearch);
            return api.getCustomersLite(debouncedSearch);
        },
        enabled: debouncedSearch.length > 0 && !selectedClient,
        staleTime: 30000 // Cache for 30 seconds
    });

    console.log('📊 Search Results:', searchResults ? searchResults.length : 0, 'results for:', debouncedSearch);

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
            totalPrice: Math.round((parseFloat(String(saleForm.totalPrice)) + Number.EPSILON) * 100) / 100,
            installmentCount: saleForm.installmentCount,
            notes: saleForm.notes,
            customerId: selectedClient.bkcode,
            serialNumber: selectedMachine.serialNumber,
            branchId,
            paidAmount: Math.round((parseFloat(String(paymentForm.data.amount)) + Number.EPSILON) * 100) / 100,
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

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200"
                    dir="rtl"
                >
                    <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-100 bg-slate-50/50 shrink-0">
                        <div className="flex flex-col">
                            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <ShoppingCart className="text-emerald-600" size={24} />
                                بيع ماكينة للعميل
                            </h2>
                            <p className="text-sm text-slate-500 mt-1">
                                الماكينة: <span className="font-mono font-bold text-blue-600">{selectedMachine?.serialNumber}</span> ({selectedMachine?.model})
                            </p>
                        </div>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                            <X size={24} />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                        <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scroll">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Right Side: Client & Sale Type */}
                                <div className="space-y-6">
                                    <div className="space-y-2 relative">
                                        <Label>العميل</Label>
                                        <div className="relative group">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-emerald-600 transition-colors" />
                                            <Input
                                                placeholder="البحث باسم العميل أو الكود..."
                                                value={clientSearch}
                                                onChange={(e) => {
                                                    const newValue = e.target.value;
                                                    setClientSearch(newValue);
                                                    // Only clear selection if user is actually editing
                                                    if (selectedClient && newValue !== `${selectedClient.client_name} (${selectedClient.bkcode})`) {
                                                        setSelectedClient(null);
                                                    }
                                                    setShowClientList(true);
                                                }}
                                                onFocus={() => {
                                                    // Only show list if no client is selected
                                                    if (!selectedClient) {
                                                        setShowClientList(true);
                                                    }
                                                }}
                                                className="pl-10 rounded-xl"
                                            />
                                            {selectedClient && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedClient(null);
                                                        setClientSearch('');
                                                        setShowClientList(true);
                                                    }}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                                >
                                                    <X size={16} />
                                                </button>
                                            )}
                                        </div>
                                        <AnimatePresence>
                                            {showClientList && clientSearch.length > 0 && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: -10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: -10 }}
                                                    className="absolute z-10 w-full bg-white border border-slate-200 rounded-xl shadow-xl mt-1 max-h-48 overflow-y-auto"
                                                >
                                                    {isSearching ? (
                                                        <div className="p-4 text-center text-slate-500 flex items-center justify-center gap-2">
                                                            <Loader2 size={16} className="animate-spin" />
                                                            جاري البحث...
                                                        </div>
                                                    ) : filteredClients.length === 0 ? (
                                                        <div className="p-4 text-center text-slate-500">
                                                            لا توجد نتائج
                                                        </div>
                                                    ) : (
                                                        filteredClients.map(c => (
                                                            <button
                                                                key={c.bkcode}
                                                                type="button"
                                                                onClick={() => handleSelectClient(c)}
                                                                className="w-full text-right p-3 hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors"
                                                            >
                                                                <div className="font-bold text-slate-800">{c.client_name}</div>
                                                                <div className="text-xs text-slate-500">{c.bkcode}</div>
                                                            </button>
                                                        ))
                                                    )}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>نظام البيع</Label>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                type="button"
                                                onClick={() => handleTypeChange('CASH')}
                                                className={cn(
                                                    "p-4 rounded-xl border flex flex-col items-center gap-2 transition-all",
                                                    saleForm.type === 'CASH' ? "bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                                                )}
                                            >
                                                <Wallet size={20} />
                                                <span className="font-bold">كاش (نقدي)</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleTypeChange('INSTALLMENT')}
                                                className={cn(
                                                    "p-4 rounded-xl border flex flex-col items-center gap-2 transition-all",
                                                    saleForm.type === 'INSTALLMENT' ? "bg-blue-50 border-blue-500 text-blue-700 shadow-sm" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                                                )}
                                            >
                                                <Calendar size={20} />
                                                <span className="font-bold">قسط</span>
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>إجمالي سعر البيع</Label>
                                        <div className="relative">
                                            <div className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 text-sm">ج.م</div>
                                            <Input
                                                type="text"
                                                inputMode="decimal"
                                                value={saleForm.totalPriceInput}
                                                onChange={(e) => handleTotalPriceChange(e.target.value)}
                                                onBlur={handleTotalPriceBlur}
                                                placeholder="0.00"
                                                className="pl-10 rounded-xl text-lg font-bold"
                                            />
                                        </div>
                                    </div>

                                    {saleForm.type === 'INSTALLMENT' && (
                                        <div className="space-y-2">
                                            <Label>عدد الشهور (الأقساط)</Label>
                                            <Input
                                                type="number"
                                                value={saleForm.installmentCount}
                                                onChange={(e) => setSaleForm(prev => ({ ...prev, installmentCount: parseInt(e.target.value) || 0 }))}
                                                className="rounded-xl"
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Left Side: Payment Details */}
                                <div className="bg-slate-50 p-4 sm:p-6 rounded-2xl border border-slate-200 space-y-4">
                                    <h3 className="font-bold text-slate-700 flex items-center gap-2 border-b border-slate-200 pb-2 mb-4">
                                        <DollarSign size={18} className="text-emerald-600" />
                                        {saleForm.type === 'CASH' ? 'بيانات السداد' : 'بيانات المقدم'}
                                    </h3>
                                    <PaymentFields
                                        data={paymentForm.data}
                                        onChange={handlePaymentChange}
                                        onReceiptBlur={handleReceiptBlur}
                                        receiptExists={receiptStatus === 'exists'}
                                        receiptChecking={receiptStatus === 'checking'}
                                    />

                                    <div className="pt-4 space-y-2">
                                        <Label>ملاحظات البيع</Label>
                                        <textarea
                                            value={saleForm.notes}
                                            onChange={(e) => setSaleForm(prev => ({ ...prev, notes: e.target.value }))}
                                            className="w-full border border-slate-200 rounded-xl p-3 h-24 focus:ring-emerald-500/20 outline-none resize-none"
                                            placeholder="..."
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 sm:p-6 border-t bg-slate-50/50 shrink-0 flex gap-3">
                            <Button
                                type="submit"
                                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-6 font-bold shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
                                disabled={isLoading || !selectedClient || !paymentForm.isValid || receiptStatus === 'exists'}
                            >
                                {isLoading ? 'جاري التنفيذ...' : 'إتمام عملية البيع'}
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={onClose}
                                className="rounded-xl py-6 border-slate-200 hover:bg-slate-50"
                            >
                                إلغاء
                            </Button>
                        </div>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
