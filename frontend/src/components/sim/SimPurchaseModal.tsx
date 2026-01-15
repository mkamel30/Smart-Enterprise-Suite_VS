import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { Search, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';

const PAYMENT_PLACES = ['ضامن', 'بنك', 'البريد'];

interface SimPurchaseModalProps {
    isOpen: boolean;
    onClose: () => void;
    customer: any;
    onSuccess: () => void;
}

export function SimPurchaseModal({ isOpen, onClose, customer, onSuccess }: SimPurchaseModalProps) {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSim, setSelectedSim] = useState<any>(null);
    const [cost, setCost] = useState('');
    const [receiptNumber, setReceiptNumber] = useState('');
    const [paymentPlace, setPaymentPlace] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [receiptError, setReceiptError] = useState('');

    // Get warehouse SIMs (ACTIVE only)
    const { data: warehouseSims } = useQuery({
        queryKey: ['warehouse-sims'],
        queryFn: () => api.getWarehouseSims(),
        enabled: isOpen
    });

    const activeSims = warehouseSims?.filter((s: any) => s.status === 'ACTIVE') || [];
    const filteredSims = activeSims.filter((s: any) =>
        s.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.type?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Check receipt number duplicate using API
    const checkReceiptNumber = async (value: string) => {
        if (!value.trim()) {
            setReceiptError('');
            return;
        }
        try {
            const res = await api.checkReceipt(value);
            setReceiptError(res.exists ? 'رقم الإيصال مستخدم من قبل' : '');
        } catch {
            setReceiptError('');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSim) {
            toast.error('اختر شريحة من المخزن');
            return;
        }

        setIsSubmitting(true);
        try {
            await api.assignSimToCustomer({
                customerId: customer.bkcode,
                simId: selectedSim.id,
                cost: cost ? parseFloat(cost) : undefined,
                receiptNumber: receiptNumber || undefined,
                paymentPlace: paymentPlace || undefined,
                performedBy: user?.displayName
            });

            toast.success('تم إضافة الشريحة للعميل بنجاح');
            queryClient.invalidateQueries({ queryKey: ['customers'] });
            queryClient.invalidateQueries({ queryKey: ['warehouse-sims'] });
            onSuccess();
            onClose();
        } catch (error: any) {
            toast.error(error.message || 'فشل إضافة الشريحة');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="p-0 border-0 [&>button]:hidden flex flex-col max-h-[95vh] sm:max-h-[90vh] h-auto overflow-hidden sm:max-w-lg" dir="rtl">
                <DialogHeader className="bg-purple-50 p-6 pb-4 border-b shrink-0">
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <Plus className="text-purple-600" />
                        إضافة شريحة جديدة
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto px-6 py-4">
                    <form id="sim-purchase-form" onSubmit={handleSubmit} className="space-y-5">
                        {/* Customer Info */}
                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                            <div className="text-sm font-bold text-blue-700 mb-1">العميل</div>
                            <div className="font-black text-lg text-blue-900">{customer?.client_name}</div>
                            <div className="text-xs font-mono text-blue-600/80">Code: {customer?.bkcode}</div>
                        </div>

                        {/* Search & Select SIM */}
                        <div>
                            <label className="block text-sm font-medium mb-1.5">اختر شريحة من المخزن *</label>
                            <div className="relative mb-2">
                                <Search className="absolute right-3 top-2.5 text-slate-400" size={18} />
                                <input
                                    type="text"
                                    placeholder="بحث بالسيريال أو النوع..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full pr-10 pl-4 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-purple-200 outline-none transition-all"
                                />
                            </div>
                            <div className="max-h-48 overflow-y-auto border rounded-xl bg-slate-50/50">
                                {filteredSims.length === 0 ? (
                                    <div className="p-8 text-center text-slate-400 text-sm">لا توجد شرائح متاحة</div>
                                ) : (
                                    filteredSims.map((sim: any) => (
                                        <div
                                            key={sim.id}
                                            onClick={() => setSelectedSim(sim)}
                                            className={`p-3 border-b last:border-0 cursor-pointer hover:bg-purple-50 flex justify-between items-center transition-colors ${selectedSim?.id === sim.id ? 'bg-purple-100 border-purple-200' : 'border-slate-100'}`}
                                        >
                                            <div>
                                                <div className="font-mono font-bold text-sm text-slate-700">{sim.serialNumber}</div>
                                                {sim.type && <span className="text-[10px] font-bold bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded-full mt-1 inline-block">{sim.type}</span>}
                                            </div>
                                            {selectedSim?.id === sim.id && <span className="text-purple-600 font-bold text-lg">✓</span>}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Cost & Payment */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="col-span-1">
                                <label className="block text-sm font-medium mb-1.5">السعر</label>
                                <input
                                    type="number"
                                    value={cost}
                                    onChange={e => setCost(e.target.value)}
                                    className="w-full border rounded-lg px-3 py-2 bg-background focus:ring-2 focus:ring-purple-200 outline-none"
                                    placeholder="0"
                                />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-sm font-medium mb-1.5">رقم الإيصال</label>
                                <input
                                    type="text"
                                    value={receiptNumber}
                                    onChange={e => {
                                        setReceiptNumber(e.target.value);
                                        checkReceiptNumber(e.target.value);
                                    }}
                                    className={`w-full border rounded-lg px-3 py-2 bg-background focus:ring-2 focus:ring-purple-200 outline-none ${receiptError ? 'border-red-500' : ''}`}
                                />
                                {receiptError && <span className="text-xs text-red-500 mt-1 block">{receiptError}</span>}
                            </div>
                            <div className="col-span-3">
                                <label className="block text-sm font-medium mb-1.5">مكان الدفع</label>
                                <select
                                    value={paymentPlace}
                                    onChange={e => setPaymentPlace(e.target.value)}
                                    className="w-full border rounded-lg px-3 py-2 bg-background focus:ring-2 focus:ring-purple-200 outline-none"
                                >
                                    <option value="">-- اختر --</option>
                                    {PAYMENT_PLACES.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>
                        </div>
                    </form>
                </div>

                <div className="p-6 border-t bg-slate-50/50 shrink-0 flex gap-3">
                    <Button type="button" variant="outline" onClick={onClose} className="flex-1 h-12 text-sm font-bold">
                        إلغاء
                    </Button>
                    <Button
                        form="sim-purchase-form"
                        type="submit"
                        disabled={isSubmitting || !selectedSim || !!receiptError}
                        className="flex-[2] h-12 bg-purple-600 hover:bg-purple-700 text-white gap-2 font-bold shadow-sm"
                    >
                        <Plus size={18} />
                        {isSubmitting ? 'جاري الإضافة...' : 'تأكيد إضافة الشريحة'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
