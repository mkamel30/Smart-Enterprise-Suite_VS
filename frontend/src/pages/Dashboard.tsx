import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import {
    AlertCircle,
    ArrowUpRight,
    Banknote,
    CheckCircle2,
    Package,
    Plus,
    Wrench,
    TrendingUp,
    Filter,
    Monitor,
    Smartphone,
    ArrowRightLeft,
    FileBarChart
} from 'lucide-react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ROLES } from '../lib/permissions';
import { PerformanceReportModal } from '../components/PerformanceReportModal';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

export default function Dashboard() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [filterBranchId, setFilterBranchId] = useState('');
    const [showPerformanceReport, setShowPerformanceReport] = useState(false);
    const isAdmin = !user?.branchId;
    const isAffairs = user?.role === ROLES.ADMIN_AFFAIRS;

    // Only these roles can perform front-office operations like creating requests or payments
    const showOperationalButtons = [
        ROLES.SUPER_ADMIN,
        ROLES.BRANCH_MANAGER,
        ROLES.TECHNICIAN
    ].includes(user?.role as any);

    const { data: stats, isLoading } = useQuery({
        queryKey: ['dashboard-stats', filterBranchId],
        queryFn: () => api.getDashboardStats({ branchId: filterBranchId }),
        enabled: !!user,
        refetchInterval: 60000 // Refresh every minute
    });

    // Fetch branches for filter if admin
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

    const requestData = stats?.requests?.distribution.map((d: any) => ({
        name: d.name,
        value: d.value
    })) || [];

    // Real trend data from backend
    const revenueTrend = stats?.revenue?.trend || [
        { name: 'W1', value: 0 },
        { name: 'W2', value: 0 },
        { name: 'W3', value: 0 },
        { name: 'W4', value: 0 },
    ];

    return (
        <div className="px-4 lg:px-8 pt-4 pb-8 bg-gradient-to-br from-slate-50 to-blue-50/30 min-h-screen animate-fade-in" dir="rtl">
            {/* Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8 animate-slide-up">
                <div>
                    <h1 className="text-2xl lg:text-3xl font-black text-[#0A2472] mb-1">لوحة التحكم</h1>
                    <p className="text-slate-500 flex items-center gap-2">
                    </p>
                </div>
                <div className="flex flex-wrap gap-3 w-full lg:w-auto">
                    {isAdmin && (
                        <div className="relative flex items-center gap-2 bg-white rounded-xl border-2 border-[#0A2472]/10 px-4 py-2 shadow-sm hover:shadow-md transition-shadow flex-1 lg:flex-none">
                            <Filter size={18} className="text-[#0A2472]/60" />
                            <select
                                value={filterBranchId}
                                onChange={(e) => setFilterBranchId(e.target.value)}
                                className="bg-transparent outline-none text-sm text-slate-700 font-bold min-w-[120px] w-full"
                            >
                                <option value="">كل الفروع</option>
                                {(branches as any[])?.map((branch: any) => (
                                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    {showOperationalButtons && (
                        <>
                            <button
                                onClick={() => navigate('/requests', { state: { createRequest: true } })}
                                className="flex-1 lg:flex-none flex items-center justify-center gap-2 bg-gradient-to-r from-[#0A2472] to-[#0A2472]/90 text-white px-6 py-3 rounded-xl hover:shadow-lg hover:shadow-[#0A2472]/20 transition-all font-black active:scale-95"
                            >
                                <Plus size={20} strokeWidth={3} />
                                <span className="whitespace-nowrap">طلب صيانة</span>
                            </button>
                            <button
                                onClick={() => navigate('/payments')}
                                className="flex-1 lg:flex-none flex items-center justify-center gap-2 bg-white text-slate-700 border px-4 py-2 rounded-xl hover:bg-slate-50 transition-all"
                            >
                                <Banknote size={20} />
                                <span className="whitespace-nowrap">تسجيل دفعة</span>
                            </button>
                        </>
                    )}
                    {!isAffairs && (
                        <button
                            onClick={() => setShowPerformanceReport(true)}
                            className="flex-1 lg:flex-none flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white px-4 py-2 rounded-xl hover:shadow-lg hover:shadow-emerald-500/20 transition-all font-bold"
                        >
                            <FileBarChart size={20} />
                            <span className="whitespace-nowrap">تقرير أداء الصيانة</span>
                        </button>
                    )}
                </div>
            </div>

            {isAffairs ? (
                // Admin Affairs Layout (3x2 Grid)
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-8 animate-slide-up">
                    {/* Row 1 */}
                    <StatCard
                        title="مخزون الماكينات"
                        value={stats?.inventory?.machines || 0}
                        icon={<Monitor size={24} className="text-primary" />}
                        subtext="ماكينة في المخزن"
                        color="blue"
                        onClick={() => navigate('/warehouse-machines')}
                    />
                    <StatCard
                        title="مخزون الشرائح"
                        value={stats?.inventory?.sims || 0}
                        icon={<Smartphone size={24} className="text-purple-600" />}
                        subtext="شريحة متاحة"
                        color="purple"
                        onClick={() => navigate('/warehouse-sims')}
                    />
                    <StatCard
                        title="أذونات معلقة"
                        value={stats?.alerts?.pendingTransfers || 0}
                        icon={<ArrowRightLeft size={24} className="text-orange-600" />}
                        subtext="تحتاج مراجعة"
                        color="orange"
                        onClick={() => navigate('/transfer-orders')}
                    />

                    {/* Row 2 */}
                    <StatCard
                        title="تنبيهات المخزون"
                        value={stats?.inventory?.lowStock?.length || 0}
                        icon={<Package size={24} className="text-red-600" />}
                        subtext="قطع أوشكت على النفاد"
                        color="red"
                        onClick={() => navigate('/warehouse')}
                    />

                    {/* Requests Status Pie Chart */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                        <h3 className="font-bold text-lg text-slate-800 mb-6">حالة الطلبات</h3>
                        <div className="h-[150px] w-full relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={requestData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={50}
                                        outerRadius={70}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {requestData.map((entry: any, index: number) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <span className="text-2xl font-bold text-slate-800">{(stats?.requests?.open || 0) + (stats?.requests?.inProgress || 0)}</span>
                            </div>
                        </div>
                        <div className="mt-4 space-y-2">
                            {requestData.map((entry: any, index: number) => (
                                <div key={entry.name} className="flex justify-between items-center text-sm">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                                        <span className="text-slate-600">{entry.name}</span>
                                    </div>
                                    <span className="font-bold text-slate-800">{entry.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Low Stock List */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                                <AlertCircle size={20} className="text-red-500" />
                                نواقص المخزون
                            </h3>
                        </div>
                        <div className="space-y-3 overflow-y-auto custom-scroll flex-1 max-h-[200px]">
                            {stats?.inventory?.lowStock?.map((item: any) => (
                                <div key={item.id} className="flex items-center justify-between p-3 bg-red-50 rounded-xl border border-red-100">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-white p-2 rounded-lg shadow-sm">
                                            <Package size={16} className="text-red-500" />
                                        </div>
                                        <div>
                                            <div className="font-bold text-slate-800 text-sm">{item.part?.name}</div>
                                            <div className="text-xs text-red-600">متبقي: {item.quantity}</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {(!stats?.inventory?.lowStock || stats.inventory.lowStock.length === 0) && (
                                <div className="text-center py-4 text-slate-500 text-sm">
                                    <CheckCircle2 size={32} className="mx-auto text-green-500 mb-2" />
                                    المخزون في حالة جيدة
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <>
                    {/* Stats Grid for Others */}
                    <div className="smart-grid lg:grid-cols-4 mb-8">
                        {(user?.role === ROLES.CENTER_MANAGER || user?.role === ROLES.CENTER_TECH) ? (
                            // Maintenance Center Widgets
                            <>
                                <StatCard
                                    title="إيرادات الصيانة"
                                    value={`${stats?.maintenanceStats?.revenue?.toLocaleString() || 0} ج.م`}
                                    icon={<TrendingUp size={24} className="text-green-600" />}
                                    subtext="من قطع الغيار فقط"
                                    color="green"
                                    className="animate-slide-up delay-75"
                                />
                                <StatCard
                                    title="قطع غيار مدفوعة"
                                    value={stats?.maintenanceStats?.paidCount || 0}
                                    icon={<CheckCircle2 size={24} className="text-primary" />}
                                    subtext="تم تغييرها بمقابل"
                                    color="blue"
                                    className="animate-slide-up delay-100"
                                />
                                <StatCard
                                    title="قطع غيار (ضمان/مجاني)"
                                    value={stats?.maintenanceStats?.freeCount || 0}
                                    icon={<Package size={24} className="text-orange-600" />}
                                    subtext="تم تغييرها بدون مقابل"
                                    color="orange"
                                    className="animate-slide-up delay-150"
                                />
                                <StatCard
                                    title="تنبيهات المخزون"
                                    value={stats?.inventory?.lowStock?.length || 0}
                                    icon={<Package size={24} className="text-red-600" />}
                                    subtext="قطع أوشكت على النفاد"
                                    color="red"
                                    onClick={() => navigate('/warehouse')}
                                    className="animate-slide-up delay-200"
                                />
                            </>
                        ) : (
                            // Standard Branch Widgets
                            <>
                                <StatCard
                                    title="الإيرادات (هذا الشهر)"
                                    value={`${stats?.revenue?.monthly?.toLocaleString() || 0} ج.م`}
                                    icon={<TrendingUp size={24} className="text-green-600" />}
                                    trend={stats?.revenue?.monthly > 0 ? "+12%" : undefined}
                                    color="green"
                                    className="animate-slide-up delay-75"
                                />
                                <StatCard
                                    title="طلبات مفتوحة"
                                    value={stats?.requests?.open || 0}
                                    icon={<Wrench size={24} className="text-orange-600" />}
                                    subtext={`${stats?.requests?.inProgress || 0} جاري العمل`}
                                    color="orange"
                                    className="animate-slide-up delay-100"
                                />
                                <StatCard
                                    title="أقساط مستحقة"
                                    value={stats?.alerts?.overdueInstallments || 0}
                                    icon={<AlertCircle size={24} className="text-red-600" />}
                                    subtext="متأخرة السداد"
                                    color="red"
                                    onClick={() => navigate('/receipts')}
                                    className="animate-slide-up delay-150"
                                />
                                <StatCard
                                    title="تنبيهات المخزون"
                                    value={stats?.inventory?.lowStock?.length || 0}
                                    icon={<Package size={24} className="text-purple-600" />}
                                    subtext="قطع أوشكت على النفاد"
                                    color="purple"
                                    onClick={() => navigate('/warehouse')}
                                    className="animate-slide-up delay-200"
                                />
                            </>
                        )}
                    </div>

                    {/* Main Content Grid for Others */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Charts Section */}
                        <div className="lg:col-span-2 space-y-8 animate-slide-up delay-300">
                            {/* Revenue Chart */}
                            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="font-bold text-lg text-slate-800">تحليل الإيرادات</h3>
                                    <select className="bg-slate-50 border-none text-sm rounded-lg p-2 text-slate-500 outline-none">
                                        <option>هذا الشهر</option>
                                        <option>آخر 3 شهور</option>
                                    </select>
                                </div>
                                <div className="h-[300px] w-full" dir="ltr">
                                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                        <AreaChart data={revenueTrend}>
                                            <defs>
                                                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
                                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} />
                                            <Tooltip
                                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                                cursor={{ stroke: '#cbd5e1', strokeWidth: 1 }}
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="value"
                                                stroke="#10b981"
                                                strokeWidth={3}
                                                fillOpacity={1}
                                                fill="url(#colorValue)"
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Recent Activity Table */}
                            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="font-bold text-lg text-slate-800">آخر العمليات</h3>
                                    <button onClick={() => navigate('/payments')} className="text-sm text-primary hover:underline">عرض الكل</button>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="text-right text-slate-400 text-sm border-b border-slate-50">
                                                <th className="pb-3 font-normal">العميل</th>
                                                <th className="pb-3 font-normal">العملية</th>
                                                <th className="pb-3 font-normal">المبلغ</th>
                                                <th className="pb-3 font-normal">التاريخ</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-sm">
                                            {stats?.recentActivity?.map((activity: any) => (
                                                <tr key={activity.id} className="group hover:bg-slate-50 transition-colors">
                                                    <td className="py-4 font-medium text-slate-700">{activity.customerName || 'عميل نقدي'}</td>
                                                    <td className="py-4 text-slate-500">{activity.reason}</td>
                                                    <td className="py-4 font-bold text-slate-900">{activity.amount.toLocaleString()} ج.م</td>
                                                    <td className="py-4 text-slate-400 text-xs">
                                                        {new Date(activity.createdAt).toLocaleDateString('ar-EG')}
                                                    </td>
                                                </tr>
                                            ))}
                                            {(!stats?.recentActivity || stats.recentActivity.length === 0) && (
                                                <tr>
                                                    <td colSpan={4} className="py-8 text-center text-slate-400">لا توجد عمليات حديثة</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* Side Section */}
                        <div className="space-y-8">
                            {/* Requests Status Pie Chart */}
                            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                                <h3 className="font-bold text-lg text-slate-800 mb-6">حالة الطلبات</h3>
                                <div className="h-[200px] w-full relative">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={requestData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={80}
                                                paddingAngle={5}
                                                dataKey="value"
                                            >
                                                {requestData.map((entry: any, index: number) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                        <span className="text-3xl font-bold text-slate-800">{(stats?.requests?.open || 0) + (stats?.requests?.inProgress || 0)}</span>
                                        <span className="text-xs text-slate-500">نشط</span>
                                    </div>
                                </div>
                                <div className="mt-4 space-y-2">
                                    {requestData.map((entry: any, index: number) => (
                                        <div key={entry.name} className="flex justify-between items-center text-sm">
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                                                <span className="text-slate-600">{entry.name}</span>
                                            </div>
                                            <span className="font-bold text-slate-800">{entry.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Low Stock Alert List */}
                            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                                        <AlertCircle size={20} className="text-red-500" />
                                        نواقص المخزون
                                    </h3>
                                </div>
                                <div className="space-y-3">
                                    {stats?.inventory?.lowStock?.map((item: any) => (
                                        <div key={item.id} className="flex items-center justify-between p-3 bg-red-50 rounded-xl border border-red-100">
                                            <div className="flex items-center gap-3">
                                                <div className="bg-white p-2 rounded-lg shadow-sm">
                                                    <Package size={16} className="text-red-500" />
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-800 text-sm">{item.part?.name}</div>
                                                    <div className="text-xs text-red-600">متبقي: {item.quantity}</div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => navigate('/warehouse')}
                                                className="text-xs bg-white text-red-600 px-2 py-1 rounded border border-red-200 hover:bg-red-50"
                                            >
                                                تزويد
                                            </button>
                                        </div>
                                    ))}
                                    {(!stats?.inventory?.lowStock || stats.inventory.lowStock.length === 0) && (
                                        <div className="text-center py-4 text-slate-500 text-sm">
                                            <CheckCircle2 size={32} className="mx-auto text-green-500 mb-2" />
                                            المخزون في حالة جيدة
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Performance Report Modal */}
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

// Helper Card Component
function StatCard({ title, value, icon, subtext, trend, color, onClick, className }: any) {
    const bgColors: any = {
        green: 'bg-emerald-50 text-emerald-600',
        orange: 'bg-orange-50 text-orange-600',
        red: 'bg-rose-50 text-rose-600',
        purple: 'bg-violet-50 text-violet-600',
        blue: 'bg-primary/10 text-primary',
    };

    return (
        <div
            onClick={onClick}
            className={`bg-white p-6 rounded-2xl border border-slate-100 shadow-sm transition-all hover:shadow-md ${onClick ? 'cursor-pointer active:scale-95' : ''} ${className}`}
        >
            <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-xl ${bgColors[color]}`}>
                    {icon}
                </div>
                {trend && (
                    <span className="flex items-center text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                        <ArrowUpRight size={14} className="mr-1" />
                        {trend}
                    </span>
                )}
            </div>
            <div className="space-y-1">
                <h3 className="text-slate-500 text-sm font-medium">{title}</h3>
                <h2 className="text-2xl font-bold text-slate-900">{value}</h2>
                {subtext && <p className="text-xs text-slate-400 mt-2">{subtext}</p>}
            </div>
        </div>
    );
}
