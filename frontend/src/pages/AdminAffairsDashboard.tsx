import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import {
    Package,
    ArrowRightLeft,
    Monitor,
    Smartphone,
    Box,
    ClipboardList,
    TrendingUp,
    PieChart as PieChartIcon,
    History,
    RefreshCw,
    Plus,
    Building2
} from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Legend
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/dashboard/StatCard';

const CHART_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function AdminAffairsDashboard() {
    const navigate = useNavigate();

    const { data: stats, isLoading, refetch } = useQuery({
        queryKey: ['admin-affairs-summary'],
        queryFn: () => api.getAdminAffairsSummary(),
        staleTime: 5 * 60 * 1000 // Consider data fresh for 5 minutes
    });

    if (isLoading) {
        return (
            <div className="flex h-full items-center justify-center p-8">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                    <p className="text-muted-foreground font-medium">جاري تحميل لوحة تحكم الشئون الإدارية...</p>
                </div>
            </div>
        );
    }

    const { quickCounts, machineDistribution, simDistribution, recentMovements, assetTypeDistribution } = stats || {};

    return (
        <div className="px-4 sm:px-8 pt-2 pb-10 space-y-8 animate-fade-in" dir="rtl">
            <PageHeader
                title="لوحة تحكم الشئون الإدارية"
                subtitle="نظرة شاملة على الأصول، العهد، وحركة الماكينات والشرائح"
                actions={
                    <div className="flex gap-2">
                        <button
                            onClick={() => navigate('/admin-store', { state: { showAddManual: true } })}
                            className="bg-primary text-primary-foreground px-6 py-3 rounded-2xl font-black transition-all hover:shadow-xl active:scale-95 flex items-center gap-2"
                        >
                            <Plus size={20} strokeWidth={3} />
                            إضافة أصل جديد
                        </button>
                        <button
                            onClick={() => navigate('/transfer-orders', { state: { createOrder: true } })}
                            className="bg-muted hover:bg-accent text-foreground px-6 py-3 rounded-2xl font-black transition-all active:scale-95 border border-border flex items-center gap-2"
                        >
                            <ArrowRightLeft size={20} />
                            إذن صرف جديد
                        </button>
                    </div>
                }
            />

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="إجمالي الأصول الإدارية"
                    value={quickCounts?.totalAdminAssets || 0}
                    icon={<Package size={24} />}
                    subtext={`${quickCounts?.inMainStore || 0} في المخزن • ${quickCounts?.transferred || 0} عهد موفرة`}
                    color="blue"
                    onClick={() => navigate('/admin-store')}
                />
                <StatCard
                    title="شحنات جارية"
                    value={quickCounts?.pendingOrders || 0}
                    icon={<ArrowRightLeft size={24} />}
                    subtext="نقل عهد بين الفروع والمخزن"
                    color="orange"
                    onClick={() => navigate('/transfer-orders')}
                />
                <StatCard
                    title="ماكينات الشركة"
                    value={quickCounts?.companyMachines || 0}
                    icon={<Monitor size={24} />}
                    subtext="ماكينة جديدة متاحة للصرف"
                    color="green"
                    onClick={() => navigate('/warehouse-machines')}
                />
                <StatCard
                    title="شرائح الشركة"
                    value={quickCounts?.companySims || 0}
                    icon={<Smartphone size={24} />}
                    subtext="شريحة متاحة في المخزن"
                    color="purple"
                    onClick={() => navigate('/warehouse-sims')}
                />
                <StatCard
                    title="أصول كهنة / مستهلك"
                    value={quickCounts?.disposed || 0}
                    icon={<Box size={24} />}
                    subtext="إجمالي الأصول المكهنة"
                    color="red"
                    onClick={() => navigate('/admin-store')}
                />
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Machine Distribution Chart */}
                <div className="bg-card rounded-[2.5rem] border border-border shadow-2xl p-8 transition-all hover:shadow-primary/5 group">
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="text-xl font-black flex items-center gap-3">
                            <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-xl group-hover:rotate-12 transition-transform">
                                <Building2 size={24} />
                            </div>
                            توزيع الماكينات على الفروع
                        </h3>
                    </div>
                    <div className="h-80 w-full min-h-[320px]" dir="ltr">
                        <ResponsiveContainer width="100%" height={320}>
                            <BarChart data={machineDistribution || []}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontWeight: 700 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontWeight: 700 }} />
                                <Tooltip
                                    cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
                                    contentStyle={{ borderRadius: '20px', backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', boxShadow: '0 20px 40px -10px rgb(0 0 0 / 0.2)' }}
                                />
                                <Bar dataKey="count" name="عدد الماكينات" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} barSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Asset Type Distribution */}
                <div className="bg-card rounded-[2.5rem] border border-border shadow-2xl p-8 transition-all hover:shadow-primary/5 group">
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="text-xl font-black flex items-center gap-3">
                            <div className="p-2 bg-amber-500/10 text-amber-500 rounded-xl group-hover:rotate-12 transition-transform">
                                <PieChartIcon size={24} />
                            </div>
                            تصنيف الأصول الإدارية
                        </h3>
                    </div>
                    <div className="h-80 w-full min-h-[320px]" dir="ltr">
                        <ResponsiveContainer width="100%" height={320}>
                            <PieChart>
                                <Pie
                                    data={assetTypeDistribution || []}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {(assetTypeDistribution || []).map((_entry: any, index: number) => (
                                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ borderRadius: '20px', backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                                />
                                <Legend verticalAlign="bottom" height={36} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Bottom Row: Recent Activity & SIM Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Recent Movements */}
                <div className="lg:col-span-2 bg-card rounded-[2.5rem] border border-border shadow-2xl overflow-hidden flex flex-col transition-all hover:shadow-primary/5">
                    <div className="p-6 border-b border-border/50 flex items-center justify-between bg-muted/20">
                        <h3 className="text-lg font-black flex items-center gap-3">
                            <History className="text-primary" size={24} />
                            أحدث حركات العهد والأصول
                        </h3>
                        <button onClick={() => navigate('/admin-store')} className="text-xs font-bold text-primary hover:underline">عرض الكل</button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-right">
                            <thead className="bg-muted/30">
                                <tr>
                                    <th className="p-4 text-xs font-black text-muted-foreground uppercase">الصنف</th>
                                    <th className="p-4 text-xs font-black text-muted-foreground uppercase">السيريال</th>
                                    <th className="p-4 text-xs font-black text-muted-foreground uppercase">نوع الحركة</th>
                                    <th className="p-4 text-xs font-black text-muted-foreground uppercase">التفاصيل</th>
                                    <th className="p-4 text-xs font-black text-muted-foreground uppercase">الوقت</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/50">
                                {recentMovements?.map((move: any) => (
                                    <tr key={move.id} className="hover:bg-muted/10 transition-colors">
                                        <td className="p-4 font-bold text-sm">{move.asset?.itemType?.name}</td>
                                        <td className="p-4 font-mono text-sm">{move.asset?.serialNumber}</td>
                                        <td className="p-4">
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-black ${move.type === 'TRANSFER' ? 'bg-blue-500/10 text-blue-600' :
                                                move.type === 'IMPORT' ? 'bg-emerald-500/10 text-emerald-600' :
                                                    'bg-slate-500/10 text-slate-600'
                                                }`}>
                                                {move.type === 'TRANSFER' ? 'تحويل عهدة' :
                                                    move.type === 'IMPORT' ? 'استيراد جديد' :
                                                        'تغيير حالة'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-xs text-muted-foreground font-medium truncate max-w-[150px]" title={move.details}>
                                            {move.details || '-'}
                                        </td>
                                        <td className="p-4 text-xs text-muted-foreground font-bold">
                                            {new Date(move.createdAt).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}
                                        </td>
                                    </tr>
                                ))}
                                {(!recentMovements || recentMovements.length === 0) && (
                                    <tr>
                                        <td colSpan={5} className="p-10 text-center text-muted-foreground font-bold">لا يوجد حركات مسجلة حالياً</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* SIM Distribution List */}
                <div className="bg-card rounded-[2.5rem] border border-border shadow-2xl p-6 flex flex-col transition-all hover:shadow-primary/5">
                    <h3 className="text-lg font-black flex items-center gap-3 mb-6">
                        <Smartphone className="text-purple-500" size={24} />
                        توزيع الشرائح
                    </h3>
                    <div className="space-y-4 overflow-y-auto max-h-[400px] custom-scroll ml-1">
                        {simDistribution?.map((branch: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between p-4 bg-muted/30 rounded-2xl border border-transparent hover:border-border transition-all">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-purple-500/10 text-purple-600 flex items-center justify-center font-black text-xs">
                                        {idx + 1}
                                    </div>
                                    <span className="font-bold text-sm">{branch.name}</span>
                                </div>
                                <span className="font-black text-primary bg-primary/10 px-3 py-1 rounded-lg text-sm tabular-nums">
                                    {branch.count}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Quick Actions / Maintenance Feed Toggle */}
            <div className="flex justify-center">
                <button
                    onClick={() => refetch()}
                    className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-all font-bold text-sm"
                >
                    <RefreshCw size={16} />
                    تحديث البيانات تلقائياً
                </button>
            </div>
        </div>
    );
}
