import { useState, useMemo, useEffect } from 'react';
import { Search } from 'lucide-react';
import { api } from '../api/client';
import { PaymentFields, usePaymentForm } from './PaymentFields';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';

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

    // Get machine model from request
    const machineModel = request.posMachine?.model || '';

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
            if (!paymentForm.data.receiptNumber) {
                setReceiptError(null);
                return;
            }
            try {
                const { exists } = await api.checkReceipt(paymentForm.data.receiptNumber);
                if (exists) setReceiptError('رقم الإيصال مسجل من قبل!');
                else setReceiptError(null);
            } catch (e) {
                console.error(e);
            }
        }, 500);
        return () => clearTimeout(timeout);
    }, [paymentForm.data.receiptNumber]);

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
        if (totals.totalCost > 0 && !paymentForm.data.receiptNumber) {
            setFormError('يرجى إدخال رقم الإيصال للمبلغ المدفوع');
            return;
        }

        const data = {
            actionTaken,
            receiptNumber: paymentForm.data.receiptNumber,
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
            <DialogContent className="p-0 border-0 [&>button]:hidden flex flex-col max-h-[90vh] h-auto overflow-hidden sm:max-w-2xl bg-white rounded-2xl shadow-2xl" dir="rtl">
                <DialogHeader className="bg-gradient-to-r from-[#0A2472] to-[#0A2472]/90 text-white p-6 pb-4 shrink-0">
                    <DialogTitle className="text-2xl font-black">إغلاق الطلب</DialogTitle>
                    <DialogDescription className="text-[#6CE4F0]/90">
                        إضافة الإجراء المتخذ والقطع المستخدمة
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 bg-gradient-to-br from-slate-50 to-blue-50/30">
                    {/* Header Info */}
                    <div className="bg-white border-2 border-[#0A2472]/10 p-5 rounded-xl shadow-sm space-y-3" dir="rtl">
                        <div className="flex flex-row-reverse items-center gap-3">
                            <span className="font-black text-[#0A2472] flex-1">{request.customer?.client_name}</span>
                            <span className="text-sm text-slate-600 whitespace-nowrap font-bold">العميل:</span>
                        </div>
                        <div className="flex flex-row-reverse items-center gap-3">
                            <span className="font-mono font-bold text-[#0A2472] flex-1">{request.posMachine?.serialNumber}</span>
                            <span className="text-sm text-slate-600 whitespace-nowrap font-bold">الماكينة:</span>
                        </div>
                        <div className="flex flex-row-reverse items-center gap-3">
                            <span className="font-bold text-slate-700 flex-1">{machineModel || 'غير محدد'}</span>
                            <span className="text-sm text-slate-600 whitespace-nowrap font-bold">الموديل:</span>
                        </div>
                        <div className="pt-3 mt-3 border-t border-[#0A2472]/10">
                            <div className="flex flex-row-reverse items-start gap-3">
                                <p className="text-sm text-slate-600 flex-1">{request.complaint}</p>
                                <span className="text-sm font-black text-[#0A2472] whitespace-nowrap">الشكوى:</span>
                            </div>
                        </div>
                    </div>

                    {/* Action Taken */}
                    <div dir="rtl">
                        <label className="block text-sm font-black text-[#0A2472] mb-2 text-right">الإجراء المتخذ</label>
                        <textarea
                            value={actionTaken}
                            onChange={(e) => setActionTaken(e.target.value)}
                            className="w-full border-2 border-[#0A2472]/10 rounded-xl px-4 py-3 bg-white focus:ring-2 focus:ring-[#0A2472]/20 focus:border-[#0A2472]/30 outline-none resize-none font-medium text-slate-700 text-right"
                            rows={2}
                            placeholder="وصف الإجراء المتخذ..."
                            dir="rtl"
                        />
                    </div>

                    {/* Spare Parts Selection */}
                    <div>
                        <label className="block text-sm font-black text-[#0A2472] mb-2">قطع الغيار المستخدمة</label>

                        {/* Search Box */}
                        <div className="relative mb-3">
                            <Search size={18} className="absolute right-3 top-3 text-[#0A2472]/40" />
                            <input
                                type="text"
                                placeholder="بحث عن قطعة..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full border-2 border-[#0A2472]/10 rounded-xl pr-10 pl-4 py-2.5 bg-white focus:ring-2 focus:ring-[#0A2472]/20 focus:border-[#0A2472]/30 outline-none font-medium text-slate-700"
                            />
                        </div>

                        {/* Parts List */}
                        <div className="border-2 border-[#0A2472]/10 rounded-xl max-h-48 overflow-y-auto bg-white shadow-sm">
                            {filteredParts.length === 0 ? (
                                <p className="p-8 text-center text-slate-500 font-medium">لا توجد قطع متوافقة</p>
                            ) : (
                                filteredParts.map((part: any) => {
                                    const selected = selectedParts.find(p => p.partId === part.id);
                                    return (
                                        <div key={part.id} className={`p-3 border-b border-[#0A2472]/5 last:border-0 hover:bg-[#0A2472]/3 transition-colors ${selected ? 'bg-[#0A2472]/5' : ''}`}>
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="checkbox"
                                                    checked={!!selected}
                                                    onChange={() => togglePart(part)}
                                                    className="w-4 h-4 rounded border-[#0A2472]/20 text-[#0A2472] focus:ring-[#0A2472] accent-[#0A2472]"
                                                />
                                                <div className="flex-1">
                                                    <span className="font-bold text-sm text-[#0A2472]">{part.name}</span>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-slate-500 text-xs">{part.defaultCost} ج.م</span>
                                                        <span className="bg-[#0A2472]/10 text-[#0A2472] px-2 py-0.5 rounded-lg text-[10px] font-bold">المتاح: {part.quantity}</span>
                                                    </div>
                                                </div>

                                                {selected && (
                                                    <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2">
                                                        {/* Quantity Selector for multi-parts */}
                                                        {part.allowsMultiple && (
                                                            <div className="flex items-center bg-white rounded-lg p-0.5 border-2 border-[#0A2472]/10 shadow-sm">
                                                                <button
                                                                    onClick={() => updatePart(part.id, { quantity: Math.max(1, selected.quantity - 1) })}
                                                                    className="w-7 h-7 flex items-center justify-center hover:bg-[#0A2472]/10 text-[#0A2472] rounded disabled:opacity-50 font-bold"
                                                                >-</button>
                                                                <span className="w-8 text-center font-bold text-sm text-[#0A2472]">{selected.quantity}</span>
                                                                <button
                                                                    onClick={() => updatePart(part.id, { quantity: selected.quantity + 1 })}
                                                                    className="w-7 h-7 flex items-center justify-center bg-[#0A2472] text-white rounded shadow-sm hover:bg-[#0A2472]/90 font-bold"
                                                                >+</button>
                                                            </div>
                                                        )}

                                                        {/* Paid/Free Toggle */}
                                                        <div className="relative">
                                                            <select
                                                                value={selected.isPaid ? 'paid' : 'free'}
                                                                onChange={(e) => updatePart(part.id, { isPaid: e.target.value === 'paid' })}
                                                                className={`appearance-none border-2 rounded-lg h-8 pl-3 pr-7 text-xs font-bold transition-colors cursor-pointer outline-none focus:ring-2 focus:ring-offset-1 ${selected.isPaid
                                                                    ? 'bg-red-50 text-red-700 border-red-200 focus:ring-red-200'
                                                                    : 'bg-green-50 text-green-700 border-green-200 focus:ring-green-200'
                                                                    }`}
                                                            >
                                                                <option value="free">بدون مقابل</option>
                                                                <option value="paid">بمقابل</option>
                                                            </select>
                                                            <div className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
                                                                <svg width="8" height="8" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                                    <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                                </svg>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Selected Parts Summary */}
                    {selectedParts.length > 0 && (
                        <div className="bg-white border-2 border-[#0A2472]/10 rounded-xl p-4" dir="rtl">
                            <h4 className="font-bold text-sm mb-3 text-right">ملخص القطع المختارة</h4>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div className="bg-[#80C646]/10 p-3 rounded-lg border border-[#80C646]/20 text-center">
                                    <div className="text-xs text-[#80C646] mb-1 font-bold">بدون مقابل</div>
                                    <div className="font-black text-[#80C646]">{totals.totalFreeCount} قطعة</div>
                                </div>
                                <div className="bg-red-50 p-3 rounded-lg border border-red-200 text-center">
                                    <div className="text-xs text-red-600 mb-1 font-bold">بمقابل</div>
                                    <div className="font-black text-red-700">{totals.totalPaidCount} قطعة</div>
                                </div>
                                <div className="col-span-2 bg-[#80C646]/10 p-3 rounded-lg border border-[#80C646]/20 text-center">
                                    <div className="text-xs text-[#80C646] mb-1 font-bold">الإجمالي المدفوع</div>
                                    <div className="text-xl font-black text-[#80C646]">{totals.totalCost} ج.م</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Payment Fields */}
                    {totals.totalCost > 0 && (
                        <div className="bg-white border-2 border-[#0A2472]/10 p-4 rounded-xl" dir="rtl">
                            <h4 className="font-bold text-sm mb-3 text-[#0A2472] text-right">بيانات التوريد</h4>
                            <PaymentFields
                                data={paymentForm.data}
                                onChange={paymentForm.updateField}
                                amountReadOnly={true}
                            />
                            {receiptError && (
                                <div className="mt-3 text-red-600 text-xs bg-red-50 p-3 rounded-lg border border-red-100 flex flex-row-reverse items-center gap-2 font-bold animate-in slide-in-from-top-1">
                                    <span>⚠️</span> {receiptError}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Error Message */}
                    {formError && (
                        <div className="bg-red-50 border-2 border-red-200 text-red-700 px-4 py-3 rounded-xl flex flex-row-reverse items-center gap-2 animate-in slide-in-from-top-1" dir="rtl">
                            <span className="font-bold text-lg">!</span>
                            <span className="font-medium text-sm">{formError}</span>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-[#0A2472]/10 bg-white shrink-0 flex flex-row-reverse gap-3" dir="rtl">
                    <Button 
                        variant="outline" 
                        onClick={onClose} 
                        className="flex-1 h-11 font-bold border-2 border-[#0A2472]/20 text-[#0A2472] hover:bg-[#0A2472]/5 hover:border-[#0A2472]/30 transition-colors"
                    >
                        إغلاق
                    </Button>
                    <Button 
                        onClick={handleSubmit} 
                        className="flex-[2] h-11 bg-gradient-to-r from-[#80C646] to-[#6DB840] hover:from-[#6DB840] hover:to-[#5CA630] text-white font-bold shadow-md hover:shadow-lg transition-all"
                    >
                        إغلاق الطلب وحفظ
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
