import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useState, useMemo } from 'react';
import type { Payment, PaymentStats } from '../lib/types';
import { Plus, Trash2, Search, X, Download } from 'lucide-react';
import { useApiMutation } from '../hooks/useApiMutation';
import { PaymentFields, usePaymentForm } from '../components/PaymentFields';
import { exportPayments } from '../utils/exportUtils';
import PageHeader from '../components/PageHeader';

export default function Payments() {
    const [showAddForm, setShowAddForm] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Separate form state for non-payment fields
    const [infoForm, setInfoForm] = useState({
        customerName: '',
        reason: '',
        notes: ''
    });

    // Use shared payment form hook
    const paymentForm = usePaymentForm();
    const [receiptChecking, setReceiptChecking] = useState(false);
    const [receiptExists, setReceiptExists] = useState(false);

    const checkReceiptNumber = async (value: string) => {
        if (!value.trim()) {
            setReceiptExists(false);
            return;
        }
        setReceiptChecking(true);
        try {
            const res = await api.checkReceipt(value);
            setReceiptExists(res.exists);
        } catch {
            setReceiptExists(false);
        } finally {
            setReceiptChecking(false);
        }
    };

    const queryClient = useQueryClient();

    const { data: payments, isLoading } = useQuery<Payment[]>({
        queryKey: ['payments'],
        queryFn: () => api.getPayments()
    });

    const { data: stats } = useQuery<PaymentStats>({
        queryKey: ['payment-stats'],
        queryFn: () => api.getPaymentStats()
    });

    const createMutation = useApiMutation({
        mutationFn: (data: any) => api.createPayment(data),
        successMessage: 'تم تسجيل الدفعة بنجاح',
        errorMessage: 'فشل تسجيل الدفعة',
        onSuccess: async () => {
            // Explicit invalidation for instant refresh
            await queryClient.invalidateQueries({ queryKey: ['payments'] });
            await queryClient.invalidateQueries({ queryKey: ['payment-stats'] });

            setShowAddForm(false);
            setInfoForm({ customerName: '', reason: '', notes: '' });
            paymentForm.reset();
        }
    });

    const deleteMutation = useApiMutation({
        mutationFn: (id: string) => api.deletePayment(id),
        successMessage: 'تم حذف الدفعة',
        errorMessage: 'فشل حذف الدفعة',
        onSuccess: async () => {
            // Explicit invalidation for instant refresh
            await queryClient.invalidateQueries({ queryKey: ['payments'] });
            await queryClient.invalidateQueries({ queryKey: ['payment-stats'] });
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        createMutation.mutate({
            ...infoForm,
            ...paymentForm.data
        });
    };

    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString('ar-EG', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Smart search filtering
    const filteredPayments = useMemo(() => {
        if (!payments) return [];
        if (!searchTerm.trim()) return payments;

        const term = searchTerm.toLowerCase();
        return payments.filter((payment: Payment) => {
            return (
                payment.customerName?.toLowerCase().includes(term) ||
                payment.customerId?.toLowerCase().includes(term) ||
                payment.reason?.toLowerCase().includes(term) ||
                payment.receiptNumber?.toLowerCase().includes(term) ||
                payment.paymentPlace?.toLowerCase().includes(term) ||
                payment.amount?.toString().includes(term)
            );
        });
    }, [payments, searchTerm]);

    if (isLoading) {
        return <div className="flex h-screen items-center justify-center">جاري التحميل...</div>;
    }

    const filterElement = (
        <div className="relative group">
            <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" />
            <input
                type="text"
                placeholder="بحث..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-white border-2 border-primary/10 rounded-xl pr-10 pl-4 py-2.5 outline-none focus:border-primary/30 focus:shadow-lg transition-all w-full md:w-[250px] text-sm font-bold"
            />
        </div>
    );

    const actionElements = (
        <div className="flex items-center gap-3">
            <button
                onClick={exportPayments}
                className="flex items-center gap-2 px-5 py-2.5 bg-white text-emerald-600 border-2 border-primary/10 rounded-xl hover:bg-slate-50 transition-all font-bold text-sm shadow-sm"
            >
                <Download size={18} />
                تصدير Excel
            </button>
            <button
                onClick={() => setShowAddForm(true)}
                className="flex items-center gap-2 bg-gradient-to-r from-primary to-primary/90 text-white px-6 py-2.5 rounded-xl hover:shadow-lg hover:shadow-primary/20 transition-all font-black text-sm active:scale-95 shadow-md"
            >
                <Plus size={20} />
                تسجيل دفعة
            </button>
        </div>
    );

    return (
        <div className="px-8 pt-4 pb-8 bg-gradient-to-br from-slate-50 to-blue-50/30 min-h-screen" dir="rtl">
            <PageHeader
                title="المدفوعات"
                subtitle="تسجيل وتحصيل دفعات الصيانة والاشتراكات"
                filter={filterElement}
                actions={actionElements}
            />

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-lg border p-4">
                    <div className="text-sm text-slate-500">إجمالي المدفوعات</div>
                    <div className="text-2xl font-bold text-green-600">{stats?.total?.toLocaleString() || 0} ج.م</div>
                </div>
                <div className="bg-white rounded-lg border p-4">
                    <div className="text-sm text-slate-500">اليوم</div>
                    <div className="text-2xl font-bold text-blue-600">{stats?.today?.toLocaleString() || 0} ج.م</div>
                </div>
                <div className="bg-white rounded-lg border p-4">
                    <div className="text-sm text-slate-500">هذا الشهر</div>
                    <div className="text-2xl font-bold text-purple-600">{stats?.month?.toLocaleString() || 0} ج.م</div>
                </div>
                <div className="bg-white rounded-lg border p-4">
                    <div className="text-sm text-slate-500">عدد العمليات</div>
                    <div className="text-2xl font-bold">{payments?.length || 0}</div>
                </div>
            </div>

            {/* Payments Table */}
            <div className="bg-white rounded-lg border">
                <div className="p-4 border-b flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
                    <h3 className="font-bold">سجل المدفوعات</h3>
                    <div className="relative w-full sm:w-80">
                        <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="بحث بالعميل، السبب، رقم الإيصال..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full border rounded-lg pr-10 pl-10 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>
                </div>
                {searchTerm && (
                    <div className="px-4 py-2 bg-blue-50 text-sm text-blue-700">
                        عرض {filteredPayments.length} من {payments?.length} نتيجة
                    </div>
                )}
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="text-right p-2 border-b text-xs">التاريخ</th>
                                <th className="text-right p-2 border-b text-xs">العميل</th>
                                <th className="text-right p-2 border-b text-xs">السبب</th>
                                <th className="text-right p-2 border-b text-xs">المبلغ</th>
                                <th className="text-right p-2 border-b text-xs">مكان الدفع</th>
                                <th className="text-right p-2 border-b text-xs">رقم الإيصال</th>
                                <th className="text-center p-2 border-b text-xs">حذف</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredPayments.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-slate-500">
                                        {searchTerm ? 'لا توجد نتائج مطابقة للبحث' : 'لا توجد مدفوعات'}
                                    </td>
                                </tr>
                            ) : filteredPayments.map((payment: Payment) => (
                                <tr key={payment.id} className="border-b hover:bg-slate-50">
                                    <td className="p-2 text-xs">{formatDate(payment.createdAt)}</td>
                                    <td className="p-2 text-sm">
                                        <div>{payment.customerName || payment.customer?.client_name || '-'}</div>
                                        <div className="text-xs text-slate-400 font-mono">{payment.customer?.bkcode}</div>
                                    </td>
                                    <td className="p-2 text-sm">{payment.reason}</td>
                                    <td className="p-2 font-bold text-green-600 text-sm">{payment.amount?.toLocaleString()} ج.م</td>
                                    <td className="p-2">
                                        {payment.paymentPlace ? (
                                            <span className={`px-2 py-1 rounded text-xs ${payment.paymentPlace === 'بنك' ? 'bg-blue-100 text-blue-800' :
                                                payment.paymentPlace === 'ضامن' ? 'bg-purple-100 text-purple-800' :
                                                    payment.paymentPlace === 'البريد' ? 'bg-yellow-100 text-yellow-800' :
                                                        'bg-slate-100 text-slate-700'
                                                }`}>
                                                {payment.paymentPlace}
                                            </span>
                                        ) : (
                                            <span className="text-slate-400 text-xs">-</span>
                                        )}
                                    </td>

                                    <td className="p-2 font-mono text-xs">{payment.receiptNumber}</td>
                                    <td className="p-2 text-center">
                                        <button
                                            onClick={() => {
                                                if (confirm('هل أنت متأكد من حذف هذه الدفعة؟')) {
                                                    deleteMutation.mutate(payment.id);
                                                }
                                            }}
                                            className="text-red-500 hover:bg-red-50 p-1 rounded"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add Payment Modal */}
            {showAddForm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-[450px] max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-bold mb-4">تسجيل دفعة جديدة</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">اسم العميل / الجهة</label>
                                <input
                                    type="text"
                                    value={infoForm.customerName}
                                    onChange={e => setInfoForm({ ...infoForm, customerName: e.target.value })}
                                    className="w-full border rounded-lg px-3 py-2"
                                    placeholder="اختياري"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">سبب الدفع</label>
                                <input
                                    type="text"
                                    value={infoForm.reason}
                                    onChange={e => setInfoForm({ ...infoForm, reason: e.target.value })}
                                    className="w-full border rounded-lg px-3 py-2"
                                    required
                                    placeholder="مثال: فاتورة تليفون، صيانة..."
                                />
                            </div>

                            <PaymentFields
                                data={paymentForm.data}
                                onChange={paymentForm.updateField}
                                onReceiptBlur={(val) => checkReceiptNumber(val)}
                                receiptExists={receiptExists}
                                receiptChecking={receiptChecking}
                            />

                            <div>
                                <label className="block text-sm font-medium mb-1">ملاحظات</label>
                                <textarea
                                    value={infoForm.notes}
                                    onChange={e => setInfoForm({ ...infoForm, notes: e.target.value })}
                                    className="w-full border rounded-lg px-3 py-2"
                                    rows={3}
                                />
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button
                                    type="submit"
                                    className="flex-1 bg-green-600 text-white py-2 rounded-lg font-bold disabled:bg-slate-300 disabled:cursor-not-allowed"
                                    disabled={!paymentForm.isValid || !infoForm.reason || receiptExists}
                                >
                                    {createMutation.isPending ? 'جاري التسجيل...' : 'حفظ'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowAddForm(false)}
                                    className="flex-1 border py-2 rounded-lg hover:bg-slate-50"
                                >
                                    إلغاء
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
