import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api/client';
import {
    FileText, Calendar, AlertCircle, CheckCircle, Trash2, Edit3,
    Search, Printer, Download, LayoutDashboard, X, DollarSign,
    Settings2, TrendingUp, Filter, ArrowRight, User, Hash, Tag,
    ChevronDown, ChevronUp, Layers, Receipt, Clock, Info, RotateCcw
} from 'lucide-react';
import InstallmentsDashboard from '../components/InstallmentsDashboard';
import { useApiMutation } from '../hooks/useApiMutation';
import { PaymentFields, usePaymentForm } from '../components/PaymentFields';
import { openSaleReport } from '../utils/reports/SaleReport';
import { exportSales } from '../utils/exportUtils';
import PageHeader from '../components/PageHeader';
import ConfirmDialog from '../components/ConfirmDialog';
import { cn } from '../lib/utils';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../components/ui/dialog';

export default function Receipts() {
    const [activeTab, setActiveTab] = useState<'SALES' | 'INSTALLMENTS' | 'DASHBOARD'>('DASHBOARD');
    const [filterOverdue, setFilterOverdue] = useState(false);
    const [groupBy, setGroupBy] = useState<'none' | 'customer' | 'month'>('none');
    const [searchTerm, setSearchTerm] = useState('');

    // Modal States
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editingSale, setEditingSale] = useState<any>(null);
    const [newInstallmentCount, setNewInstallmentCount] = useState(12);

    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [payingInstallment, setPayingInstallment] = useState<any>(null);
    const paymentForm = usePaymentForm();
    const [receiptChecking, setReceiptChecking] = useState(false);
    const [receiptExists, setReceiptExists] = useState(false);

    // Delete Confirmation State
    const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; saleId: string; serial: string } | null>(null);

    const queryClient = useQueryClient();

    // ESC key handler
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (paymentModalOpen) setPaymentModalOpen(false);
                if (editModalOpen) setEditModalOpen(false);
                if (confirmDelete?.isOpen) setConfirmDelete(null);
            }
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [paymentModalOpen, editModalOpen, confirmDelete]);

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
            api.payInstallmentWithDetails(data.id, data.amount, data.receiptNumber, data.paymentPlace),
        successMessage: 'تم تسجيل الدفع بنجاح',
        errorMessage: 'فشل تسجيل الدفع',
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['installments'] });
            await queryClient.invalidateQueries({ queryKey: ['sales'] });
            await queryClient.invalidateQueries({ queryKey: ['installment-stats'] });

            setPaymentModalOpen(false);
            setPayingInstallment(null);
            paymentForm.reset();
        }
    });

    const deleteSaleMutation = useApiMutation({
        mutationFn: (id: string) => api.deleteSale(id),
        successMessage: 'تم إلغاء عملية البيع مسبقاً',
        successDetail: 'تم استرجاع الماكينة للمخزن وإلغاء جميع الإيصالات والحسابات المرتبطة بنجاح',
        errorMessage: 'فشل إلغاء البيع',
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['sales'] });
            await queryClient.invalidateQueries({ queryKey: ['installments'] });
            await queryClient.invalidateQueries({ queryKey: ['warehouse-machines'] });
            await queryClient.invalidateQueries({ queryKey: ['warehouse-counts'] });
            await queryClient.invalidateQueries({ queryKey: ['installment-stats'] });
            setConfirmDelete(null);
        }
    });

    const recalculateMutation = useApiMutation({
        mutationFn: (data: { saleId: string; newCount: number }) => api.recalculateInstallments(data.saleId, data.newCount),
        successMessage: 'تم تعديل الأقساط بنجاح',
        errorMessage: 'فشل تعديل الأقساط',
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['sales'] });
            await queryClient.invalidateQueries({ queryKey: ['installments'] });
            await queryClient.invalidateQueries({ queryKey: ['installment-stats'] });

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
        setReceiptExists(false);
        setReceiptChecking(false);
        setPaymentModalOpen(true);
    };

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

    const filteredInstallments = useMemo(() => {
        if (!installments) return [];
        return installments.filter((inst: any) => {
            const matchesSearch = searchTerm === '' ||
                inst.sale?.customer?.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                inst.sale?.customer?.bkcode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                inst.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                inst.sale?.serialNumber?.toLowerCase().includes(searchTerm.toLowerCase());
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

    const tabsRows = [
        { id: 'DASHBOARD', label: 'لوحة التحكم', icon: LayoutDashboard },
        { id: 'SALES', label: 'سجل المبيعات', icon: Receipt },
        { id: 'INSTALLMENTS', label: 'كشف الأقساط', icon: Calendar },
    ];

    const actionElements = (
        <button
            onClick={exportSales}
            className="flex items-center gap-2 bg-white text-emerald-600 border-2 border-emerald-100 px-6 py-3 rounded-2xl hover:bg-emerald-50 hover:border-emerald-200 transition-all font-black text-sm shadow-xl shadow-emerald-500/5 active:scale-95"
        >
            <Download size={20} className="stroke-[2.5px]" />
            تصدير تقرير Excel
        </button>
    );

    return (
        <div className="px-8 pt-6 pb-20 bg-slate-50/50 min-h-screen" dir="rtl">
            <PageHeader
                title="إدارة المبيعات والتحصيل"
                subtitle="متابعة التدفقات النقدية، تقارير البيع، وجدولة المديونيات"
                actions={actionElements}
                icon={<DollarSign size={28} className="text-emerald-600" />}
            />

            {/* Premium Tab Navigation */}
            <div className="flex gap-2 p-1.5 bg-slate-100/50 backdrop-blur-md rounded-[2rem] w-fit mb-10 border border-slate-200/50 shadow-sm">
                {tabsRows.map(tab => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={cn(
                                "relative px-8 py-3.5 rounded-[1.5rem] flex items-center gap-3 transition-all duration-500 overflow-hidden group",
                                isActive
                                    ? "bg-slate-900 text-white shadow-2xl shadow-slate-900/30"
                                    : "text-slate-500 hover:bg-white hover:text-slate-900 hover:shadow-lg hover:shadow-slate-200/50"
                            )}
                        >
                            <Icon size={20} className={cn("transition-transform duration-500", isActive ? "scale-110" : "group-hover:scale-110")} strokeWidth={isActive ? 3 : 2} />
                            <span className={cn("text-sm font-black tracking-tight transition-all", isActive ? "translate-x-0" : "")}>{tab.label}</span>
                            {isActive && (
                                <motion.div
                                    layoutId="tab-glow"
                                    className="absolute -right-2 -bottom-2 w-12 h-12 bg-white/10 rounded-full blur-xl"
                                />
                            )}
                        </button>
                    );
                })}
            </div>

            <AnimatePresence mode="wait">
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, scale: 0.98, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98, y: -10 }}
                    transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                >
                    {activeTab === 'DASHBOARD' && (
                        <InstallmentsDashboard
                            onFilterOverdue={() => {
                                setActiveTab('INSTALLMENTS');
                                setFilterOverdue(true);
                            }}
                        />
                    )}

                    {activeTab === 'SALES' && (
                        <div className="space-y-6">
                            {/* Search and Filter for Sales */}
                            <div className="flex justify-between items-center px-2">
                                <div className="relative group w-full max-w-md">
                                    <Search className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-slate-900 transition-colors" size={20} />
                                    <input
                                        type="text"
                                        placeholder="ابحث بالاسم، السيريال، أو الكود..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full h-14 pr-16 pl-8 bg-white border-2 border-slate-100 rounded-2xl text-sm font-bold focus:border-slate-900 transition-all outline-none shadow-sm text-right"
                                    />
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white px-4 py-2 rounded-xl border border-slate-100">
                                        إجمالي السجلات: {sales?.length || 0}
                                    </span>
                                </div>
                            </div>

                            <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                                <div className="overflow-x-auto custom-scroll">
                                    <table className="w-full text-right border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">تاريخ العملية</th>
                                                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">المستفيد المسجل</th>
                                                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">بيانات الماكينة</th>
                                                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">نظام التعاقد</th>
                                                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">الموقف المالي</th>
                                                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">الإجراءات</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {salesLoading ? (
                                                <tr>
                                                    <td colSpan={6} className="p-20 text-center flex flex-col items-center gap-4">
                                                        <div className="w-12 h-12 border-4 border-slate-100 border-t-slate-900 rounded-full animate-spin" />
                                                        <span className="text-sm font-bold text-slate-400">جاري استدعاء سجل المبيعات الفعلي...</span>
                                                    </td>
                                                </tr>
                                            ) : sales?.length === 0 ? (
                                                <tr>
                                                    <td colSpan={6} className="p-20 text-center">
                                                        <div className="flex flex-col items-center gap-4 opacity-30">
                                                            <Receipt size={64} />
                                                            <span className="text-xl font-black">لا توجد سجلات مبيعات حالياً</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : sales?.filter((s: any) =>
                                                searchTerm === '' ||
                                                s.customer?.client_name?.includes(searchTerm) ||
                                                s.serialNumber?.includes(searchTerm) ||
                                                s.customer?.bkcode?.includes(searchTerm)
                                            ).map((sale: any) => (
                                                <tr key={sale.id} className="group hover:bg-slate-50/50 transition-colors">
                                                    <td className="p-6">
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-black text-slate-900">{new Date(sale.saleDate).toLocaleDateString('ar-EG')}</span>
                                                            <span className="text-[10px] font-bold text-slate-400 font-mono">{new Date(sale.saleDate).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-6">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-slate-900 group-hover:text-white transition-all">
                                                                <User size={20} strokeWidth={2.5} />
                                                            </div>
                                                            <div className="flex flex-col text-right">
                                                                <span className="text-sm font-black text-slate-900">{sale.customer?.client_name || sale.customerId}</span>
                                                                <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md w-fit mt-1 tracking-widest">{sale.customer?.bkcode}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-6">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center border border-blue-100">
                                                                <Hash size={20} strokeWidth={3} />
                                                            </div>
                                                            <span className="text-sm font-black text-slate-900 font-mono tracking-tighter">{sale.serialNumber}</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-6">
                                                        <div className={cn(
                                                            "px-4 py-2 rounded-2xl text-[11px] font-black text-center border w-fit",
                                                            sale.type === 'CASH'
                                                                ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                                                : "bg-purple-50 text-purple-700 border-purple-100"
                                                        )}>
                                                            {sale.type === 'CASH' ? 'دفع نقدي (Cash)' : `تقسيط شهري (${sale.installments?.length || 0})`}
                                                        </div>
                                                    </td>
                                                    <td className="p-6">
                                                        <div className="flex items-center justify-center gap-4">
                                                            <div className="flex flex-col items-center">
                                                                <span className="text-[9px] font-black text-slate-300 uppercase leading-none mb-1">الإجمالي</span>
                                                                <span className="text-sm font-black text-slate-900 font-mono tracking-tighter">{sale.totalPrice?.toLocaleString()}</span>
                                                            </div>
                                                            <div className="w-px h-8 bg-slate-100" />
                                                            <div className="flex flex-col items-center">
                                                                <span className="text-[9px] font-black text-emerald-400 uppercase leading-none mb-1">المدفوع</span>
                                                                <span className="text-sm font-black text-emerald-600 font-mono tracking-tighter">{sale.paidAmount?.toLocaleString()}</span>
                                                            </div>
                                                            {sale.totalPrice - sale.paidAmount > 0 && (
                                                                <>
                                                                    <div className="w-px h-8 bg-slate-100" />
                                                                    <div className="flex flex-col items-center">
                                                                        <span className="text-[9px] font-black text-red-400 uppercase leading-none mb-1">المستحق</span>
                                                                        <span className="text-sm font-black text-red-600 font-mono tracking-tighter">{(sale.totalPrice - sale.paidAmount).toLocaleString()}</span>
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="p-6">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <button
                                                                onClick={() => openSaleReport({ sale, installments: sale.installments || [] })}
                                                                className="w-10 h-10 bg-white border border-slate-100 text-slate-400 hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50 rounded-xl transition-all flex items-center justify-center shadow-sm"
                                                                title="طباعة عقد البيع"
                                                            >
                                                                <Printer size={18} strokeWidth={2.5} />
                                                            </button>
                                                            {sale.type === 'INSTALLMENT' && (
                                                                <button
                                                                    onClick={() => openEditModal(sale)}
                                                                    className="w-10 h-10 bg-white border border-slate-100 text-slate-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 rounded-xl transition-all flex items-center justify-center shadow-sm"
                                                                    title="تعديل الأقساط"
                                                                >
                                                                    <Edit3 size={18} strokeWidth={2.5} />
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => setConfirmDelete({ isOpen: true, saleId: sale.id, serial: sale.serialNumber })}
                                                                className="w-10 h-10 bg-white border border-slate-100 text-slate-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 rounded-xl transition-all flex items-center justify-center shadow-sm"
                                                                title="إبطال العملية"
                                                            >
                                                                <Trash2 size={18} strokeWidth={2.5} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'INSTALLMENTS' && (
                        <div className="space-y-8">
                            {/* Toolbar for Installments */}
                            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 px-2">
                                <div className="lg:col-span-2 relative group">
                                    <Search className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-slate-900 transition-colors" size={20} />
                                    <input
                                        type="text"
                                        placeholder="ابحث بالعميل، السيريال، الكود، أو وصف القسط..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full h-14 pr-16 pl-8 bg-white border-2 border-slate-100 rounded-2xl text-sm font-bold focus:border-slate-900 transition-all outline-none shadow-sm text-right"
                                    />
                                </div>

                                <div className="flex items-center gap-4 bg-white border-2 border-slate-100 px-6 rounded-2xl shadow-sm h-14">
                                    <Filter size={18} className="text-slate-400" />
                                    <label className="flex items-center gap-3 cursor-pointer select-none w-full">
                                        <input
                                            type="checkbox"
                                            checked={filterOverdue}
                                            onChange={(e) => setFilterOverdue(e.target.checked)}
                                            className="w-5 h-5 rounded-lg accent-slate-900"
                                        />
                                        <span className="text-sm font-black text-slate-700">المتأخرات حصراً</span>
                                    </label>
                                </div>

                                <div className="flex items-center gap-4 bg-white border-2 border-slate-100 px-6 rounded-2xl shadow-sm h-14">
                                    <Layers size={18} className="text-slate-400" />
                                    <select
                                        value={groupBy}
                                        onChange={(e) => setGroupBy(e.target.value as any)}
                                        className="bg-transparent border-none text-sm font-black text-slate-700 w-full focus:ring-0 outline-none cursor-pointer"
                                    >
                                        <option value="none">بدون تجميع (سرد كامل)</option>
                                        <option value="customer">تجميع حسب العميل</option>
                                        <option value="month">تجميع حسب الشهر</option>
                                    </select>
                                </div>
                            </div>

                            {/* Installments Content */}
                            <AnimatePresence mode="wait">
                                {groupBy === 'none' ? (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                                        className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/50 border border-slate-100 overflow-hidden"
                                    >
                                        <div className="overflow-x-auto custom-scroll">
                                            <table className="w-full text-right border-collapse">
                                                <thead>
                                                    <tr className="bg-slate-50/50 border-b border-slate-100">
                                                        <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">تاريخ الاستحقاق</th>
                                                        <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">المستفيد المسجل</th>
                                                        <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">القسط المعني</th>
                                                        <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">المبلغ المستحق</th>
                                                        <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">حالة السداد</th>
                                                        <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">تحصيل</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-50">
                                                    {installmentsLoading ? (
                                                        <tr><td colSpan={6} className="p-20 text-center text-slate-400 font-bold animate-pulse">جاري استخراج كشوف الأقساط...</td></tr>
                                                    ) : filteredInstallments.length === 0 ? (
                                                        <tr><td colSpan={6} className="p-20 text-center text-slate-400 font-bold">لا توجد أقساط مطابقة للبحث</td></tr>
                                                    ) : filteredInstallments.map((inst: any) => {
                                                        const isOverdue = !inst.isPaid && new Date(inst.dueDate) < new Date();
                                                        return (
                                                            <tr key={inst.id} className={cn("group transition-colors", isOverdue ? "bg-red-50/10" : "hover:bg-slate-50/50")}>
                                                                <td className="p-6">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center border", isOverdue ? "bg-red-50 text-red-600 border-red-100 shadow-lg shadow-red-100/50" : "bg-slate-50 text-slate-400 border-slate-100")}>
                                                                            <Calendar size={18} strokeWidth={2.5} />
                                                                        </div>
                                                                        <span className={cn("text-sm font-black font-mono tracking-tighter", isOverdue ? "text-red-700" : "text-slate-900")}>
                                                                            {new Date(inst.dueDate).toLocaleDateString('ar-EG')}
                                                                        </span>
                                                                    </div>
                                                                </td>
                                                                <td className="p-6">
                                                                    <div className="flex flex-col">
                                                                        <span className="text-sm font-black text-slate-900">{inst.sale?.customer?.client_name}</span>
                                                                        <div className="flex items-center gap-2 mt-1">
                                                                            <span className="text-[10px] font-black text-slate-400 font-mono tracking-widest">{inst.sale?.customer?.bkcode}</span>
                                                                            <span className="w-1 h-1 rounded-full bg-slate-200" />
                                                                            <span className="text-[10px] font-black text-blue-500 font-mono tracking-tighter">{inst.sale?.serialNumber}</span>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className="p-6">
                                                                    <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-lg">{inst.description}</span>
                                                                </td>
                                                                <td className="p-6 text-center">
                                                                    <span className="text-base font-black text-slate-900 font-mono tracking-tighter">{inst.amount?.toLocaleString()} <span className="text-[9px] text-slate-400 ml-1">ج.م</span></span>
                                                                </td>
                                                                <td className="p-6 text-center">
                                                                    <div className="flex justify-center">
                                                                        {inst.isPaid ? (
                                                                            <div className="bg-emerald-50 text-emerald-600 px-4 py-1.5 rounded-2xl flex items-center gap-2 border border-emerald-100">
                                                                                <CheckCircle size={14} strokeWidth={3} />
                                                                                <span className="text-[10px] font-black uppercase tracking-widest">معتمد بالكامل</span>
                                                                            </div>
                                                                        ) : isOverdue ? (
                                                                            <div className="bg-red-50 text-red-600 px-4 py-1.5 rounded-2xl flex items-center gap-2 border border-red-100 animate-pulse shadow-lg shadow-red-100/50">
                                                                                <AlertCircle size={14} strokeWidth={3} />
                                                                                <span className="text-[10px] font-black uppercase tracking-widest">تجاوز المهلة</span>
                                                                            </div>
                                                                        ) : (
                                                                            <div className="bg-blue-50 text-blue-600 px-4 py-1.5 rounded-2xl flex items-center gap-2 border border-blue-100">
                                                                                <Clock size={14} strokeWidth={3} />
                                                                                <span className="text-[10px] font-black uppercase tracking-widest">بانتظار التحصيل</span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td className="p-6">
                                                                    <div className="flex justify-center">
                                                                        {!inst.isPaid && (
                                                                            <button
                                                                                onClick={() => handlePayClick(inst)}
                                                                                className="h-10 px-6 bg-slate-900 text-white text-[10px] font-black rounded-xl hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10 active:scale-95 flex items-center gap-2"
                                                                            >
                                                                                <DollarSign size={14} strokeWidth={3} />
                                                                                تأكيد التحصيل
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </motion.div>
                                ) : (
                                    <div className="space-y-10">
                                        {Object.entries(groupedInstallments).map(([groupKey, groupInsts]: [string, any], idx: number) => {
                                            const totalAmount = groupInsts.reduce((sum: number, i: any) => sum + i.amount, 0);
                                            const paidAmount = groupInsts.filter((i: any) => i.isPaid).reduce((sum: number, i: any) => sum + i.amount, 0);
                                            const overdueCount = groupInsts.filter((i: any) => !i.isPaid && new Date(i.dueDate) < new Date()).length;

                                            return (
                                                <motion.div
                                                    key={groupKey}
                                                    initial={{ opacity: 0, x: -20 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: idx * 0.05 }}
                                                    className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden"
                                                >
                                                    <div className="bg-slate-50/80 px-8 py-6 flex flex-col sm:flex-row justify-between items-center border-b border-slate-100 backdrop-blur-sm">
                                                        <div className="flex items-center gap-4">
                                                            <div className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100 text-slate-900">
                                                                {groupBy === 'customer' ? <User size={24} /> : <Calendar size={24} />}
                                                            </div>
                                                            <div className="text-right">
                                                                <h3 className="text-lg font-black text-slate-900 tracking-tight">{groupKey}</h3>
                                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">عدد الوحدات: {groupInsts.length}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-wrap gap-8">
                                                            <div className="flex flex-col items-end">
                                                                <span className="text-[9px] font-black text-slate-300 uppercase leading-none mb-1">إجمالي قيمة المجموعة</span>
                                                                <span className="text-lg font-black text-slate-900 font-mono">{totalAmount.toLocaleString()}</span>
                                                            </div>
                                                            <div className="flex flex-col items-end">
                                                                <span className="text-[9px] font-black text-emerald-400 uppercase leading-none mb-1">المحصل</span>
                                                                <span className="text-lg font-black text-emerald-600 font-mono">+{paidAmount.toLocaleString()}</span>
                                                            </div>
                                                            <div className="flex flex-col items-end">
                                                                <span className="text-[9px] font-black text-red-400 uppercase leading-none mb-1">المتبقي</span>
                                                                <span className="text-lg font-black text-red-600 font-mono">{(totalAmount - paidAmount).toLocaleString()}</span>
                                                            </div>
                                                            {overdueCount > 0 && (
                                                                <div className="bg-red-600 text-white px-4 py-2 rounded-2xl flex flex-col items-center justify-center shadow-lg shadow-red-200">
                                                                    <span className="text-[11px] font-black">{overdueCount}</span>
                                                                    <span className="text-[7px] font-black uppercase tracking-widest">متأخر</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="overflow-x-auto">
                                                        <table className="w-full text-right border-collapse">
                                                            <tbody className="divide-y divide-slate-50">
                                                                {groupInsts.map((inst: any) => {
                                                                    const isOverdue = !inst.isPaid && new Date(inst.dueDate) < new Date();
                                                                    return (
                                                                        <tr key={inst.id} className={cn("group hover:bg-slate-50/50 transition-colors", isOverdue ? "bg-red-50/5" : "")}>
                                                                            <td className="p-5 w-40">
                                                                                <span className={cn("text-xs font-black font-mono tracking-tighter", isOverdue ? "text-red-600" : "text-slate-500")}>
                                                                                    {new Date(inst.dueDate).toLocaleDateString('ar-EG')}
                                                                                </span>
                                                                            </td>
                                                                            {groupBy === 'month' && (
                                                                                <td className="p-5">
                                                                                    <div className="flex items-center gap-3">
                                                                                        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400"><User size={16} /></div>
                                                                                        <div className="flex flex-col">
                                                                                            <span className="text-sm font-black text-slate-900">{inst.sale?.customer?.client_name}</span>
                                                                                            <span className="text-[9px] font-black text-blue-500 font-mono">{inst.sale?.serialNumber}</span>
                                                                                        </div>
                                                                                    </div>
                                                                                </td>
                                                                            )}
                                                                            <td className="p-5">
                                                                                <div className="flex items-center gap-3">
                                                                                    <span className="text-[10px] font-black text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">{inst.description}</span>
                                                                                    {groupBy === 'customer' && <span className="text-[10px] font-black text-blue-400 font-mono tracking-widest">{inst.sale?.serialNumber}</span>}
                                                                                </div>
                                                                            </td>
                                                                            <td className="p-5 text-center w-32">
                                                                                <span className="text-sm font-black text-slate-900 font-mono tracking-tighter">{inst.amount?.toLocaleString()}</span>
                                                                            </td>
                                                                            <td className="p-5 text-center w-32">
                                                                                {inst.isPaid ? (
                                                                                    <span className="text-emerald-500"><CheckCircle size={18} className="mx-auto" strokeWidth={3} /></span>
                                                                                ) : isOverdue ? (
                                                                                    <span className="text-red-500 animate-pulse"><AlertCircle size={18} className="mx-auto" strokeWidth={3} /></span>
                                                                                ) : (
                                                                                    <span className="text-slate-300"><Clock size={18} className="mx-auto" /></span>
                                                                                )}
                                                                            </td>
                                                                            <td className="p-5 w-28">
                                                                                {!inst.isPaid && (
                                                                                    <button
                                                                                        onClick={() => handlePayClick(inst)}
                                                                                        className="smart-btn-primary h-9 px-4 text-[9px] bg-slate-900 hover:bg-slate-800 rounded-lg shadow-none"
                                                                                    >
                                                                                        تسوية الحساب
                                                                                    </button>
                                                                                )}
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </motion.div>
                                            );
                                        })}
                                    </div>
                                )}
                            </AnimatePresence>
                        </div>
                    )}
                </motion.div>
            </AnimatePresence>

            {/* Premium Confirm Dialog for Deletion */}
            <ConfirmDialog
                isOpen={!!confirmDelete}
                title="إلغاء وإبطال عملية البيع"
                message={`هل أنت متأكد من إلغاء عملية بيع الماكينة (${confirmDelete?.serial})؟ تنبيه: سيتم حذف جميع الحسابات والأقساط والإيصالات واسترجاع الماكينة للمخزن بحالتها الأصلية.`}
                confirmText="إبطال العملية فوراً"
                cancelText="تراجع - احتفظ بالسجل"
                onConfirm={() => deleteSaleMutation.mutate(confirmDelete!.saleId)}
                onCancel={() => setConfirmDelete(null)}
            />

            {/* Payment Modal with Premium Industrial Styling */}
            <Dialog open={paymentModalOpen} onOpenChange={(open) => !open && setPaymentModalOpen(false)}>
                <DialogContent className="p-0 border-0 flex flex-col max-h-[96vh] h-auto overflow-hidden sm:max-w-xl rounded-[3rem] shadow-3xl bg-white text-right" dir="rtl">
                    <div className="modal-header bg-gradient-to-br from-slate-900 to-slate-800 p-8 text-white relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                            <div className="absolute top-[-50%] right-[-20%] w-[100%] h-[200%] bg-white rounded-full blur-[100px]" />
                        </div>
                        <div className="flex items-center gap-5 relative z-10">
                            <div className="p-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-xl">
                                <DollarSign size={28} strokeWidth={3} />
                            </div>
                            <div className="text-right">
                                <DialogTitle className="text-2xl font-black leading-tight tracking-tight">سداد قسط مستحق</DialogTitle>
                                <DialogDescription className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.2em] mt-1">تأكيد استلام الدفعة النقدية</DialogDescription>
                            </div>
                        </div>
                    </div>

                    <div className="p-8 space-y-8 overflow-y-auto custom-scroll">
                        {payingInstallment && (
                            <div className="bg-blue-50/50 border-2 border-dashed border-blue-200 rounded-[2rem] p-6 flex items-center justify-between">
                                <div className="text-right">
                                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest block mb-1">القسط المستهدف</span>
                                    <h4 className="text-base font-black text-blue-900">{payingInstallment.description}</h4>
                                    <p className="text-sm font-bold text-blue-600 mt-1">{payingInstallment.sale?.customer?.client_name}</p>
                                </div>
                                <div className="text-left font-mono">
                                    <span className="text-2xl font-black text-blue-700">{payingInstallment.amount?.toLocaleString()}</span>
                                    <span className="text-[10px] font-black text-blue-400 ml-2 uppercase">ج.م</span>
                                </div>
                            </div>
                        )}

                        <PaymentFields
                            data={paymentForm.data}
                            onChange={paymentForm.updateField}
                            onReceiptBlur={checkReceiptNumber}
                            receiptExists={receiptExists}
                            receiptChecking={receiptChecking}
                        />

                        <div className="bg-amber-50 rounded-2xl p-4 flex gap-4 text-amber-800 font-bold text-xs border border-amber-100">
                            <AlertCircle size={18} className="shrink-0" />
                            <p>يرجى التأكد من تطابق رقم الإيصال اليدوي مع الرقم المدخل في النظام لضمان دقة التقارير المالية.</p>
                        </div>
                    </div>

                    <div className="p-8 bg-slate-50/50 border-t border-slate-100 flex items-center gap-4">
                        <button onClick={() => setPaymentModalOpen(false)} className="smart-btn-secondary h-14 px-8 border-2">إلغاء</button>
                        <button
                            disabled={!paymentForm.isValid || payMutation.isPending || receiptExists}
                            onClick={() => payMutation.mutate({
                                id: payingInstallment.id,
                                amount: paymentForm.data.amount,
                                receiptNumber: paymentForm.data.receiptNumber,
                                paymentPlace: paymentForm.data.paymentPlace
                            })}
                            className={cn(
                                "flex-1 h-14 rounded-2xl font-black text-base shadow-2xl transition-all flex items-center justify-center gap-3",
                                (paymentForm.isValid && !receiptExists) ? "bg-slate-900 text-white shadow-slate-900/20" : "bg-slate-100 text-slate-300 pointer-events-none"
                            )}
                        >
                            {payMutation.isPending ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircle size={20} strokeWidth={3} />}
                            {payMutation.isPending ? 'جاري معالجة الدفع...' : 'تأكيد السداد والتحصيل'}
                        </button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Recalculate Modal with Premium Styling */}
            <Dialog open={editModalOpen} onOpenChange={(open) => !open && setEditModalOpen(false)}>
                <DialogContent className="p-0 border-0 flex flex-col max-h-[96vh] h-auto overflow-hidden sm:max-w-xl rounded-[3rem] shadow-3xl bg-white text-right" dir="rtl">
                    <div className="modal-header bg-gradient-to-br from-blue-700 to-indigo-800 p-8 text-white relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                            <div className="absolute bottom-[-50%] left-[-20%] w-[100%] h-[200%] bg-white rounded-full blur-[100px]" />
                        </div>
                        <div className="flex items-center gap-5 relative z-10">
                            <div className="p-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-xl">
                                <Settings2 size={28} strokeWidth={3} />
                            </div>
                            <div className="text-right">
                                <DialogTitle className="text-2xl font-black leading-tight tracking-tight">إعادة جدولة الأقساط</DialogTitle>
                                <DialogDescription className="text-blue-100 font-bold text-[10px] uppercase tracking-[0.2em] mt-1">تعديل فترات وجدولة مديونيات البيع</DialogDescription>
                            </div>
                        </div>
                    </div>

                    <div className="p-8 space-y-8 overflow-y-auto custom-scroll">
                        {editingSale && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">السيريال المستهدف</span>
                                        <span className="text-sm font-black text-slate-900 font-mono italic">{editingSale.serialNumber}</span>
                                    </div>
                                    <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">المستحق القائم</span>
                                        <span className="text-sm font-black text-red-600 font-mono">{(editingSale.totalPrice - editingSale.paidAmount).toLocaleString()} ج.م</span>
                                    </div>
                                </div>
                                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">العميل المسجل</span>
                                    <span className="text-sm font-black text-slate-900">{editingSale.customer?.client_name}</span>
                                </div>
                            </div>
                        )}

                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-3 leading-none block">عدد الأشهر الجديدة (فترة التقسيط)</label>
                            <div className="grid grid-cols-4 gap-3">
                                {[3, 6, 9, 12, 18, 24, 36].map(n => (
                                    <button
                                        key={n}
                                        type="button"
                                        onClick={() => setNewInstallmentCount(n)}
                                        className={cn(
                                            "h-14 rounded-2xl font-black text-sm border-2 transition-all active:scale-95",
                                            newInstallmentCount === n
                                                ? "bg-blue-900 border-blue-900 text-white shadow-xl shadow-blue-900/20"
                                                : "bg-white border-slate-100 text-slate-400 hover:border-slate-300"
                                        )}
                                    >
                                        {n} شهر
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="bg-slate-900 text-slate-400 p-6 rounded-[2rem] space-y-2 relative overflow-hidden group shadow-2xl">
                            <div className="absolute right-[-20%] bottom-[-20%] w-40 h-40 bg-white/5 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000" />
                            <div className="flex items-center gap-3 text-white mb-2 relative z-10">
                                <Info size={16} strokeWidth={3} />
                                <span className="text-xs font-black uppercase tracking-widest">ملاحظة بروتوكول النظام</span>
                            </div>
                            <p className="text-[11px] leading-relaxed font-bold relative z-10">
                                عملية إعادة الجدولة ستقوم بحذف كافة الأقساط <span className="text-white">الغير مدفوعة</span> حالياً وتوزيع المبالغ المتبقية على الأشهر الجديدة المختارة بالتساوي من تاريخ اليوم.
                            </p>
                        </div>
                    </div>

                    <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-4">
                        <button onClick={() => setEditModalOpen(false)} className="smart-btn-secondary h-14 px-8 border-2">إلغاء</button>
                        <button
                            disabled={recalculateMutation.isPending}
                            onClick={() => recalculateMutation.mutate({ saleId: editingSale.id, newCount: newInstallmentCount })}
                            className="flex-1 h-14 bg-slate-900 text-white rounded-2xl font-black flex items-center justify-center gap-3 shadow-2xl shadow-slate-900/20 hover:bg-slate-800 transition-all active:scale-95"
                        >
                            {recalculateMutation.isPending ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <RotateCcw size={20} strokeWidth={3} />}
                            إعادة الجدولة واعتماد التغيير
                        </button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
