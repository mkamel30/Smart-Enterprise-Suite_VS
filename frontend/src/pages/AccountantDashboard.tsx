import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import {
    DollarSign,
    CreditCard,
    TrendingUp,
    Calendar,
    Filter,
    Download,
    Receipt,
    ShoppingBag,
    ShoppingCart,
    Wrench,
    Smartphone,
    Activity,
    PieChart,
    BarChart,
    FileText as FileTextIcon,
    Search,
    ArrowUp,
    ArrowDown,
    ArrowUpDown
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';
import {
    PieChart as RechartsPie,
    Pie,
    Cell,
    ResponsiveContainer,
    Tooltip as RechartsTooltip,
    Legend,
    BarChart as RechartsBar,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid
} from 'recharts';
import * as XLSX from 'xlsx';

// Constants
const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444'];
const SOURCE_LABELS: Record<string, string> = {
    'Machine Sale': 'مبيعات ماكينات',
    'Maintenance/General': 'صيانة / عام',
    'Spare Parts': 'قطع غيار',
    'Sim Sales': 'مبيعات شرائح'
};

export default function AccountantDashboard() {
    const [dateRange, setDateRange] = useState<{ start: string; end: string }>(() => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const end = new Date().toISOString().split('T')[0];
        return { start, end };
    });
    const [selectedBranch, setSelectedBranch] = useState<string>('');
    const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'reports'>('dashboard');

    // Parts Report Filters & Sort
    const [partsSearchQuery, setPartsSearchQuery] = useState('');
    const [partsTypeFilter, setPartsTypeFilter] = useState('all');
    const [partsSortConfig, setPartsSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

    // Transactions Report Filters & Sort
    const [transSearchQuery, setTransSearchQuery] = useState('');
    const [transTypeFilter, setTransTypeFilter] = useState('all');
    const [transSortConfig, setTransSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

    // Installments Report Filters & Sort
    const [instSearchQuery, setInstSearchQuery] = useState('');
    const [instSortConfig, setInstSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

    // Sales Report Filters & Sort
    const [salesSearchQuery, setSalesSearchQuery] = useState('');
    const [salesTypeFilter, setSalesTypeFilter] = useState('all');
    const [salesSortConfig, setSalesSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

    // Sorting Helper
    const handleSort = (key: string, currentSortConfig: any, setSortConfig: any) => {
        if (currentSortConfig && currentSortConfig.key === key) {
            setSortConfig({ key, direction: currentSortConfig.direction === 'asc' ? 'desc' : 'asc' });
        } else {
            setSortConfig({ key, direction: 'asc' });
        }
    };

    const SortIcon = ({ columnKey, sortConfig }: { columnKey: string, sortConfig: any }) => {
        if (!sortConfig || sortConfig.key !== columnKey) return <ArrowUpDown size={12} className="inline opacity-30 mr-1" />;
        return sortConfig.direction === 'asc'
            ? <ArrowUp size={12} className="inline text-emerald-500 mr-1" />
            : <ArrowDown size={12} className="inline text-emerald-500 mr-1" />;
    };

    // === Queries ===

    // 1. Branches List
    const { data: branches } = useQuery<any>({
        queryKey: ['authorized-branches'],
        queryFn: () => api.getAuthorizedBranches()
    });

    // 2. Dashboard Stats
    const { data: stats, isLoading: statsLoading } = useQuery<any>({
        queryKey: ['finance-stats', dateRange, selectedBranch],
        queryFn: () => {
            const params = new URLSearchParams({
                startDate: dateRange.start,
                endDate: dateRange.end,
                ...(selectedBranch && { branchId: selectedBranch })
            });
            return api.get(`/finance/dashboard-stats?${params.toString()}`);
        }
    });

    // 3. Transactions List
    const { data: transactions, isLoading: transLoading } = useQuery<any>({
        queryKey: ['finance-transactions', dateRange, selectedBranch],
        queryFn: () => {
            const params = new URLSearchParams({
                startDate: dateRange.start,
                endDate: dateRange.end,
                limit: '200',
                ...(selectedBranch && { branchId: selectedBranch })
            });
            return api.get(`/finance/transactions?${params.toString()}`);
        }
    });

    // 4. Parts Usage Report
    const { data: partsReport, isLoading: partsLoading } = useQuery<any>({
        queryKey: ['parts-usage-report', dateRange, selectedBranch],
        queryFn: () => {
            const params = new URLSearchParams({
                startDate: dateRange.start,
                endDate: dateRange.end,
                ...(selectedBranch && { branchId: selectedBranch })
            });
            return api.get(`/finance/stats/parts-usage?${params.toString()}`);
        },
        enabled: activeTab === 'reports'
    });

    // 5. Installments Report
    const { data: installmentsReport, isLoading: installLoading } = useQuery<any>({
        queryKey: ['installments-report', selectedBranch],
        queryFn: () => {
            const params = new URLSearchParams({
                ...(selectedBranch && { branchId: selectedBranch })
            });
            return api.get(`/finance/stats/installments?${params.toString()}`);
        },
        enabled: activeTab === 'reports'
    });

    // 6. Sales Report
    const { data: salesReport, isLoading: salesLoading } = useQuery<any>({
        queryKey: ['sales-report', selectedBranch, dateRange],
        queryFn: () => {
            const params = new URLSearchParams({
                ...(selectedBranch && { branchId: selectedBranch }),
                startDate: new Date(dateRange.start).toISOString(),
                endDate: new Date(dateRange.end).toISOString()
            });
            return api.get(`/finance/stats/sales-report?${params.toString()}`);
        },
        enabled: activeTab === 'reports'
    });

    // === Derived Data for Charts ===

    const revenueSourceData = useMemo(() => {
        if (!stats) return [];
        return [
            { name: 'مبيعات ماكينات', value: stats.machineSalesRevenue },
            { name: 'صيانة / عام', value: stats.maintenanceRevenue },
            { name: 'قطع غيار', value: stats.partsRevenue }
        ].filter(item => item.value > 0);
    }, [stats]);

    const filteredPartsReport = useMemo(() => {
        if (!partsReport) return [];
        const filtered = partsReport.filter((part: any) => {
            const matchesSearch =
                (part.partName && part.partName.toLowerCase().includes(partsSearchQuery.toLowerCase())) ||
                (part.client && part.client.toLowerCase().includes(partsSearchQuery.toLowerCase())) ||
                (part.receiptNumber && part.receiptNumber.toString().toLowerCase().includes(partsSearchQuery.toLowerCase()));

            const matchesType = partsTypeFilter === 'all' || part.type === partsTypeFilter;

            return matchesSearch && matchesType;
        });

        if (partsSortConfig) {
            filtered.sort((a: any, b: any) => {
                const aVal = a[partsSortConfig.key];
                const bVal = b[partsSortConfig.key];
                if (aVal < bVal) return partsSortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return partsSortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return filtered;
    }, [partsReport, partsSearchQuery, partsTypeFilter, partsSortConfig]);

    const filteredTransactions = useMemo(() => {
        if (!transactions) return [];
        const filtered = transactions.filter((t: any) => {
            const matchesSearch =
                (t.client && t.client.toLowerCase().includes(transSearchQuery.toLowerCase())) ||
                (t.details && t.details.toLowerCase().includes(transSearchQuery.toLowerCase())) ||
                (t.amount && t.amount.toString().includes(transSearchQuery));

            const categoryMatch = transTypeFilter === 'all' || t.category === transTypeFilter || t.type === transTypeFilter || (transTypeFilter === 'PAID' && t.status === 'PAID') || (transTypeFilter === 'FREE' && t.status === 'FREE');
            return matchesSearch && categoryMatch;
        });

        if (transSortConfig) {
            filtered.sort((a: any, b: any) => {
                let aVal = a[transSortConfig.key];
                let bVal = b[transSortConfig.key];

                if (transSortConfig.key === 'category') {
                    aVal = SOURCE_LABELS[a.category] || a.category;
                    bVal = SOURCE_LABELS[b.category] || b.category;
                }

                if (aVal < bVal) return transSortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return transSortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return filtered;
    }, [transactions, transSearchQuery, transTypeFilter, transSortConfig]);

    const filteredInstallments = useMemo(() => {
        if (!installmentsReport || !installmentsReport.branchPerformance) return [];
        const filtered = installmentsReport.branchPerformance.filter((b: any) => {
            return b.name.toLowerCase().includes(instSearchQuery.toLowerCase());
        });

        if (instSortConfig) {
            filtered.sort((a: any, b: any) => {
                const aVal = a[instSortConfig.key];
                const bVal = b[instSortConfig.key];
                if (aVal < bVal) return instSortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return instSortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return filtered;
    }, [installmentsReport, instSearchQuery, instSortConfig]);

    const filteredSalesReport = useMemo(() => {
        if (!salesReport) return [];
        const filtered = salesReport.filter((s: any) => {
            const matchesSearch =
                (s.client && s.client.toLowerCase().includes(salesSearchQuery.toLowerCase())) ||
                (s.clientBkcode && s.clientBkcode.toLowerCase().includes(salesSearchQuery.toLowerCase())) ||
                (s.machineSerial && s.machineSerial.toLowerCase().includes(salesSearchQuery.toLowerCase())) ||
                (s.receiptNumber && s.receiptNumber.toString().toLowerCase().includes(salesSearchQuery.toLowerCase()));

            const matchesType = salesTypeFilter === 'all' || s.type === salesTypeFilter;

            return matchesSearch && matchesType;
        });

        if (salesSortConfig) {
            filtered.sort((a: any, b: any) => {
                const aVal = a[salesSortConfig.key];
                const bVal = b[salesSortConfig.key];
                if (aVal < bVal) return salesSortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return salesSortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return filtered;
    }, [salesReport, salesSearchQuery, salesTypeFilter, salesSortConfig]);

    // === Handlers ===

    const handleExport = (data: any[], filename: string) => {
        let exportData = data;

        // Custom mapping for Spare Parts report to ensure Arabic headers and inclusion of receipt number
        if (filename === 'Spare_Parts_Usage_Report') {
            exportData = data.map(item => ({
                'التارِيخ': new Date(item.date).toLocaleDateString('ar-EG'),
                'الفرع': item.branch,
                'قطعة الغيار': item.partName,
                'العميل': item.client,
                'الكمية': item.quantity,
                'سعر الوحدة': item.unitCost,
                'إجمالي القيمة': item.totalValue,
                'نوع الصرف': item.type,
                'رقم ايصال السداد': item.receiptNumber || '-',
                'حالة العائد': item.revenueStatus
            }));
        } else if (filename === 'Financial_Transactions') {
            exportData = data.map(item => ({
                'التارِيخ': new Date(item.date).toLocaleDateString('ar-EG'),
                'الفرع': item.branch,
                'نوع العملية': SOURCE_LABELS[item.category] || item.category,
                'العميل': item.client,
                'التفاصيل': item.details,
                'المبلغ': item.amount,
                'الحالة': item.status === 'PAID' ? 'تم الدفع' : (item.status === 'FREE' ? 'مجاني' : 'جزئي')
            }));
        }

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
        XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    // === Custom Components ===
    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white/95 backdrop-blur-md p-4 rounded-2xl border border-slate-100 shadow-2xl animate-in zoom-in-95 duration-200">
                    <p className="text-[10px] uppercase tracking-wider font-black text-slate-400 mb-1">{payload[0].name}</p>
                    <div className="flex items-baseline gap-1">
                        <span className="text-lg font-black text-slate-900 font-mono tracking-tight">{payload[0].value.toLocaleString()}</span>
                        <span className="text-[10px] font-bold text-slate-500 underline underline-offset-4 decoration-slate-200">ج.م</span>
                    </div>
                </div>
            );
        }
        return null;
    };

    // === Renderers ===

    const StatCard = ({ title, value, sub, icon: Icon, color }: any) => (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`bg-white rounded-[2rem] p-6 border-2 border-${color}-50 hover:border-${color}-100 transition-all shadow-sm hover:shadow-xl group`}
        >
            <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-2xl bg-${color}-50 text-${color}-600 group-hover:scale-110 transition-transform`}>
                    <Icon size={24} strokeWidth={2.5} />
                </div>
            </div>
            <p className="text-slate-400 font-bold text-[10px] uppercase tracking-wider mb-1">{title}</p>
            <div className="flex items-baseline gap-1">
                <h3 className="text-2xl font-black text-slate-900 font-mono tracking-tight">{(value || 0).toLocaleString()}</h3>
                <span className="text-[10px] font-bold text-slate-400">ج.م</span>
            </div>
            {sub && <p className="text-[10px] font-bold text-slate-400 mt-2">{sub}</p>}
        </motion.div>
    );

    return (
        <div className="page-container space-y-8 bg-slate-50/50 min-h-screen px-8 py-6" dir="rtl">
            <PageHeader
                title="لوحة القيادة المالية"
                subtitle="مركز التحكم المالي ومتابعة الإيرادات والمصروفات"
                icon={<Activity size={28} className="text-emerald-600" />}
                actions={
                    <div className="flex flex-wrap gap-3 items-center bg-white p-2 rounded-2xl border border-slate-100 shadow-sm">
                        <div className="flex items-center gap-2 px-2">
                            <Calendar size={16} className="text-slate-400" />
                            <input
                                type="date"
                                value={dateRange.start}
                                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                                className="text-xs font-bold border-none outline-none bg-transparent w-24"
                            />
                            <span className="text-slate-300">-</span>
                            <input
                                type="date"
                                value={dateRange.end}
                                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                                className="text-xs font-bold border-none outline-none bg-transparent w-24"
                            />
                        </div>
                        <div className="h-6 w-px bg-slate-100 mx-2"></div>
                        <select
                            value={selectedBranch}
                            onChange={(e) => setSelectedBranch(e.target.value)}
                            className="text-xs font-bold border-none outline-none bg-transparent pr-8 pl-4 py-2 cursor-pointer"
                        >
                            <option value="">كل الفروع</option>
                            {branches?.map((b: any) => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                    </div>
                }
            />

            {/* Tabs */}
            <div className="flex gap-2 border-b border-slate-200/60 pb-1">
                {[
                    { id: 'dashboard', label: 'نظرة عامة', icon: PieChart },
                    { id: 'transactions', label: 'سجل العمليات', icon: FileTextIcon },
                    { id: 'reports', label: 'تقارير تفصيلية', icon: BarChart }
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={cn(
                            "px-6 py-3 rounded-t-2xl flex items-center gap-2 font-bold text-sm transition-all relative top-[1px]",
                            activeTab === tab.id
                                ? "bg-white text-primary border-t-2 border-x-2 border-slate-200/60 border-b-white shadow-sm"
                                : "text-slate-500 hover:text-slate-700 hover:bg-slate-100/50"
                        )}
                    >
                        <tab.icon size={16} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="min-h-[500px]">
                {activeTab === 'dashboard' && (
                    <div className="space-y-8 animate-fade-in">
                        {/* KPI Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <StatCard
                                title="إجمالي الدخل المحقق"
                                value={stats?.totalIncome}
                                icon={DollarSign}
                                color="emerald"
                                sub="النقدية الفعلية المستلمة"
                            />
                            <StatCard
                                title="مبيعات الماكينات (نقد)"
                                value={stats?.machineSalesRevenue}
                                icon={ShoppingBag}
                                color="blue"
                                sub="شامل المقدمات والأقساط المدفوعة"
                            />
                            <StatCard
                                title="أقساط قيد التحصيل"
                                value={stats?.pendingInstallments}
                                icon={CreditCard}
                                color="orange"
                                sub="مبالغ مستحقة آجلة"
                            />
                            <StatCard
                                title="قيمة قطع الغيار المباعة"
                                value={stats?.partsRevenue}
                                icon={Wrench}
                                color="purple"
                                sub="تقدير لتكلفة القطع المدفوعة"
                            />
                        </div>

                        {/* Charts Row */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Revenue Sources Pie Chart */}
                            <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100 flex flex-col items-center justify-center min-h-[400px]">
                                <h3 className="text-lg font-black text-slate-800 mb-6 w-full text-right">توزيع مصادر الدخل</h3>
                                <div className="w-full h-[300px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <RechartsPie width={400} height={400}>
                                            <Pie
                                                data={revenueSourceData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={80}
                                                outerRadius={120}
                                                paddingAngle={5}
                                                dataKey="value"
                                            >
                                                {revenueSourceData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <RechartsTooltip content={<CustomTooltip />} />
                                            <Legend
                                                verticalAlign="bottom"
                                                height={36}
                                                iconType="circle"
                                                wrapperStyle={{ paddingTop: '20px' }}
                                                formatter={(value) => <span style={{ color: '#64748b', fontWeight: 800, fontSize: '11px', paddingRight: '4px' }}>{value}</span>}
                                            />
                                        </RechartsPie>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Recent Activity Summary */}
                            <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100 flex flex-col min-h-[400px]">
                                <h3 className="text-lg font-black text-slate-800 mb-6">أحدث العمليات المالية</h3>
                                <div className="flex-1 overflow-auto custom-scroll pr-2">
                                    <div className="space-y-4">
                                        {transactions?.slice(0, 5).map((t: any) => (
                                            <div key={t.id} className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-100">
                                                <div className="flex items-center gap-4">
                                                    <div className={cn(
                                                        "w-10 h-10 rounded-full flex items-center justify-center text-white font-bold",
                                                        t.type === 'CASH' ? "bg-emerald-500" :
                                                            t.category === 'Spare Parts' ? "bg-purple-500" : "bg-blue-500"
                                                    )}>
                                                        {t.category === 'Machine Sale' ? <ShoppingBag size={18} /> :
                                                            t.category === 'Spare Parts' ? <Wrench size={18} /> : <Receipt size={18} />}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-black text-slate-800">{SOURCE_LABELS[t.category] || t.category}</p>
                                                        <p className="text-xs text-slate-500 font-bold">{t.client}</p>
                                                    </div>
                                                </div>
                                                <div className="text-left">
                                                    <p className="text-sm font-black text-slate-800 font-mono">{t.amount.toLocaleString()} ج.م</p>
                                                    <p className="text-[10px] text-slate-400 font-bold">{new Date(t.date).toLocaleDateString('ar-EG')}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'transactions' && (
                    <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/30 border border-slate-100 overflow-hidden animate-fade-in">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white flex-wrap gap-4">
                            <h3 className="font-black text-lg text-slate-800">سجل المعاملات المالي</h3>
                            <div className="flex items-center gap-3">
                                <div className="relative">
                                    <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="بحث باسم عميل، تفاصيل، مبلغ..."
                                        value={transSearchQuery}
                                        onChange={(e) => setTransSearchQuery(e.target.value)}
                                        className="pr-9 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 transition-all w-64 shadow-sm"
                                    />
                                </div>
                                <div className="relative">
                                    <Filter size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <select
                                        value={transTypeFilter}
                                        onChange={(e) => setTransTypeFilter(e.target.value)}
                                        className="pr-9 pl-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 transition-all shadow-sm appearance-none cursor-pointer"
                                    >
                                        <option value="all">كل المعاملات</option>
                                        <option value="Machine Sale">مبيعات الماكينات</option>
                                        <option value="Spare Parts">قطع الغيار</option>
                                        <option value="Maintenance/General">صيانة و عام</option>
                                        <option value="PAID">المدفوعة فقط</option>
                                        <option value="FREE">المجانية فقط</option>
                                    </select>
                                </div>
                                <button
                                    onClick={() => handleExport(filteredTransactions, 'Financial_Transactions')}
                                    className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-colors"
                                >
                                    <Download size={16} />
                                    تصدير Excel
                                </button>
                            </div>
                        </div>
                        <div className="overflow-x-auto custom-scroll">
                            <table className="w-full text-right border-collapse">
                                <thead className="bg-slate-50/50">
                                    <tr>
                                        {[
                                            { label: 'التاريخ', key: 'date' },
                                            { label: 'الفرع', key: 'branch' },
                                            { label: 'نوع العملية', key: 'category' },
                                            { label: 'العميل', key: 'client' },
                                            { label: 'التفاصيل', key: 'details' },
                                            { label: 'المبلغ', key: 'amount' },
                                            { label: 'الحالة', key: 'status' }
                                        ].map((h) => (
                                            <th
                                                key={h.key}
                                                className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100/50 transition-colors select-none"
                                                onClick={() => handleSort(h.key, transSortConfig, setTransSortConfig)}
                                            >
                                                <div className="flex items-center justify-end gap-1">
                                                    {h.label}
                                                    <SortIcon columnKey={h.key} sortConfig={transSortConfig} />
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {filteredTransactions?.map((t: any) => (
                                        <tr key={t.id} className="hover:bg-slate-50/30 transition-colors">
                                            <td className="p-4 text-sm font-bold text-slate-800">
                                                {new Date(t.date).toLocaleDateString('ar-EG')}
                                            </td>
                                            <td className="p-4 text-xs font-bold text-slate-600 bg-slate-100 rounded-lg w-fit mx-4 block text-center mt-2 px-2 py-1">
                                                {t.branch}
                                            </td>
                                            <td className="p-4 text-sm font-bold text-slate-800">{SOURCE_LABELS[t.category] || t.category}</td>
                                            <td className="p-4 text-sm text-slate-600">{t.client}</td>
                                            <td className="p-4 text-xs text-slate-500 max-w-[200px] truncate" title={t.details}>
                                                {t.details}
                                            </td>
                                            <td className="p-4 text-sm font-black text-slate-900 font-mono">
                                                {t.amount.toLocaleString()} <span className="text-[9px] text-slate-400">ج.م</span>
                                            </td>
                                            <td className="p-4">
                                                <span className={cn(
                                                    "px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider",
                                                    t.status === 'PAID' ? "bg-emerald-100 text-emerald-700" :
                                                        t.status === 'PARTIAL' ? "bg-orange-100 text-orange-700" :
                                                            t.status === 'FREE' ? "bg-blue-100 text-blue-700" :
                                                                "bg-slate-100 text-slate-700"
                                                )}>
                                                    {t.status === 'PAID' ? 'تم الدفع' :
                                                        t.status === 'FREE' ? 'مجاني' : 'جزئي'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'reports' && (
                    <div className="animate-fade-in space-y-6">
                        <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/30 border border-slate-100 overflow-hidden">
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-purple-50/50 flex-wrap gap-4">
                                <div className="flex items-center gap-3">
                                    <Wrench size={24} className="text-purple-600" />
                                    <div>
                                        <h3 className="font-black text-lg text-slate-800">تقرير استهلاك وقيمة قطع الغيار</h3>
                                        <p className="text-xs text-slate-500 font-bold">تحليل تفصيلي لما تم صرفه (بمقابل / بدون مقابل)</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="relative">
                                        <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="بحث بقطعة غيار، عميل..."
                                            value={partsSearchQuery}
                                            onChange={(e) => setPartsSearchQuery(e.target.value)}
                                            className="pr-9 pl-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-purple-300 focus:ring-2 focus:ring-purple-100 transition-all w-64 shadow-sm"
                                        />
                                    </div>
                                    <div className="relative">
                                        <Filter size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <select
                                            value={partsTypeFilter}
                                            onChange={(e) => setPartsTypeFilter(e.target.value)}
                                            className="pr-9 pl-8 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-purple-300 focus:ring-2 focus:ring-purple-100 transition-all shadow-sm appearance-none cursor-pointer"
                                        >
                                            <option value="all">كل الأنواع</option>
                                            <option value="مدفوع">صرف مدفوع</option>
                                            <option value="مجاني/ضمان">صرف مجاني/ضمان</option>
                                        </select>
                                    </div>
                                    <button
                                        onClick={() => handleExport(filteredPartsReport.map((p: any) => ({
                                            'التاريخ والوقت': new Date(p.date).toLocaleString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
                                            'الفرع': p.branch,
                                            'العميل': p.client,
                                            'رقم العميل': p.clientBkcode,
                                            'رقم الماكينة': p.machineSerial,
                                            'قطعة الغيار': p.partName,
                                            'الكمية': p.quantity,
                                            'سعر الوحدة': p.unitCost,
                                            'القيمة الإجمالية': p.totalValue,
                                            'النوع': p.type,
                                            'رقم الإيصال': p.receiptNumber || '-'
                                        })), 'Spare_Parts_Usage_Report')}
                                        className="flex items-center gap-2 bg-white text-purple-700 border border-purple-200 px-4 py-2 rounded-xl text-xs font-bold hover:bg-purple-50 transition-colors shadow-sm whitespace-nowrap"
                                    >
                                        <Download size={16} />
                                        تصدير
                                    </button>
                                </div>
                            </div>
                            <div className="overflow-x-auto custom-scroll">
                                <table className="w-full text-right border-collapse">
                                    <thead className="bg-slate-50/80 sticky top-0">
                                        <tr>
                                            {[
                                                { label: 'التاريخ', key: 'date' },
                                                { label: 'الفرع', key: 'branch' },
                                                { label: 'العميل', key: 'client' },
                                                { label: 'كود العميل', key: 'clientBkcode' },
                                                { label: 'سيريال الماكينة', key: 'machineSerial' },
                                                { label: 'قطعة الغيار', key: 'partName' },
                                                { label: 'الكمية', key: 'quantity' },
                                                { label: 'سعر الوحدة', key: 'unitCost' },
                                                { label: 'نوع الصرف', key: 'type' },
                                                { label: 'الإيصال', key: 'receiptNumber' }
                                            ].map((h) => (
                                                <th
                                                    key={h.key}
                                                    className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100/50 transition-colors select-none"
                                                    onClick={() => handleSort(h.key, partsSortConfig, setPartsSortConfig)}
                                                >
                                                    <div className="flex items-center justify-end gap-1">
                                                        {h.label}
                                                        <SortIcon columnKey={h.key} sortConfig={partsSortConfig} />
                                                    </div>
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {!partsLoading && (!filteredPartsReport || filteredPartsReport.length === 0) && (
                                            <tr>
                                                <td colSpan={8} className="p-12 text-center text-slate-400 font-bold">
                                                    لا توجد بيانات متاحة للفترة أو الفرع المختار أو تطابق بحثك
                                                </td>
                                            </tr>
                                        )}
                                        {filteredPartsReport?.map((part: any, idx: number) => (
                                            <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                                                <td className="p-4 text-[11px] font-bold text-slate-600">
                                                    {new Date(part.date).toLocaleString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                                </td>
                                                <td className="p-4 text-xs font-bold text-slate-600">{part.branch}</td>
                                                <td className="p-4 text-xs font-bold text-slate-800">{part.client}</td>
                                                <td className="p-4 text-xs font-mono text-slate-500">{part.clientBkcode}</td>
                                                <td className="p-4 text-xs font-mono text-slate-500">{part.machineSerial}</td>
                                                <td className="p-4 text-sm font-black text-slate-800">{part.partName}</td>
                                                <td className="p-4 text-sm font-bold text-slate-900 bg-slate-50 text-center rounded-lg">{part.quantity}</td>
                                                <td className="p-4 text-xs font-base text-slate-500 font-mono">{(part.unitCost || 0).toLocaleString()} ج.م</td>
                                                <td className="p-4">
                                                    <span className={cn(
                                                        "px-3 py-1 rounded-full text-[10px] font-black border whitespace-nowrap",
                                                        part.isPaid
                                                            ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                                            : "bg-rose-50 text-rose-700 border-rose-100"
                                                    )}>
                                                        {part.type}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-xs font-bold text-slate-500 font-mono">
                                                    {part.receiptNumber || '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-slate-50 border-t border-slate-200">
                                        <tr>
                                            <td colSpan={6} className="p-4 text-left font-black text-slate-900">إجمالي الكمية:</td>
                                            <td className="p-4 text-center font-black text-slate-900">
                                                {filteredPartsReport?.reduce((sum: number, p: any) => sum + (p.quantity || 0), 0)}
                                            </td>
                                            <td className="p-4 font-black w-32 text-slate-500 text-left">القيمة:</td>
                                            <td colSpan={2} className="p-4 font-black text-lg text-emerald-700 font-mono text-right">
                                                {filteredPartsReport?.reduce((sum: number, p: any) => sum + (p.totalValue || 0), 0).toLocaleString()} ج.م
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* Installments Report Section */}
                {activeTab === 'reports' && installmentsReport && (
                    <div className="animate-fade-in space-y-6 mt-8">
                        <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/30 border border-slate-100 overflow-hidden">
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-orange-50/50">
                                <div className="flex items-center gap-3">
                                    <CreditCard size={24} className="text-orange-600" />
                                    <div>
                                        <h3 className="font-black text-lg text-slate-800">تقرير المديونيات والأقساط</h3>
                                        <p className="text-xs text-slate-500 font-bold">متابعة التحصيلات والمتأخرات حسب الفروع</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="relative">
                                        <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="بحث باسم الفرع..."
                                            value={instSearchQuery}
                                            onChange={(e) => setInstSearchQuery(e.target.value)}
                                            className="pr-9 pl-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100 transition-all w-48 shadow-sm"
                                        />
                                    </div>
                                    <button
                                        onClick={() => handleExport(installmentsReport?.details || [], 'Overdue_Installments')}
                                        className="flex items-center gap-2 bg-white text-orange-700 border border-orange-200 px-4 py-2 rounded-xl text-xs font-bold hover:bg-orange-50 transition-colors shadow-sm"
                                    >
                                        <Download size={16} />
                                        تصدير التفاصيل
                                    </button>
                                </div>
                            </div>

                            {/* KPI Summary Row */}
                            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 p-6 bg-slate-50/50 border-b border-slate-100">
                                <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                                    <p className="text-[10px] text-slate-400 font-bold mb-1">إجمالي المحفظة</p>
                                    <p className="text-xl font-black text-slate-900">{installmentsReport.kpi.totalPortfolio.toLocaleString()} ج.م</p>
                                </div>
                                <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                                    <p className="text-[10px] text-emerald-500 font-bold mb-1">تم تحصيله</p>
                                    <p className="text-xl font-black text-emerald-600">{installmentsReport.kpi.collected.toLocaleString()} ج.م</p>
                                </div>
                                <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                                    <p className="text-[10px] text-blue-500 font-bold mb-1">نسبة التحصيل</p>
                                    <div className="flex items-center gap-2">
                                        <div className="h-2 flex-grow bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className={cn("h-full rounded-full", installmentsReport.kpi.collectionRate >= 80 ? "bg-emerald-500" : installmentsReport.kpi.collectionRate >= 50 ? "bg-orange-500" : "bg-red-500")}
                                                style={{ width: `${installmentsReport.kpi.collectionRate}%` }}
                                            ></div>
                                        </div>
                                        <span className="text-lg font-black text-slate-800">{installmentsReport.kpi.collectionRate}%</span>
                                    </div>
                                </div>
                                <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                                    <p className="text-[10px] text-red-500 font-bold mb-1">متأخرات (Overdue)</p>
                                    <p className="text-xl font-black text-red-600">{installmentsReport.kpi.overdue.toLocaleString()} ج.م</p>
                                </div>
                                <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                                    <p className="text-[10px] text-orange-400 font-bold mb-1">مستحق مستقبلاً</p>
                                    <p className="text-xl font-black text-slate-700">{installmentsReport.kpi.pending.toLocaleString()} ج.م</p>
                                </div>
                            </div>

                            {/* Branch Performance Table */}
                            <div className="p-6">
                                <h4 className="font-bold text-sm text-slate-700 mb-4">أداء التحصيل بالفروع</h4>
                                <div className="overflow-x-auto custom-scroll border border-slate-100 rounded-xl">
                                    <table className="w-full text-right border-collapse">
                                        <thead className="bg-slate-50">
                                            <tr>
                                                {[
                                                    { label: 'الفرع', key: 'name' },
                                                    { label: 'عدد العملاء', key: 'customersCount' },
                                                    { label: 'إجمالي المطلوب', key: 'total' },
                                                    { label: 'المحصل', key: 'collected' },
                                                    { label: 'المتأخر', key: 'overdue' },
                                                    { label: 'نسبة التحصيل', key: 'collectionRate' }
                                                ].map((h) => (
                                                    <th
                                                        key={h.key}
                                                        className="p-3 text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100/50 transition-colors select-none"
                                                        onClick={() => handleSort(h.key, instSortConfig, setInstSortConfig)}
                                                    >
                                                        <div className="flex items-center justify-end gap-1">
                                                            {h.label}
                                                            <SortIcon columnKey={h.key} sortConfig={instSortConfig} />
                                                        </div>
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {filteredInstallments?.map((b: any, idx: number) => {
                                                const rate = b.collectionRate || 0;
                                                return (
                                                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                        <td className="p-3 text-xs font-black text-slate-700">{b.name}</td>
                                                        <td className="p-3 text-xs font-bold text-slate-500">{b.customersCount}</td>
                                                        <td className="p-3 text-xs font-bold text-slate-900">{b.total.toLocaleString()}</td>
                                                        <td className="p-3 text-xs font-bold text-emerald-600">{b.collected.toLocaleString()}</td>
                                                        <td className="p-3 text-xs font-bold text-red-600">{b.overdue.toLocaleString()}</td>
                                                        <td className="p-3">
                                                            <div className="flex items-center gap-2 w-32">
                                                                <div className="h-1.5 flex-grow bg-slate-100 rounded-full overflow-hidden">
                                                                    <div
                                                                        className={cn("h-full rounded-full transition-all duration-500", rate >= 80 ? "bg-emerald-500" : rate >= 50 ? "bg-orange-500" : "bg-red-500")}
                                                                        style={{ width: `${rate}%` }}
                                                                    ></div>
                                                                </div>
                                                                <span className="text-[10px] font-bold text-slate-400 w-8">{rate}%</span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Sales Detailed Report */}
                {activeTab === 'reports' && (
                    <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/30 border border-slate-100 overflow-hidden mt-8 animate-fade-in">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-blue-50/50 flex-wrap gap-4">
                            <div className="flex items-center gap-3">
                                <ShoppingCart size={24} className="text-blue-600" />
                                <div>
                                    <h3 className="font-black text-lg text-slate-800">تقرير المبيعات التفصيلي</h3>
                                    <p className="text-xs text-slate-500 font-bold">يشمل الكاش، مقدم القسط، ودفعات الأقساط</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="relative">
                                    <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="بحث بعميل، سيريال، قسيمة..."
                                        value={salesSearchQuery}
                                        onChange={(e) => setSalesSearchQuery(e.target.value)}
                                        className="pr-9 pl-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 transition-all w-64 shadow-sm"
                                    />
                                </div>
                                <div className="relative">
                                    <Filter size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <select
                                        value={salesTypeFilter}
                                        onChange={(e) => setSalesTypeFilter(e.target.value)}
                                        className="pr-9 pl-8 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 transition-all shadow-sm appearance-none cursor-pointer"
                                    >
                                        <option value="all">كل المبيعات</option>
                                        <option value="مبيعات كاش">كاش فقط</option>
                                        <option value="مقدم قسط">مقدم قسط فقط</option>
                                        <option value="دفعة قسط">دفعات القسط فقط</option>
                                    </select>
                                </div>
                                <button
                                    onClick={() => handleExport(filteredSalesReport.map((s: any) => ({
                                        'التاريخ': new Date(s.date).toLocaleDateString('ar-EG'),
                                        'الفرع': s.branch,
                                        'العميل': s.client,
                                        'رقم العميل': s.clientBkcode,
                                        'السيريال': s.machineSerial,
                                        'نوع الحركة': s.type,
                                        'المبلغ المحصل': s.amount,
                                        'رقم الإيصال': s.receiptNumber
                                    })), 'Sales_Detailed_Report')}
                                    className="flex items-center gap-2 bg-white text-blue-700 border border-blue-200 px-4 py-2 rounded-xl text-xs font-bold hover:bg-blue-50 transition-colors shadow-sm whitespace-nowrap"
                                >
                                    <Download size={16} />
                                    تصدير
                                </button>
                            </div>
                        </div>
                        <div className="overflow-x-auto custom-scroll">
                            <table className="w-full text-right border-collapse">
                                <thead className="bg-slate-50/80 sticky top-0">
                                    <tr>
                                        {[
                                            { label: 'التاريخ', key: 'date' },
                                            { label: 'الفرع', key: 'branch' },
                                            { label: 'العميل', key: 'client' },
                                            { label: 'رقم العميل', key: 'clientBkcode' },
                                            { label: 'رقم الماكينة', key: 'machineSerial' },
                                            { label: 'نوع الحركة', key: 'type' },
                                            { label: 'المبلغ', key: 'amount' },
                                            { label: 'إيصال', key: 'receiptNumber' }
                                        ].map((h) => (
                                            <th
                                                key={h.key}
                                                className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100/50 transition-colors select-none"
                                                onClick={() => handleSort(h.key, salesSortConfig, setSalesSortConfig)}
                                            >
                                                <div className="flex items-center justify-end gap-1">
                                                    {h.label}
                                                    <SortIcon columnKey={h.key} sortConfig={salesSortConfig} />
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {!salesLoading && (!filteredSalesReport || filteredSalesReport.length === 0) && (
                                        <tr>
                                            <td colSpan={8} className="p-12 text-center text-slate-400 font-bold">
                                                لا توجد بيانات متاحة
                                            </td>
                                        </tr>
                                    )}
                                    {filteredSalesReport?.map((sale: any) => (
                                        <tr key={sale.id} className="hover:bg-slate-50 transition-colors group">
                                            <td className="p-4 text-[11px] font-bold text-slate-600">
                                                {new Date(sale.date).toLocaleString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td className="p-4 text-xs font-bold text-slate-600">{sale.branch}</td>
                                            <td className="p-4 text-xs font-bold text-slate-800">{sale.client}</td>
                                            <td className="p-4 text-xs font-mono text-slate-500">{sale.clientBkcode}</td>
                                            <td className="p-4 text-xs font-mono text-slate-500">{sale.machineSerial}</td>
                                            <td className="p-4">
                                                <span className={cn(
                                                    "px-3 py-1 rounded-full text-[10px] font-black border whitespace-nowrap",
                                                    sale.type === 'مبيعات كاش' ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                                                        sale.type === 'مقدم قسط' ? "bg-amber-50 text-amber-700 border-amber-100" :
                                                            "bg-blue-50 text-blue-700 border-blue-100"
                                                )}>
                                                    {sale.type}
                                                </span>
                                            </td>
                                            <td className="p-4 text-sm font-black text-slate-900 font-mono">
                                                {(sale.amount || 0).toLocaleString()} <span className="text-[9px] text-slate-400">ج.م</span>
                                            </td>
                                            <td className="p-4 text-xs font-bold text-slate-500 font-mono">
                                                {sale.receiptNumber || '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}

