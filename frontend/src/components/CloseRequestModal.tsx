import { useState, useMemo, useEffect } from 'react';
import { Search, X, Package, ClipboardList, PenTool, CheckCircle2 } from 'lucide-react';
import { api } from '../api/client';
import { PaymentFields, usePaymentForm } from './PaymentFields';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';

interface SelectedPart {
    partId: string;
    name: string;
    quantity: number;
    isPaid: boolean;
    cost: number;
    allowsMultiple: boolean;
}

interface CloseRequestModalProps {
    request: any;
    spareParts: any[];
    onClose: () => void;
    onSubmit: (data: any) => void;
}

export function CloseRequestModal({ request, spareParts, onClose, onSubmit }: CloseRequestModalProps) {
    const [actionTaken, setActionTaken] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedParts, setSelectedParts] = useState<SelectedPart[]>([]);

    // Payment Form
    const paymentForm = usePaymentForm();
    const [receiptError, setReceiptError] = useState<string | null>(null);

    // ESC key handler
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    // Get machine display info with robust fallbacks
    const machineModel = request.machineModel || request.posMachine?.model || request.model || 'POS TERMINAL';
    const serialNumber = request.serialNumber || request.posMachine?.serialNumber || request.machineSerial || request.serial || 'N/A';

    // Filter parts by model compatibility and stock level
    const compatibleParts = useMemo(() => {
        if (!spareParts) return [];
        return spareParts.filter((part: any) => {
            // Requirement: Only show parts with quantity > 0
            if ((part.quantity || 0) <= 0) return false;

            if (!part.compatibleModels) return true; // Show all if no model specified
            const models = part.compatibleModels.toLowerCase().split(';').map((m: string) => m.trim());
            return models.some((m: string) => machineModel.toLowerCase().includes(m) || m.includes(machineModel.toLowerCase()));
        });
    }, [spareParts, machineModel]);

    // Filter by search query
    const filteredParts = useMemo(() => {
        if (!searchQuery) return compatibleParts;
        return compatibleParts.filter((part: any) =>
            part.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [compatibleParts, searchQuery]);

    // Calculate totals
    const totals = useMemo(() => {
        const paidParts = selectedParts.filter(p => p.isPaid);
        const freeParts = selectedParts.filter(p => !p.isPaid);
        const totalCost = paidParts.reduce((sum, p) => sum + (p.cost * p.quantity), 0);
        const totalPaidCount = paidParts.reduce((sum, p) => sum + p.quantity, 0);
        const totalFreeCount = freeParts.reduce((sum, p) => sum + p.quantity, 0);
        return { totalCost, totalPaidCount, totalFreeCount, totalCount: totalPaidCount + totalFreeCount };
    }, [selectedParts]);

    // Sync total cost with payment form
    useEffect(() => {
        paymentForm.setData(prev => ({ ...prev, amount: totals.totalCost }));
    }, [totals.totalCost]);

    // Validate Receipt
    useEffect(() => {
        const timeout = setTimeout(async () => {
            if (!paymentForm.data?.receiptNumber) {
                setReceiptError(null);
                return;
            }
            try {
                const { exists } = await api.checkReceipt(paymentForm.data?.receiptNumber);
                if (exists) setReceiptError('رقم الإيصال مسجل من قبل!');
                else setReceiptError(null);
            } catch (e) {
                console.error(e);
            }
        }, 500);
        return () => clearTimeout(timeout);
    }, [paymentForm.data?.receiptNumber]);

    const [formError, setFormError] = useState<string | null>(null);

    const togglePart = (part: any) => {
        const exists = selectedParts.find(p => p.partId === part.id);
        if (exists) {
            setSelectedParts(selectedParts.filter(p => p.partId !== part.id));
        } else {
            setSelectedParts([...selectedParts, {
                partId: part.id,
                name: part.name,
                quantity: 1,
                isPaid: true, // Default to Paid as requested
                cost: part.defaultCost || 0,
                allowsMultiple: part.allowsMultiple || false
            }]);
        }
    };

    const updatePart = (partId: string, updates: Partial<SelectedPart>) => {
        setSelectedParts(selectedParts.map(p =>
            p.partId === partId ? { ...p, ...updates } : p
        ));
    };

    const handleSubmit = () => {
        setFormError(null);

        if (receiptError) {
            setFormError('يرجى تصحيح رقم الإيصال الموجود');
            return;
        }
        if (totals.totalCost > 0 && !paymentForm.data?.receiptNumber) {
            setFormError('يرجى إدخال رقم الإيصال للمبلغ المدفوع');
            return;
        }

        const data = {
            actionTaken,
            receiptNumber: paymentForm.data?.receiptNumber,
            usedParts: selectedParts.map(p => ({
                partId: p.partId,
                name: p.name,
                quantity: p.quantity,
                isPaid: p.isPaid,
                cost: p.cost // Send unit price, backend calculates total
            })),
            totalCost: totals.totalCost,
            paymentPlace: paymentForm.data.paymentPlace
        };
        onSubmit(data);
    };

    return (
        <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="p-0 border-0 flex flex-col max-h-[90vh] h-auto overflow-hidden sm:max-w-xl rounded-2xl shadow-2xl bg-slate-50 [&>button]:hidden" dir="rtl">

                {/* Modal Header */}
                <div className="modal-header shrink-0 p-4 md:p-5 pb-3 bg-white border-b flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 rounded-lg border border-indigo-100 text-indigo-600">
                            <PenTool size={16} strokeWidth={2.5} />
                        </div>
                        <div>
                            <DialogTitle className="modal-title text-base font-black text-slate-900 leading-tight">إغلاق وتوريد الطلب</DialogTitle>
                            <DialogDescription className="text-slate-500 font-bold text-[9px] mt-0.5 opacity-80">تسجيل التقرير النهائي وتكلفة قطع الغيار</DialogDescription>
                        </div>
                    </div>
                    <button type="button" className="p-1.5 bg-slate-100 text-slate-400 hover:bg-rose-50 hover:text-rose-500 rounded-lg transition-all" onClick={onClose}>
                        <X size={14} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-4 md:px-5 py-3 pb-6 space-y-4 custom-scroll">

                    {/* Machine & Customer Info Card */}
                    <div className="bg-gradient-to-br from-indigo-900 to-slate-800 p-4 rounded-xl shadow-lg relative overflow-hidden group border border-indigo-800/20">
                        {/* Decorative background elements */}
                        <div className="absolute -top-10 -left-10 w-40 h-40 bg-indigo-600/20 rounded-full blur-3xl group-hover:bg-indigo-600/30 transition-all duration-700"></div>
                        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-indigo-400/10 rounded-full blur-3xl group-hover:bg-indigo-400/20 transition-all duration-700"></div>

                        <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <p className="text-[8px] font-black text-indigo-300 uppercase tracking-widest mb-1 opacity-70">العميل</p>
                                <div className="flex flex-col gap-1">
                                    <h3 className="text-white font-black text-base leading-tight">{request.customer?.client_name}</h3>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-indigo-200/70 font-mono text-[10px] font-bold px-1 py-0.5 bg-white/5 rounded border border-white/10">{request.customer?.bkcode}</span>
                                        {request.customer?.clienttype && (
                                            <span className="px-2 py-0.5 bg-indigo-500/30 border border-indigo-400/30 rounded text-[8px] font-black text-indigo-100 uppercase tracking-wider">
                                                {request.customer.clienttype}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-1 md:text-left md:border-r md:border-white/10 md:pr-4">
                                <p className="text-[8px] font-black text-indigo-300 uppercase tracking-widest mb-1 opacity-70">الماكينة</p>
                                <div className="flex flex-col md:items-end gap-1">
                                    <div className="flex items-center gap-2">
                                        <Package size={14} className="text-indigo-400" />
                                        <span className="text-white font-mono font-black text-lg tracking-tighter">
                                            {serialNumber}
                                        </span>
                                    </div>
                                    <span className="text-[9px] font-bold py-0.5 px-1.5 bg-white/10 text-white rounded border border-white/10 uppercase tracking-widest">
                                        {machineModel}
                                    </span>
                                </div>
                            </div>
                            <div className="col-span-1 md:col-span-2 pt-3 mt-3 border-t border-white/10 flex gap-2.5">
                                <div className="p-1.5 bg-white/10 rounded-lg">
                                    <ClipboardList size={14} className="text-indigo-300" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-[8px] font-black text-indigo-300 mb-0.5 opacity-70 uppercase">الشكوى</p>
                                    <p className="text-indigo-50 text-[11px] font-medium italic leading-relaxed">"{request.complaint}"</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Action Taken Section */}
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-slate-800 font-black text-xs pr-1">
                            <PenTool size={14} className="text-indigo-600" />
                            الإجراء الذي تم اتخاذه
                        </label>
                        <textarea
                            value={actionTaken}
                            onChange={(e) => setActionTaken(e.target.value)}
                            className="smart-input min-h-[60px] p-3 text-[11px] font-bold bg-white border-slate-200 focus:border-indigo-400 rounded-xl"
                            placeholder="صف ما تم عمله لإصلاح الماكينة..."
                        />
                    </div>

                    {/* Spare Parts Section */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between px-1">
                            <label className="flex items-center gap-2 text-slate-800 font-black text-xs">
                                <Package size={14} className="text-indigo-600" />
                                قطع الغيار المستهلكة
                            </label>
                            <span className="text-[8px] font-black bg-slate-200 text-slate-600 px-2 py-0.5 rounded-lg">
                                {compatibleParts.length} قطعة
                            </span>
                        </div>

                        {/* Search & List */}
                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                            <div className="p-2 border-b border-slate-100 bg-slate-50/50">
                                <div className="relative group">
                                    <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                                    <input
                                        type="text"
                                        placeholder="بحث عن قطعة..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full bg-white border-slate-200 focus:border-indigo-400 rounded-lg pr-9 pl-4 h-9 text-xs font-bold outline-none transition-all placeholder:text-slate-400"
                                    />
                                </div>
                            </div>

                            <div className="max-h-48 overflow-y-auto custom-scroll divide-y divide-slate-50">
                                {filteredParts.length === 0 ? (
                                    <div className="p-6 text-center flex flex-col items-center gap-2">
                                        <Search size={24} className="text-slate-200" />
                                        <p className="text-slate-400 font-black text-[10px]">لا توجد قطع متوفرة</p>
                                    </div>
                                ) : (
                                    filteredParts.map((part: any) => {
                                        const selected = selectedParts.find(p => p.partId === part.id);
                                        return (
                                            <div
                                                key={part.id}
                                                className={`p-2.5 hover:bg-indigo-50/30 transition-all cursor-pointer flex items-center gap-3 ${selected ? 'bg-indigo-50/50' : ''}`}
                                                onClick={() => togglePart(part)}
                                            >
                                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${selected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-200'}`}>
                                                    {selected && <CheckCircle2 size={12} className="text-white" />}
                                                </div>

                                                <div className="flex-1">
                                                    <h5 className="font-black text-xs text-slate-800">{part.name}</h5>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                                                            {part.defaultCost} ج.م
                                                        </span>
                                                        <span className="text-[8px] font-bold text-slate-400 flex items-center gap-1">
                                                            <Package size={8} />
                                                            {part.quantity} متاح
                                                        </span>
                                                    </div>
                                                </div>

                                                {selected && (
                                                    <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left-2 duration-300" onClick={e => e.stopPropagation()}>
                                                        {/* Quantity for multi-parts */}
                                                        {part.allowsMultiple && (
                                                            <div className="flex items-center bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden p-0.5">
                                                                <button
                                                                    onClick={() => updatePart(part.id, { quantity: Math.max(1, selected.quantity - 1) })}
                                                                    className="w-6 h-6 flex items-center justify-center hover:bg-slate-50 text-slate-600 font-black text-xs"
                                                                >-</button>
                                                                <span className="w-5 text-center text-[10px] font-black text-slate-800">{selected.quantity}</span>
                                                                <button
                                                                    onClick={() => updatePart(part.id, { quantity: selected.quantity + 1 })}
                                                                    className="w-6 h-6 flex items-center justify-center bg-indigo-600 text-white rounded font-black text-xs"
                                                                >+</button>
                                                            </div>
                                                        )}

                                                        <div className="relative group/sel min-w-[80px]">
                                                            <select
                                                                value={selected.isPaid ? 'paid' : 'free'}
                                                                onChange={(e) => updatePart(part.id, { isPaid: e.target.value === 'paid' })}
                                                                className={`w-full appearance-none h-7 px-2.5 rounded-lg text-[9px] font-black outline-none border transition-all cursor-pointer ${selected.isPaid
                                                                    ? 'bg-rose-50 text-rose-700 border-rose-100'
                                                                    : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                                                    }`}
                                                            >
                                                                <option value="free">مجاني</option>
                                                                <option value="paid">مدفوع</option>
                                                            </select>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Cost Summary Card */}
                    {selectedParts.length > 0 && (
                        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-1 h-full bg-emerald-500"></div>
                            <h4 className="font-black text-slate-800 text-[11px] mb-3">ملخص تكلفة القطع</h4>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-emerald-50/50 border border-emerald-100 p-3 rounded-lg text-center">
                                    <p className="text-[8px] font-black text-emerald-600 uppercase mb-0.5">قطع مجانية</p>
                                    <div className="text-base font-black text-emerald-800">{totals.totalFreeCount} ق</div>
                                </div>
                                <div className="bg-rose-50/50 border border-rose-100 p-3 rounded-lg text-center">
                                    <p className="text-[8px] font-black text-rose-600 uppercase mb-0.5">قطع مدفوعة</p>
                                    <div className="text-base font-black text-rose-800">{totals.totalPaidCount} ق</div>
                                </div>
                                <div className="col-span-2 bg-indigo-600 p-4 rounded-xl shadow-lg shadow-indigo-100 flex justify-between items-center">
                                    <div className="text-indigo-100 font-bold text-xs">الإجمالي المطلوب توريده:</div>
                                    <div className="text-xl font-black text-white">{totals.totalCost} <span className="text-[10px]">ج.م</span></div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Payment Form Section */}
                    {totals.totalCost > 0 && (
                        <div className="bg-white rounded-xl border border-slate-200 p-4 md:p-5 shadow-sm space-y-4">
                            <div className="flex items-center gap-2 pb-2 border-b border-slate-50">
                                <CheckCircle2 size={16} className="text-indigo-600" />
                                <h4 className="font-black text-slate-800 text-xs italic">بيانات توريد النقدية</h4>
                            </div>

                            <PaymentFields
                                data={paymentForm.data}
                                onChange={paymentForm.updateField}
                                amountReadOnly={true}
                            />

                            {receiptError && (
                                <div className="bg-rose-50 border border-rose-100 text-rose-700 p-3 rounded-xl flex items-center gap-2">
                                    <X className="w-4 h-4" />
                                    <span className="font-black text-xs">{receiptError}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Final Error Message */}
                    {formError && (
                        <div className="bg-amber-50 border border-amber-200 text-amber-700 p-4 rounded-2xl text-center font-black text-sm animate-bounce">
                            ⚠️ {formError}
                        </div>
                    )}
                </div>

                {/* Modal Footer */}
                <div className="modal-footer p-4 bg-white border-t border-slate-100 flex items-center gap-2.5">
                    <button
                        onClick={onClose}
                        className="h-9 px-5 border border-slate-200 text-slate-500 font-bold text-xs rounded-lg hover:bg-slate-50 transition-all"
                    >
                        إلغاء
                    </button>
                    <button
                        onClick={handleSubmit}
                        className="h-9 flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black shadow-lg shadow-emerald-100/50"
                    >
                        تأكيد التقرير وإغلاق الطلب
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

