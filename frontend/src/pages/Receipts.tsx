import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { FileText, Calendar, AlertCircle, CheckCircle, Trash2, Edit3, Search } from 'lucide-react';
import { useApiMutation } from '../hooks/useApiMutation';
import { PaymentFields, usePaymentForm } from '../components/PaymentFields';

export default function Receipts() {
    const [activeTab, setActiveTab] = useState<'SALES' | 'INSTALLMENTS'>('SALES');
    const [filterOverdue, setFilterOverdue] = useState(false);
    const [groupBy, setGroupBy] = useState<'none' | 'customer' | 'month'>('none');
    const [searchTerm, setSearchTerm] = useState('');

    // Edit Installments Modal State
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editingSale, setEditingSale] = useState<any>(null);
    const [newInstallmentCount, setNewInstallmentCount] = useState(12);

    // Payment Modal State
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [payingInstallment, setPayingInstallment] = useState<any>(null);
    const paymentForm = usePaymentForm();

    const queryClient = useQueryClient();

    const { data: sales, isLoading: salesLoading } = useQuery({
        queryKey: ['sales'],
        queryFn: () => api.getSales(),
        enabled: activeTab === 'SALES'
    });

    const { data: installments, isLoading: installmentsLoading } = useQuery({
        queryKey: ['installments', filterOverdue],
        queryFn: () => api.getInstallments(filterOverdue),
        enabled: activeTab === 'INSTALLMENTS'
    });

    const payMutation = useApiMutation({
        mutationFn: (data: { id: string; amount: number; receiptNumber: string; paymentPlace: string }) =>
            api.payInstallmentWithDetails(data.id, paymentForm.data.amount, paymentForm.data.receiptNumber, paymentForm.data.paymentPlace),
        successMessage: 'تم تسجيل الدفع بنجاح',
        errorMessage: 'فشل تسجيل الدفع',
        onSuccess: async () => {
            // Explicit invalidation for instant refresh
            await queryClient.invalidateQueries({ queryKey: ['installments'] });
            await queryClient.invalidateQueries({ queryKey: ['sales'] });

            setPaymentModalOpen(false);
            setPayingInstallment(null);
            paymentForm.reset();
        }
    });

    const deleteSaleMutation = useApiMutation({
        mutationFn: (id: string) => api.deleteSale(id),
        successMessage: 'تم إلغاء عملية البيع',
        successDetail: 'تم استرجاع الماكينة للمخزن',
        errorMessage: 'فشل إلغاء البيع',
        onSuccess: async () => {
            // Explicit invalidation for instant refresh
            await queryClient.invalidateQueries({ queryKey: ['sales'] });
            await queryClient.invalidateQueries({ queryKey: ['installments'] });
            await queryClient.invalidateQueries({ queryKey: ['warehouse-machines'] }); // Also invalidate machines as one is returned
            await queryClient.invalidateQueries({ queryKey: ['warehouse-counts'] });
        }
    });

    const recalculateMutation = useApiMutation({
        mutationFn: (data: { saleId: string; newCount: number }) => api.recalculateInstallments(data.saleId, data.newCount),
        successMessage: 'تم تعديل الأقساط بنجاح',
        errorMessage: 'فشل تعديل الأقساط',
        onSuccess: async () => {
            // Explicit invalidation for instant refresh
            await queryClient.invalidateQueries({ queryKey: ['sales'] });
            await queryClient.invalidateQueries({ queryKey: ['installments'] });

            setEditModalOpen(false);
            setEditingSale(null);
        }
    });

    const openEditModal = (sale: any) => {
        setEditingSale(sale);
        setNewInstallmentCount(sale.installments?.length || 12);
        setEditModalOpen(true);
    };

    const handlePayClick = (inst: any) => {
        setPayingInstallment(inst);
        paymentForm.setData({
            amount: inst.amount,
            receiptNumber: '',
            paymentPlace: 'ضامن'
        });
        setPaymentModalOpen(true);
    };

    const filteredInstallments = useMemo(() => {
        if (!installments) return [];
        return installments.filter((inst: any) => {
            const matchesSearch = searchTerm === '' ||
                inst.sale?.customer?.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                inst.sale?.customer?.bkcode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                inst.description?.toLowerCase().includes(searchTerm.toLowerCase());
            return matchesSearch;
        });
    }, [installments, searchTerm]);

    const groupedInstallments = useMemo(() => {
        if (groupBy === 'none') return {};
        const groups: Record<string, any[]> = {};
        filteredInstallments.forEach((inst: any) => {
            let key = '';
            if (groupBy === 'customer') {
                key = `${inst.sale?.customer?.client_name || 'غير محدد'} (${inst.sale?.customer?.bkcode || ''})`;
            } else if (groupBy === 'month') {
                const date = new Date(inst.dueDate);
                key = `${date.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' })}`;
            }
            if (!groups[key]) groups[key] = [];
            groups[key].push(inst);
        });
        return groups;
    }, [filteredInstallments, groupBy]);

    return (
        <div className="px-8 pt-4 pb-8" dir="rtl">
            <h1 className="text-3xl font-bold mb-6">متابعة المبيعات والأقساط</h1>

            {/* Tabs */}
            <div className="flex gap-4 mb-6 border-b">
                <button
                    onClick={() => setActiveTab('SALES')}
                    className={`pb-2 px-4 flex items-center gap-2 ${activeTab === 'SALES' ? 'font-bold text-blue-600 border-b-2 border-blue-600' : 'text-slate-500'}`}
                >
                    <FileText size={18} />
                    سجل المبيعات
                </button>
                <button
                    onClick={() => setActiveTab('INSTALLMENTS')}
                    className={`pb-2 px-4 flex items-center gap-2 ${activeTab === 'INSTALLMENTS' ? 'font-bold text-blue-600 border-b-2 border-blue-600' : 'text-slate-500'}`}
                >
                    <Calendar size={18} />
                    متابعة الأقساط
                </button>
            </div>

            {activeTab === 'SALES' && (
                <div className="bg-white rounded-lg shadow border overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-right text-sm whitespace-nowrap">
                            <thead className="bg-slate-50 border-b">
                                <tr>
                                    <th className="p-3 text-sm">التاريخ</th>
                                    <th className="p-3 text-sm">العميل</th>
                                    <th className="p-3 text-sm">الماكينة</th>
                                    <th className="p-3 text-sm">النوع</th>
                                    <th className="p-3 text-sm">الإجمالي</th>
                                    <th className="p-3 text-sm">المقدم</th>
                                    <th className="p-3 text-sm">المتبقي</th>
                                    <th className="p-3 w-16"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {salesLoading ? (
                                    <tr><td colSpan={8} className="p-8 text-center">جاري التحميل...</td></tr>
                                ) : sales?.map((sale: any) => (
                                    <tr key={sale.id} className="hover:bg-slate-50">
                                        <td className="p-3 text-sm">{new Date(sale.saleDate).toLocaleDateString('ar-EG')}</td>
                                        <td className="p-3">
                                            <div className="text-sm">{sale.customer?.client_name || sale.customerId}</div>
                                            <div className="text-xs text-slate-400 font-mono">{sale.customer?.bkcode}</div>
                                        </td>
                                        <td className="p-3 font-mono text-sm">{sale.serialNumber}</td>
                                        <td className="p-3">
                                            <span className={`px-2 py-1 rounded text-xs ${sale.type === 'CASH' ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'}`}>
                                                {sale.type === 'CASH' ? 'كاش' : `قسط (${sale.installments?.length || 0})`}
                                            </span>
                                        </td>
                                        <td className="p-3 font-bold text-sm">{sale.totalPrice?.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        <td className="p-3 text-green-600 font-bold text-sm">{sale.paidAmount?.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        <td className="p-3 text-red-600 font-bold text-sm">{(sale.totalPrice - sale.paidAmount)?.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        <td className="p-4 flex gap-1">
                                            {sale.type === 'INSTALLMENT' && (
                                                <button
                                                    onClick={() => openEditModal(sale)}
                                                    className="p-1 text-blue-500 hover:bg-blue-50 rounded"
                                                    title="تعديل عدد الأقساط"
                                                >
                                                    <Edit3 size={16} />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => {
                                                    if (confirm(`هل أنت متأكد من إلغاء عملية بيع الماكينة ${sale.serialNumber}?\nسيتم استرجاع الماكينة للمخزن وحذف جميع الحسابات المتعلقة بها.`)) {
                                                        deleteSaleMutation.mutate(sale.id);
                                                    }
                                                }}
                                                className="p-1 text-red-500 hover:bg-red-50 rounded"
                                                title="إلغاء البيع (استرجاع)"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'INSTALLMENTS' && (
                <div>
                    <div className="mb-4 flex flex-col sm:flex-row items-center gap-4 flex-wrap">
                        {/* Search */}
                        <div className="relative w-full sm:w-auto">
                            <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="بحث بالعميل أو الكود..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="border rounded-lg pr-10 pl-4 py-2 w-full sm:w-64"
                            />
                        </div>

                        <div className="flex flex-wrap gap-4 items-center">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={filterOverdue}
                                    onChange={(e) => setFilterOverdue(e.target.checked)}
                                    className="w-4 h-4"
                                />
                                <span className="text-sm font-medium">عرض المتأخرات فقط</span>
                            </label>

                            <div className="flex items-center gap-2 border-r pr-4">
                                <span className="text-sm text-slate-500">تجميع حسب:</span>
                                <select
                                    value={groupBy}
                                    onChange={(e) => setGroupBy(e.target.value as any)}
                                    className="border rounded px-2 py-1 text-sm"
                                >
                                    <option value="none">بدون تجميع</option>
                                    <option value="customer">العميل</option>
                                    <option value="month">الشهر</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {groupBy === 'none' ? (
                        <div className="bg-white rounded-lg shadow border overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-right text-sm whitespace-nowrap">
                                    <thead className="bg-slate-50 border-b">
                                        <tr>
                                            <th className="p-4">تاريخ الاستحقاق</th>
                                            <th className="p-4">العميل</th>
                                            <th className="p-4">الكود</th>
                                            <th className="p-4">وصف القسط</th>
                                            <th className="p-4">المبلغ</th>
                                            <th className="p-4">الحالة</th>
                                            <th className="p-4">إجراءات</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {installmentsLoading ? (
                                            <tr><td colSpan={7} className="p-8 text-center">جاري التحميل...</td></tr>
                                        ) : filteredInstallments?.length === 0 ? (
                                            <tr><td colSpan={7} className="p-8 text-center text-slate-500">لا توجد أقساط</td></tr>
                                        ) : filteredInstallments?.map((inst: any) => {
                                            const isOverdue = !inst.isPaid && new Date(inst.dueDate) < new Date();
                                            return (
                                                <tr key={inst.id} className={`hover:bg-slate-50 ${isOverdue ? 'bg-red-50' : ''}`}>
                                                    <td className="p-4 font-mono">
                                                        <div className="flex items-center gap-2">
                                                            <Calendar size={14} className="text-slate-400" />
                                                            {new Date(inst.dueDate).toLocaleDateString('ar-EG')}
                                                        </div>
                                                    </td>
                                                    <td className="p-4">{inst.sale?.customer?.client_name}</td>
                                                    <td className="p-4 font-mono text-slate-500">{inst.sale?.customer?.bkcode}</td>
                                                    <td className="p-4">{inst.description}</td>
                                                    <td className="p-4 font-bold">{inst.amount?.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                    <td className="p-4">
                                                        {inst.isPaid ? (
                                                            <span className="flex items-center gap-1 text-green-600 text-xs font-bold">
                                                                <CheckCircle size={14} /> تم السداد
                                                            </span>
                                                        ) : isOverdue ? (
                                                            <span className="flex items-center gap-1 text-red-600 text-xs font-bold">
                                                                <AlertCircle size={14} /> متأخر
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-500 text-xs">مستحق</span>
                                                        )}
                                                    </td>
                                                    <td className="p-4">
                                                        {!inst.isPaid && (
                                                            <button
                                                                onClick={() => handlePayClick(inst)}
                                                                className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                                                            >
                                                                سداد
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {Object.entries(groupedInstallments).map(([groupKey, groupInsts]: [string, any]) => {
                                const totalAmount = groupInsts.reduce((sum: number, i: any) => sum + i.amount, 0);
                                const paidAmount = groupInsts.filter((i: any) => i.isPaid).reduce((sum: number, i: any) => sum + i.amount, 0);
                                const overdueCount = groupInsts.filter((i: any) => !i.isPaid && new Date(i.dueDate) < new Date()).length;

                                return (
                                    <div key={groupKey} className="bg-white rounded-lg shadow border overflow-hidden">
                                        <div className="bg-slate-100 px-4 py-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                            <h3 className="font-bold text-lg">{groupKey}</h3>
                                            <div className="flex flex-wrap gap-4 text-sm w-full sm:w-auto">
                                                <span>الإجمالي: <strong>{totalAmount.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
                                                <span className="text-green-600">مدفوع: <strong>{paidAmount.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
                                                <span className="text-red-600">متبقي: <strong>{(totalAmount - paidAmount).toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
                                                {overdueCount > 0 && (
                                                    <span className="text-red-600 bg-red-100 px-2 rounded">⚠ {overdueCount} متأخر</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-right text-sm whitespace-nowrap">
                                                <tbody className="divide-y">
                                                    {groupInsts.map((inst: any) => {
                                                        const isOverdue = !inst.isPaid && new Date(inst.dueDate) < new Date();
                                                        return (
                                                            <tr key={inst.id} className={`hover:bg-slate-50 ${isOverdue ? 'bg-red-50' : ''}`}>
                                                                <td className="p-3 font-mono w-32">
                                                                    {new Date(inst.dueDate).toLocaleDateString('ar-EG')}
                                                                </td>
                                                                {groupBy === 'month' && (
                                                                    <td className="p-3">{inst.sale?.customer?.client_name} ({inst.sale?.customer?.bkcode})</td>
                                                                )}
                                                                <td className="p-3 text-slate-500">{inst.description}</td>
                                                                <td className="p-3 font-bold w-24">{inst.amount?.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                                <td className="p-3 w-24">
                                                                    {inst.isPaid ? (
                                                                        <span className="text-green-600 text-xs">✓ مدفوع</span>
                                                                    ) : isOverdue ? (
                                                                        <span className="text-red-600 text-xs">⚠ متأخر</span>
                                                                    ) : (
                                                                        <span className="text-slate-400 text-xs">مستحق</span>
                                                                    )}
                                                                </td>
                                                                <td className="p-3 w-20">
                                                                    {!inst.isPaid && (
                                                                        <button
                                                                            onClick={() => handlePayClick(inst)}
                                                                            className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                                                                        >
                                                                            سداد
                                                                        </button>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Payment Modal */}
            {paymentModalOpen && payingInstallment && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg p-6 w-full max-w-xs sm:max-w-sm">
                        <h2 className="text-xl font-bold mb-4">سداد قسط</h2>
                        <p className="text-sm text-slate-600 mb-4">
                            {payingInstallment.description} - {payingInstallment.sale?.customer?.client_name}
                        </p>

                        <PaymentFields
                            data={paymentForm.data}
                            onChange={paymentForm.updateField}
                        />

                        <div className="flex gap-2 mt-6">
                            <button
                                onClick={() => payMutation.mutate({
                                    id: payingInstallment.id,
                                    amount: paymentForm.data.amount,
                                    receiptNumber: paymentForm.data.receiptNumber,
                                    paymentPlace: paymentForm.data.paymentPlace
                                })}
                                disabled={!paymentForm.isValid || payMutation.isPending}
                                className="flex-1 bg-green-600 text-white py-2 rounded-lg disabled:bg-slate-300 disabled:cursor-not-allowed font-bold"
                            >
                                {payMutation.isPending ? 'جاري السداد...' : 'تأكيد السداد'}
                            </button>
                            <button
                                onClick={() => setPaymentModalOpen(false)}
                                className="flex-1 border py-2 rounded-lg hover:bg-slate-50"
                            >
                                إلغاء
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Installments Modal */}
            {/* Edit Installments Modal */}
            {editModalOpen && editingSale && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg p-6 w-full max-w-xs sm:max-w-sm">
                        <h2 className="text-xl font-bold mb-4">تعديل عدد الأقساط</h2>
                        <p className="text-sm text-slate-600 mb-4">
                            الماكينة: {editingSale.serialNumber}<br />
                            العميل: {editingSale.customer?.client_name}<br />
                            المتبقي: {(editingSale.totalPrice - editingSale.paidAmount).toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م
                        </p>

                        <div>
                            <label className="block text-sm font-medium mb-1">عدد الأقساط الجديد</label>
                            <select
                                value={newInstallmentCount}
                                onChange={(e) => setNewInstallmentCount(Number(e.target.value))}
                                className="w-full border rounded-lg px-3 py-2"
                            >
                                {[3, 6, 9, 12, 18, 24].map(n => (
                                    <option key={n} value={n}>{n} شهر</option>
                                ))}
                            </select>
                            <p className="text-xs text-slate-400 mt-2">
                                سيتم حذف الأقساط الغير مدفوعة وإعادة توزيع المبلغ المتبقي على الأقساط الجديدة
                            </p>
                        </div>

                        <div className="flex gap-2 mt-6">
                            <button
                                onClick={() => recalculateMutation.mutate({
                                    saleId: editingSale.id,
                                    newCount: newInstallmentCount
                                })}
                                className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 font-bold"
                                disabled={recalculateMutation.isPending}
                            >
                                {recalculateMutation.isPending ? 'جاري الحفظ...' : 'حفظ التعديل'}
                            </button>
                            <button
                                onClick={() => setEditModalOpen(false)}
                                className="flex-1 border py-2 rounded-lg hover:bg-slate-50"
                            >
                                إلغاء
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
