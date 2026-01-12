import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApiMutation } from '../hooks/useApiMutation';
import {
    Wallet,
    CheckCircle,
    Clock,
    Receipt,
    DollarSign,
    Package,
    Download
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { translateStatus } from '../lib/translations';
import { exportPendingPayments } from '../utils/exportUtils';

interface PendingPaymentItem {
    id: string;
    assignmentId: string;
    machineSerial: string;
    customerId: string;
    customerName: string;
    amount: number;
    partsDetails: string;
    status: string;
    centerBranchId: string;
    targetBranchId: string;
    receiptNumber?: string;
    paymentPlace?: string;
    paidAt?: string;
    paidBy?: string;
    createdAt: string;
}

export default function PendingPayments() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [selectedPayment, setSelectedPayment] = useState<PendingPaymentItem | null>(null);
    const [showPayDialog, setShowPayDialog] = useState(false);
    const [receiptNumber, setReceiptNumber] = useState('');
    const [paymentPlace, setPaymentPlace] = useState('ضامن');
    const [filterStatus, setFilterStatus] = useState<string>('PENDING');

    // Determine if user is in maintenance center or branch
    const { data: userBranch } = useQuery({
        queryKey: ['user-branch', user?.branchId],
        queryFn: async () => {
            if (!user?.branchId) return null;
            const res = await fetch(`/api/branches/${user.branchId}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            return res.json();
        },
        enabled: !!user?.branchId
    });

    const isCenter = userBranch?.type === 'MAINTENANCE_CENTER';

    // Fetch pending payments
    const { data: payments, isLoading } = useQuery<PendingPaymentItem[]>({
        queryKey: ['pending-payments', user?.branchId, filterStatus, isCenter],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (isCenter) {
                params.append('centerBranchId', user?.branchId || '');
            } else {
                params.append('branchId', user?.branchId || '');
            }
            if (filterStatus) params.append('status', filterStatus);
            const res = await fetch(`/api/pending-payments?${params}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            return res.json();
        },
        enabled: userBranch !== undefined
    });

    // Fetch summary
    const { data: summary } = useQuery({
        queryKey: ['pending-payments-summary', user?.branchId, isCenter],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (isCenter) {
                params.append('centerBranchId', user?.branchId || '');
            } else {
                params.append('branchId', user?.branchId || '');
            }
            const res = await fetch(`/api/pending-payments/summary?${params}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            return res.json();
        },
        enabled: userBranch !== undefined
    });

    // Pay mutation (only for branches)
    const payMutation = useApiMutation({
        mutationFn: async ({ id, receiptNumber, paymentPlace }: { id: string; receiptNumber: string; paymentPlace: string }) => {
            const res = await fetch(`/api/pending-payments/${id}/pay`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ receiptNumber, paymentPlace })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to pay');
            }
            return res.json();
        },
        successMessage: 'تم تسجيل السداد بنجاح',
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pending-payments'] });
            queryClient.invalidateQueries({ queryKey: ['pending-payments-summary'] });
            setShowPayDialog(false);
            setSelectedPayment(null);
            setReceiptNumber('');
        }
    });

    const handlePayClick = (payment: PendingPaymentItem) => {
        setSelectedPayment(payment);
        setShowPayDialog(true);
    };

    const handlePay = () => {
        if (!selectedPayment || !receiptNumber.trim()) return;
        payMutation.mutate({
            id: selectedPayment.id,
            receiptNumber: receiptNumber.trim(),
            paymentPlace
        });
    };

    const getParts = (partsJson: string) => {
        try {
            return JSON.parse(partsJson);
        } catch {
            return [];
        }
    };

    return (
        <div className="space-y-6" dir="rtl">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
                        <Wallet className="text-primary" />
                        المستحقات المعلقة
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        {isCenter ? 'المبالغ المستحقة من الفروع' : 'المبالغ المستحقة لمركز الصيانة'}
                    </p>
                </div>

                {/* Filter */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={exportPendingPayments}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                    >
                        <Download size={18} />
                        تصدير Excel
                    </button>
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="border rounded-lg px-3 py-2 text-sm bg-background"
                    >
                        <option value="">الكل</option>
                        <option value="PENDING">{translateStatus('PENDING')}</option>
                        <option value="PAID">{translateStatus('PAID')}</option>
                    </select>
                </div>
            </div>

            {/* Summary */}
            {summary && (
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-orange-50 border border-orange-100 rounded-xl p-6">
                        <div className="flex items-center gap-3">
                            <div className="bg-orange-100 p-3 rounded-xl">
                                <Clock className="text-orange-600" size={24} />
                            </div>
                            <div>
                                <div className="text-3xl font-black text-orange-700">{summary.totalAmount?.toFixed(2) || 0} ج.م</div>
                                <div className="text-sm text-orange-600 font-bold">{summary.count || 0} مستحق معلق</div>
                            </div>
                        </div>
                    </div>
                    <div className="bg-green-50 border border-green-100 rounded-xl p-6 flex items-center justify-center">
                        <div className="text-center">
                            <DollarSign className="mx-auto text-green-600 mb-2" size={32} />
                            <div className="text-sm text-green-600 font-bold">
                                {isCenter ? 'المبالغ المستحقة لك' : 'المبالغ المطلوبة منك'}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Payments List */}
            <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
                {isLoading ? (
                    <div className="p-8 text-center text-muted-foreground">جاري التحميل...</div>
                ) : !payments?.length ? (
                    <div className="p-8 text-center text-muted-foreground">
                        <Package size={48} className="mx-auto mb-2 opacity-30" />
                        لا توجد مستحقات
                    </div>
                ) : (
                    <div className="divide-y">
                        {payments.map((payment) => {
                            const parts = getParts(payment.partsDetails);
                            const isPending = payment.status === 'PENDING';

                            return (
                                <div key={payment.id} className={`p-4 ${isPending ? 'bg-orange-50/30' : ''}`}>
                                    <div className="flex items-start justify-between gap-4">
                                        {/* Payment Info */}
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="font-mono font-bold text-lg">{payment.machineSerial}</span>
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${isPending ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                                                    }`}>
                                                    {translateStatus(payment.status)}
                                                </span>
                                            </div>

                                            <div className="text-sm text-muted-foreground space-y-1">
                                                <div>العميل: <span className="font-bold text-foreground">{payment.customerName || 'غير محدد'}</span></div>
                                                <div>تاريخ الإنشاء: {new Date(payment.createdAt).toLocaleDateString('ar-EG')}</div>
                                            </div>

                                            {/* Parts */}
                                            {parts.length > 0 && (
                                                <div className="mt-2 text-xs text-muted-foreground">
                                                    القطع: {parts.map((p: any) => p.name).join('، ')}
                                                </div>
                                            )}

                                            {/* Receipt info if paid */}
                                            {!isPending && payment.receiptNumber && (
                                                <div className="mt-2 bg-green-50 border border-green-100 rounded-lg p-2 text-sm">
                                                    <div className="flex items-center gap-2">
                                                        <Receipt size={14} className="text-green-600" />
                                                        <span className="font-bold text-green-700">إيصال: {payment.receiptNumber}</span>
                                                    </div>
                                                    <div className="text-xs text-green-600 mt-1">
                                                        بواسطة: {payment.paidBy} - {new Date(payment.paidAt!).toLocaleString('ar-EG')}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Amount & Action */}
                                        <div className="text-left">
                                            <div className={`text-2xl font-black ${isPending ? 'text-orange-600' : 'text-green-600'}`}>
                                                {payment.amount.toFixed(2)} ج.م
                                            </div>

                                            {/* Pay button (only for branches with pending) */}
                                            {!isCenter && isPending && (
                                                <Button
                                                    size="sm"
                                                    onClick={() => handlePayClick(payment)}
                                                    className="mt-2 bg-green-600 hover:bg-green-700 w-full"
                                                >
                                                    <Receipt size={14} className="ml-1" />
                                                    تسجيل السداد
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Pay Dialog */}
            <Dialog open={showPayDialog} onOpenChange={setShowPayDialog}>
                <DialogContent dir="rtl">
                    <DialogHeader>
                        <DialogTitle>تسجيل سداد</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="bg-orange-50 border border-orange-100 rounded-lg p-4">
                            <div className="text-sm text-muted-foreground">الماكينة</div>
                            <div className="font-mono font-bold text-lg">{selectedPayment?.machineSerial}</div>
                            <div className="text-2xl font-black text-orange-700 mt-2">
                                {selectedPayment?.amount.toFixed(2)} ج.م
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold mb-2">رقم الإيصال *</label>
                            <input
                                type="text"
                                value={receiptNumber}
                                onChange={(e) => setReceiptNumber(e.target.value)}
                                className="w-full border rounded-lg p-3 text-sm bg-background"
                                placeholder="أدخل رقم الإيصال"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold mb-2">مكان السداد</label>
                            <select
                                value={paymentPlace}
                                onChange={(e) => setPaymentPlace(e.target.value)}
                                className="w-full border rounded-lg p-3 text-sm bg-background"
                            >
                                <option value="ضامن">ضامن</option>
                                <option value="نقدي">نقدي</option>
                                <option value="تحويل بنكي">تحويل بنكي</option>
                            </select>
                        </div>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setShowPayDialog(false)}>
                            إلغاء
                        </Button>
                        <Button
                            onClick={handlePay}
                            disabled={payMutation.isPending || !receiptNumber.trim()}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            <CheckCircle size={14} className="ml-1" />
                            تأكيد السداد
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
