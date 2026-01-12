import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { Search, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';

const SIM_TYPES = ['Vodafone', 'Orange', 'Etisalat', 'WE', 'أخرى'];
const PAYMENT_PLACES = ['ضامن', 'بنك', 'البريد'];

interface SimExchangeModalProps {
    isOpen: boolean;
    onClose: () => void;
    customer: any;
    currentSim: any;
    onSuccess: () => void;
}

export function SimExchangeModal({ isOpen, onClose, customer, currentSim, onSuccess }: SimExchangeModalProps) {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedNewSim, setSelectedNewSim] = useState<any>(null);
    const [returningStatus, setReturningStatus] = useState('ACTIVE');
    const [returningType, setReturningType] = useState(currentSim?.type || '');
    const [cost, setCost] = useState('');
    const [receiptNumber, setReceiptNumber] = useState('');
    const [paymentPlace, setPaymentPlace] = useState('');
    const [notes, setNotes] = useState('');
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

    useEffect(() => {
        if (currentSim) {
            setReturningType(currentSim.type || '');
        }
    }, [currentSim]);

    // Check receipt number duplicate
    const checkReceiptNumber = async (value: string) => {
        if (!value) {
            setReceiptError('');
            return;
        }
        try {
            const payments = await api.getPayments();
            const exists = payments?.some((p: any) => p.receiptNumber === value);
            setReceiptError(exists ? 'رقم الإيصال مستخدم من قبل' : '');
        } catch {
            setReceiptError('');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedNewSim) {
            toast.error('اختر شريحة من المخزن');
            return;
        }

        setIsSubmitting(true);
        try {
            await api.exchangeSim({
                customerId: customer.bkcode,
                returningSimSerial: currentSim.serialNumber,
                newSimId: selectedNewSim.id,
                returningStatus,
                returningType: returningType || undefined,
                cost: cost ? parseFloat(cost) : undefined,
                receiptNumber: receiptNumber || undefined,
                paymentPlace: paymentPlace || undefined,
                notes: notes || undefined,
                performedBy: user?.displayName
            });

            toast.success('تم استبدال الشريحة بنجاح');
            queryClient.invalidateQueries({ queryKey: ['customers'] });
            queryClient.invalidateQueries({ queryKey: ['warehouse-sims'] });
            onSuccess();
            onClose();
        } catch (error: any) {
            toast.error(error.message || 'فشل استبدال الشريحة');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="p-0 border-0 [&>button]:hidden flex flex-col max-h-[95vh] sm:max-h-[90vh] h-auto overflow-hidden sm:max-w-lg" dir="rtl">
                <DialogHeader className="bg-orange-50 p-6 pb-4 border-b shrink-0">
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <RefreshCw className="text-orange-600" />
                        استبدال شريحة
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto px-6 py-4">
                    <form id="sim-exchange-form" onSubmit={handleSubmit} className="space-y-5">
                        {/* Current SIM Info */}
                        <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                            <div className="text-sm font-black text-red-700 mb-1">الشريحة المرتجعة</div>
                            <div className="font-mono text-xl tracking-tight font-bold">{currentSim?.serialNumber}</div>
                            {currentSim?.type && <span className="text-[10px] font-bold bg-white text-red-600 px-2 py-0.5 rounded-full border border-red-100 mt-2 inline-block shadow-sm">{currentSim.type}</span>}
                        </div>

                        {/* Returning SIM Status & Type */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1.5">حالة الشريحة المرتجعة *</label>
                                <div className="flex gap-2 h-10 bg-slate-50 p-1 rounded-lg border border-slate-200">
                                    <label className={`flex-1 flex items-center justify-center cursor-pointer rounded-md text-sm font-bold transition-all ${returningStatus === 'ACTIVE' ? 'bg-white shadow text-green-600' : 'text-slate-500 hover:bg-white/50'}`}>
                                        <input
                                            type="radio"
                                            name="returningStatus"
                                            checked={returningStatus === 'ACTIVE'}
                                            onChange={() => setReturningStatus('ACTIVE')}
                                            className="hidden"
                                        />
                                        سليمة
                                    </label>
                                    <label className={`flex-1 flex items-center justify-center cursor-pointer rounded-md text-sm font-bold transition-all ${returningStatus === 'DEFECTIVE' ? 'bg-white shadow text-red-600' : 'text-slate-500 hover:bg-white/50'}`}>
                                        <input
                                            type="radio"
                                            name="returningStatus"
                                            checked={returningStatus === 'DEFECTIVE'}
                                            onChange={() => setReturningStatus('DEFECTIVE')}
                                            className="hidden"
                                        />
                                        تالفة
                                    </label>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1.5">نوع الشريحة المرتجعة</label>
                                <select
                                    value={returningType}
                                    onChange={e => setReturningType(e.target.value)}
                                    className="w-full border rounded-lg h-10 px-3 bg-background focus:ring-2 focus:ring-orange-200 outline-none"
                                >
                                    <option value="">-- اختر --</option>
                                    {SIM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Search & Select New SIM */}
                        <div>
                            <label className="block text-sm font-medium mb-1.5">الشريحة الجديدة من المخزن *</label>
                            <div className="relative mb-2">
                                <Search className="absolute right-3 top-2.5 text-slate-400" size={18} />
                                <input
                                    type="text"
                                    placeholder="بحث بالسيريال أو النوع..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full pr-10 pl-4 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-orange-200 outline-none"
                                />
                            </div>
                            <div className="max-h-40 overflow-y-auto border rounded-xl bg-slate-50/50">
                                {filteredSims.length === 0 ? (
                                    <div className="p-8 text-center text-slate-400 text-sm">لا توجد شرائح متاحة</div>
                                ) : (
                                    filteredSims.map((sim: any) => (
                                        <div
                                            key={sim.id}
                                            onClick={() => setSelectedNewSim(sim)}
                                            className={`p-3 border-b last:border-0 cursor-pointer hover:bg-green-50 flex justify-between items-center transition-colors ${selectedNewSim?.id === sim.id ? 'bg-green-100 border-green-200' : 'border-slate-100'}`}
                                        >
                                            <div>
                                                <div className="font-mono font-bold text-sm text-slate-700">{sim.serialNumber}</div>
                                                {sim.type && <span className="text-[10px] font-bold bg-white text-slate-600 px-2 py-0.5 rounded-full border border-slate-200 inline-block mt-1">{sim.type}</span>}
                                            </div>
                                            {selectedNewSim?.id === sim.id && <span className="text-green-600 font-bold text-lg">✓</span>}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Selected New SIM */}
                        {selectedNewSim && (
                            <div className="bg-green-50 p-4 rounded-xl border border-green-200 animate-in fade-in slide-in-from-top-2">
                                <div className="text-sm font-black text-green-700 mb-1">الشريحة الجديدة المختارة</div>
                                <div className="font-mono text-xl tracking-tight font-bold text-green-900">{selectedNewSim.serialNumber}</div>
                            </div>
                        )}

                        {/* Cost & Payment */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1.5">التكلفة (اختياري)</label>
                                <input
                                    type="number"
                                    value={cost}
                                    onChange={e => setCost(e.target.value)}
                                    className="w-full border rounded-lg px-3 py-2 bg-background focus:ring-2 focus:ring-orange-200 outline-none"
                                    placeholder="0"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1.5">مكان الدفع</label>
                                <select
                                    value={paymentPlace}
                                    onChange={e => setPaymentPlace(e.target.value)}
                                    className="w-full border rounded-lg px-3 py-2 bg-background focus:ring-2 focus:ring-orange-200 outline-none"
                                >
                                    <option value="">-- اختر --</option>
                                    {PAYMENT_PLACES.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
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
                                    className={`w-full border rounded-lg px-3 py-2 bg-background focus:ring-2 focus:ring-orange-200 outline-none ${receiptError ? 'border-red-500' : ''}`}
                                />
                                {receiptError && <span className="text-xs text-red-500 mt-1 block">{receiptError}</span>}
                            </div>
                        </div>

                        {/* Notes */}
                        <div>
                            <label className="block text-sm font-medium mb-1.5">ملاحظات</label>
                            <textarea
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                className="w-full border rounded-lg px-3 py-2 bg-background focus:ring-2 focus:ring-orange-200 outline-none resize-none"
                                rows={2}
                            />
                        </div>
                    </form>
                </div>

                <div className="p-6 border-t bg-slate-50/50 shrink-0 flex gap-3">
                    <Button type="button" variant="outline" onClick={onClose} className="flex-1 h-12 text-sm font-bold">
                        إلغاء
                    </Button>
                    <Button
                        form="sim-exchange-form"
                        type="submit"
                        disabled={isSubmitting || !selectedNewSim}
                        className="flex-[2] h-12 bg-orange-600 hover:bg-orange-700 text-white gap-2 font-bold shadow-sm"
                    >
                        <RefreshCw size={18} />
                        {isSubmitting ? 'جاري الاستبدال...' : 'تأكيد الاستبدال'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
