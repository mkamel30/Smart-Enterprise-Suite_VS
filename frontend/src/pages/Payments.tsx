import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useState, useRef, useMemo, useEffect } from 'react';
import type { Payment, PaymentStats } from '../lib/types';
import { Plus, Trash2, Search, X, Download, DollarSign, Calendar, TrendingUp, Users, Receipt } from 'lucide-react';
import { useApiMutation } from '../hooks/useApiMutation';
import { PaymentFields, usePaymentForm } from '../components/PaymentFields';
import { exportPayments } from '../utils/exportUtils';
import PageHeader from '../components/PageHeader';
import { cn } from '../lib/utils';
import { motion } from 'framer-motion';

export default function Payments() {
    const [showAddForm, setShowAddForm] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // ESC key handler for modals
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setShowAddForm(false);
            }
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, []);

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
        <button
            onClick={exportPayments}
            className="flex items-center gap-2 bg-white text-emerald-600 border-2 border-emerald-100 px-6 py-3 rounded-2xl hover:bg-emerald-50 hover:border-emerald-200 transition-all font-black text-sm shadow-xl shadow-emerald-500/5 active:scale-95"
        >
            <Download size={20} className="stroke-[2.5px]" />
            تصدير تقرير Excel
        </button>
    );

    return (
        <div className="px-8 pt-6 pb-20 bg-slate-50/50 min-h-screen" dir="rtl">
            <PageHeader
                title="إدارة المدفوعات والتحصيل"
                subtitle="تسجيل وتحصيل دفعات الصيانة والاشتراكات المتنوعة"
                actions={actionElements}
                icon={<DollarSign size={28} className="text-emerald-600" />}
            /> {/* Updated PageHeader with icon support */}

            {/* Premium Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                {[
                    { label: 'إجمالي المدفوعات', value: stats?.total, icon: TrendingUp, color: 'emerald', sub: 'إجمالي المحصل بالنظام' },
                    { label: 'تحصيل اليوم', value: stats?.today, icon: DollarSign, color: 'blue', sub: 'العمليات المسجلة اليوم' },
                    { label: 'تحصيل الشهر', value: stats?.month, icon: Calendar, color: 'purple', sub: 'إجمالي الشهر الحالي' },
                    { label: 'عدد العمليات', value: payments?.length, icon: Users, color: 'orange', sub: 'إجمالي القيود المسجلة' },
                ].map((stat, i) => (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        key={i}
                        className={cn(
                            "bg-white rounded-[2rem] p-6 border-2 transition-all hover:shadow-2xl hover:shadow-slate-200/50 group",
                            stat.color === 'emerald' ? "border-emerald-50 hover:border-emerald-100" :
                                stat.color === 'blue' ? "border-blue-50 hover:border-blue-100" :
                                    stat.color === 'purple' ? "border-purple-50 hover:border-purple-100" :
                                        "border-orange-50 hover:border-orange-100"
                        )}
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div className={cn(
                                "p-4 rounded-2xl transition-transform group-hover:scale-110",
                                stat.color === 'emerald' ? "bg-emerald-50 text-emerald-600" :
                                    stat.color === 'blue' ? "bg-blue-50 text-blue-600" :
                                        stat.color === 'purple' ? "bg-purple-50 text-purple-600" :
                                            "bg-orange-50 text-orange-600"
                            )}>
                                <stat.icon size={24} strokeWidth={2.5} />
                            </div>
                        </div>
                        <p className="text-slate-400 font-black text-[10px] uppercase tracking-[0.2em] mb-1 leading-none">{stat.label}</p>
                        <div className="flex items-baseline gap-2">
                            <h3 className="text-2xl font-black text-slate-900 font-mono tracking-tighter">{stat.value?.toLocaleString() || 0}</h3>
                            {stat.label !== 'عدد العمليات' && <span className="text-[10px] font-black text-slate-400 uppercase">ج.م</span>}
                        </div>
                        <p className="text-[9px] font-bold text-slate-400 mt-3">{stat.sub}</p>
                    </motion.div>
                ))}
            </div>

            <div className="space-y-6">
                {/* Search and Action Bar */}
                <div className="flex justify-between items-center px-2">
                    <div className="relative group w-full max-w-md">
                        <Search className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-slate-900 transition-colors" size={20} />
                        <input
                            type="text"
                            placeholder="ابحث بالاسم، السبب، أو رقم الإيصال..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full h-14 pr-16 pl-8 bg-white border-2 border-slate-100 rounded-2xl text-sm font-bold focus:border-slate-900 transition-all outline-none shadow-sm"
                        />
                    </div>
                    <button
                        onClick={() => setShowAddForm(true)}
                        className="flex items-center gap-3 bg-slate-900 text-white px-8 py-4 rounded-2xl hover:bg-slate-800 transition-all font-black text-sm shadow-2xl shadow-slate-900/20 active:scale-95"
                    >
                        <Plus size={20} strokeWidth={3} />
                        تسجيل دفعة جديدة
                    </button>
                </div>

                <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                    <div className="overflow-x-auto custom-scroll">
                        <table className="w-full text-right border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 border-b border-slate-100">
                                    <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">تاريخ القيد</th>
                                    <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">المستفيد / العميل</th>
                                    <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">وصف العملية</th>
                                    <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">المبلغ</th>
                                    <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">مكان الدفع</th>
                                    <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">رقم الإيصال</th>
                                    <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">حذف</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filteredPayments.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="p-20 text-center">
                                            <div className="flex flex-col items-center gap-4 opacity-30">
                                                <Receipt size={64} />
                                                <span className="text-xl font-black">{searchTerm ? 'لا توجد نتائج مطابقة للبحث' : 'لا توجد قيود مسجلة حالياً'}</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredPayments.map((payment: Payment) => (
                                    <tr key={payment.id} className="group hover:bg-slate-50/50 transition-colors">
                                        <td className="p-6">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-black text-slate-900">{new Date(payment.createdAt).toLocaleDateString('ar-EG')}</span>
                                                <span className="text-[10px] font-bold text-slate-400 font-mono">{new Date(payment.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                        </td>
                                        <td className="p-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-slate-900 group-hover:text-white transition-all">
                                                    <Users size={20} strokeWidth={2.5} />
                                                </div>
                                                <div className="flex flex-col text-right">
                                                    <span className="text-sm font-black text-slate-900">{payment.customerName || payment.customer?.client_name || '-'}</span>
                                                    {payment.customer?.bkcode && (
                                                        <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md w-fit mt-1 tracking-widest">{payment.customer?.bkcode}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-6">
                                            <span className="text-sm font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl">{payment.reason}</span>
                                        </td>
                                        <td className="p-6 font-mono">
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-base font-black text-slate-900">{payment.amount?.toLocaleString()}</span>
                                                <span className="text-[9px] font-black text-slate-400">ج.م</span>
                                            </div>
                                        </td>
                                        <td className="p-6">
                                            <div className="flex justify-center">
                                                {payment.paymentPlace ? (
                                                    <span className={cn(
                                                        "px-4 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border",
                                                        payment.paymentPlace === 'بنك' ? "bg-blue-50 text-blue-700 border-blue-100" :
                                                            payment.paymentPlace === 'ضامن' ? "bg-purple-50 text-purple-700 border-purple-100" :
                                                                payment.paymentPlace === 'البريد' ? "bg-yellow-50 text-yellow-700 border-yellow-100" :
                                                                    "bg-slate-50 text-slate-700 border-slate-100"
                                                    )}>
                                                        {payment.paymentPlace}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-300">-</span>
                                                )}
                                            </div>
                                        </td>

                                        <td className="p-6">
                                            <span className="text-sm font-black text-slate-900 font-mono tracking-tighter">{payment.receiptNumber}</span>
                                        </td>
                                        <td className="p-6 text-center">
                                            <button
                                                onClick={() => {
                                                    if (confirm('هل أنت متأكد من حذف هذه الدفعة؟')) {
                                                        deleteMutation.mutate(payment.id);
                                                    }
                                                }}
                                                className="w-10 h-10 bg-white border border-slate-100 text-slate-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 rounded-xl transition-all flex items-center justify-center shadow-sm"
                                            >
                                                <Trash2 size={18} strokeWidth={2.5} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Add Payment Modal */}
            {showAddForm && (
                <div className="modal-overlay" onClick={() => setShowAddForm(false)}>
                    <div className="modal-container modal-sm" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-header-content">
                                <Plus className="modal-icon text-primary" size={24} />
                                <h2 className="modal-title">تسجيل دفعة جديدة</h2>
                            </div>
                            <button type="button" className="modal-close" onClick={() => setShowAddForm(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body space-y-6">
                                <div className="modal-form-field">
                                    <label className="modal-form-label">اسم العميل / الجهة</label>
                                    <input
                                        type="text"
                                        value={infoForm.customerName}
                                        onChange={e => setInfoForm({ ...infoForm, customerName: e.target.value })}
                                        className="smart-input"
                                        placeholder="اختياري"
                                    />
                                </div>

                                <div className="modal-form-field">
                                    <label className="modal-form-label required">سبب الدفع</label>
                                    <input
                                        type="text"
                                        value={infoForm.reason}
                                        onChange={e => setInfoForm({ ...infoForm, reason: e.target.value })}
                                        className="smart-input"
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

                                <div className="modal-form-field">
                                    <label className="modal-form-label">ملاحظات</label>
                                    <textarea
                                        value={infoForm.notes}
                                        onChange={e => setInfoForm({ ...infoForm, notes: e.target.value })}
                                        className="smart-input min-h-[100px]"
                                        rows={3}
                                    />
                                </div>
                            </div>

                            <div className="modal-footer">
                                <button
                                    type="button"
                                    onClick={() => setShowAddForm(false)}
                                    className="smart-btn-secondary"
                                >
                                    إلغاء
                                </button>
                                <button
                                    type="submit"
                                    className="smart-btn-primary"
                                    disabled={!paymentForm.isValid || !infoForm.reason || receiptExists || createMutation.isPending}
                                >
                                    {createMutation.isPending ? 'جاري التسجيل...' : 'حفظ الدفعة'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
