import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import {
    AlertCircle,
    Banknote,
    CheckCircle2,
    Package,
    Plus,
    Wrench,
    TrendingUp,
    Filter,
    ArrowRightLeft,
    FileBarChart,
    Calendar,
} from 'lucide-react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ROLES } from '../lib/permissions';
import { PerformanceReportModal } from '../components/PerformanceReportModal';
import PageHeader from '../components/PageHeader';
import TutorialHints from '../components/TutorialHints';

// Components
import StatCard from '../components/dashboard/StatCard';
import RecentActivityTable from '../components/dashboard/RecentActivityTable';
import RequestStatusPie from '../components/dashboard/RequestStatusPie';
import PendingInstallmentsCard from '../components/dashboard/PendingInstallmentsCard';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

const PERIODS = [
    { value: 'month', label: 'الشهر الحالي' },
    { value: 'quarter', label: 'ربع السنة الحالي' },
    { value: 'year', label: 'السنة الحالية' }
];

const MONTHS = [
    { value: 0, label: 'يناير' }, { value: 1, label: 'فبراير' }, { value: 2, label: 'مارس' },
    { value: 3, label: 'أبريل' }, { value: 4, label: 'مايو' }, { value: 5, label: 'يونيو' },
    { value: 6, label: 'يوليو' }, { value: 7, label: 'أغسطس' }, { value: 8, label: 'سبتمبر' },
    { value: 9, label: 'أكتوبر' }, { value: 10, label: 'نوفمبر' }, { value: 11, label: 'ديسمبر' }
];

const QUARTERS = [
    { value: 0, label: 'الربع الأول' },
    { value: 1, label: 'الربع الثاني' },
    { value: 2, label: 'الربع الثالث' },
    { value: 3, label: 'الربع الرابع' }
];

export default function Dashboard() {
    const navigate = useNavigate();
    const { user, activeBranchId } = useAuth();
    const [filterBranchId, setFilterBranchId] = useState('');
    const [period, setPeriod] = useState<'month' | 'quarter' | 'year'>('month');
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedQuarter, setSelectedQuarter] = useState(Math.floor(new Date().getMonth() / 3));
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [showPerformanceReport, setShowPerformanceReport] = useState(false);

    const isAdmin = ['SUPER_ADMIN', 'BRANCH_ADMIN', 'MANAGEMENT'].includes(user?.role as string);
    const showOperationalButtons = [ROLES.SUPER_ADMIN, ROLES.BRANCH_ADMIN, ROLES.BRANCH_MANAGER, ROLES.TECHNICIAN].includes(user?.role as any);

    const getQueryParams = () => {
        const params: any = { period, year: selectedYear };
        if (activeBranchId) params.branchId = activeBranchId;
        else if (filterBranchId) params.branchId = filterBranchId;

        if (period === 'month') params.month = selectedMonth;
        if (period === 'quarter') params.quarter = selectedQuarter;
        return params;
    };

    const { data: stats, isLoading } = useQuery({
        queryKey: ['dashboard-stats', activeBranchId, filterBranchId, period, selectedMonth, selectedQuarter, selectedYear],
        queryFn: () => api.getDashboardStats(getQueryParams()),
        enabled: !!user,
        refetchInterval: 60000
    });

    const { data: branches } = useQuery({
        queryKey: ['branches'],
        queryFn: () => api.getActiveBranches(),
        enabled: !!user && isAdmin,
        staleTime: 1000 * 60 * 60
    });

    if (isLoading) {
        return (
            <div className="flex h-full items-center justify-center p-8 bg-slate-50">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin"></div>
                    <p className="text-slate-500 font-medium">جاري تحميل لوحة التحكم...</p>
                </div>
            </div>
        );
    }

    const requestData = Array.isArray(stats?.requests?.distribution)
        ? stats.requests.distribution.map((d: any) => ({ name: d.name, value: d.value }))
        : [];
    const revenueTrend = stats?.revenue?.trend || [];

    const getPeriodLabel = () => {
        if (period === 'month') return `${MONTHS[selectedMonth].label} ${selectedYear}`;
        if (period === 'quarter') return `${QUARTERS[selectedQuarter].label} ${selectedYear}`;
        return `سنة ${selectedYear}`;
    };

    const periodFilterElement = (
        <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex items-center gap-2 bg-white rounded-xl border-2 border-primary/10 px-3 py-2 shadow-sm hover:shadow-md transition-shadow">
                <Calendar size={16} className="text-primary/60" />
                <select value={period} onChange={(e) => setPeriod(e.target.value as any)} className="bg-transparent outline-none text-sm font-bold min-w-[120px]">
                    {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
            </div>
            {period === 'month' && (
                <div className="relative flex items-center gap-2 bg-white rounded-xl border-2 border-primary/10 px-3 py-2 shadow-sm">
                    <select value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))} className="bg-transparent outline-none text-sm font-bold">
                        {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                </div>
            )}
            {period === 'quarter' && (
                <div className="relative flex items-center gap-2 bg-white rounded-xl border-2 border-primary/10 px-3 py-2 shadow-sm">
                    <select value={selectedQuarter} onChange={(e) => setSelectedQuarter(parseInt(e.target.value))} className="bg-transparent outline-none text-sm font-bold">
                        {QUARTERS.map(q => <option key={q.value} value={q.value}>{q.label}</option>)}
                    </select>
                </div>
            )}
            <div className="relative flex items-center gap-2 bg-white rounded-xl border-2 border-primary/10 px-3 py-2 shadow-sm">
                <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))} className="bg-transparent outline-none text-sm font-bold">
                    {[selectedYear - 1, selectedYear, selectedYear + 1].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
            </div>
            <span className="text-sm text-slate-500 font-medium">{getPeriodLabel()}</span>
        </div>
    );

    return (
        <div className="px-3 lg:px-6 pt-3 pb-6 bg-muted/10 min-h-screen animate-fade-in" dir="rtl">
            <PageHeader
                title="لوحة التحكم"
                subtitle={`إحصائيات ${getPeriodLabel()}`}
                filter={periodFilterElement}
                actions={<>
                    {showOperationalButtons && (
                        <>
                            <button onClick={() => navigate('/requests', { state: { createRequest: true } })} className="flex-1 lg:flex-none flex items-center justify-center gap-2 bg-smart-gradient text-white px-6 py-3 rounded-xl hover:shadow-lg font-bold active:scale-95">
                                <Plus size={20} strokeWidth={3} /> <span className="whitespace-nowrap">طلب صيانة</span>
                            </button>
                            <button onClick={() => navigate('/payments')} className="flex-1 lg:flex-none flex items-center justify-center gap-2 bg-white text-foreground border-2 border-border px-4 py-2 rounded-xl hover:bg-muted transition-all font-bold">
                                <Banknote size={20} /> <span className="whitespace-nowrap">تسجيل دفعة</span>
                            </button>
                        </>
                    )}
                    <button onClick={() => setShowPerformanceReport(true)} className="flex-1 lg:flex-none flex items-center justify-center gap-2 bg-success text-white px-4 py-2 rounded-xl hover:shadow-lg font-bold">
                        <FileBarChart size={20} /> <span className="whitespace-nowrap">تقرير أداء الصيانة</span>
                    </button>
                </>}
            />

            {isAdmin && branches && branches.length > 1 && (
                <div className="mb-4">
                    <div className="relative flex items-center gap-2 bg-white rounded-xl border-2 border-primary/10 px-4 py-2 shadow-sm flex-1 lg:flex-none">
                        <Filter size={18} className="text-primary/60" />
                        <select value={filterBranchId} onChange={(e) => setFilterBranchId(e.target.value)} className="bg-transparent outline-none text-sm text-slate-700 font-bold min-w-[120px]">
                            <option value="">كل الفروع</option>
                            {branches?.map((branch: any) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                        </select>
                    </div>
                </div>
            )}

            <TutorialHints />

            <div className="smart-grid lg:grid-cols-4 mb-8">
                <StatCard title={`الإيرادات (${getPeriodLabel()})`} value={`${(stats?.revenue?.amount || 0).toLocaleString()} ج.م`} icon={<TrendingUp size={24} className="text-success" />} color="green" />
                <StatCard title="طلبات مفتوحة" value={stats?.requests?.open || 0} icon={<Wrench size={24} className="text-warning" />} subtext={`${stats?.requests?.inProgress || 0} جاري العمل`} color="orange" />
                <StatCard title="أقساط مستحقة" value={stats?.pendingInstallments?.totalCount || 0} icon={<AlertCircle size={24} className="text-destructive" />} subtext={`${(stats?.pendingInstallments?.totalAmount || 0).toLocaleString()} ج.م`} color="red" onClick={() => navigate('/receipts')} />
                <StatCard title="تنبيهات المخزون" value={stats?.inventory?.lowStock?.length || 0} icon={<Package size={24} className="text-info" />} subtext="قطع أوشكت على النفاد" color="purple" onClick={() => navigate('/warehouse')} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 space-y-4">
                    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-shadow group">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="font-black text-lg text-slate-800 flex items-center gap-3">
                                <div className="p-2 bg-success/10 rounded-lg text-success transition-transform group-hover:rotate-12">
                                    <TrendingUp size={20} />
                                </div>
                                تحليل الإيرادات
                            </h3>
                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-success"></div>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider text-left">التدفق النقدي</span>
                                </div>
                            </div>
                        </div>
                        <div className="h-[250px] w-full min-w-0" dir="ltr">
                            <ResponsiveContainer width="100%" height={250}>
                                <AreaChart data={revenueTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis
                                        dataKey="name"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                                        dy={10}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            borderRadius: '16px',
                                            border: 'none',
                                            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                                            padding: '12px'
                                        }}
                                        itemStyle={{ fontWeight: 900, fontSize: '12px' }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="value"
                                        stroke="#10b981"
                                        strokeWidth={4}
                                        fillOpacity={1}
                                        fill="url(#colorValue)"
                                        animationBegin={0}
                                        animationDuration={2000}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    <RecentActivityTable activities={stats?.recentActivity || []} />
                </div>

                <div className="space-y-4">
                    <RequestStatusPie data={requestData} totalActive={(stats?.requests?.open || 0) + (stats?.requests?.inProgress || 0)} colors={COLORS} />
                    <PendingInstallmentsCard installmentsData={stats?.pendingInstallments} periodLabel={getPeriodLabel()} />
                    <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                        <h3 className="font-bold text-base text-slate-800 flex items-center gap-2 mb-3">
                            <AlertCircle size={18} className="text-destructive" /> نواقص المخزون
                        </h3>
                        <div className="space-y-2">
                            {Array.isArray(stats?.inventory?.lowStock) && stats.inventory.lowStock.slice(0, 5).map((item: any) => (
                                <div key={item.id} className="flex items-center justify-between p-2 bg-destructive/5 rounded-lg border border-destructive/10">
                                    <div className="flex items-center gap-2">
                                        <div className="bg-white p-1.5 rounded shadow-sm"><Package size={14} className="text-destructive" /></div>
                                        <div>
                                            <div className="font-bold text-slate-800 text-sm">{item.part?.name}</div>
                                            <div className="text-xs text-destructive">متبقي: {item.quantity}</div>
                                        </div>
                                    </div>
                                    <button onClick={() => navigate('/warehouse')} className="text-xs bg-white text-destructive px-2 py-1 rounded border border-destructive/20">تزويد</button>
                                </div>
                            ))}
                            {(!stats?.inventory?.lowStock || stats.inventory.lowStock.length === 0) && (
                                <div className="text-center py-3 text-muted-foreground text-sm">
                                    <CheckCircle2 size={28} className="mx-auto text-success mb-2" /> المخزون في حالة جيدة
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {showPerformanceReport && (
                <PerformanceReportModal
                    isOpen={showPerformanceReport}
                    onClose={() => setShowPerformanceReport(false)}
                    branchId={filterBranchId}
                />
            )}
        </div>
    );
}
