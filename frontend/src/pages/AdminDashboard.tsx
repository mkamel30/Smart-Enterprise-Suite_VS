import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import {
    Users,
    Building2,
    Activity,
    TrendingUp,
    Clock,
    Search,
    Zap,
    Package,
    UserPlus,
    Settings,
    FileText,
    PlusCircle,
    AlertTriangle
} from 'lucide-react';
import {
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface AdminSummary {
    usersCount: number;
    branchesCount: number;
    totalMachines: number;
    dailyOps: number;
    branchPerformance: Array<{
        name: string;
        revenue: number;
        repairs: number;
    }>;
    adminAffairsStats: Array<{
        id: string;
        name: string;
        machineTransfers: number;
        simTransfers: number;
    }>;
    maintenanceCenterStats: Array<{
        id: string;
        name: string;
        partTransfers: number;
        inRepair: number;
        repaired: number;
    }>;
    systemHealth: {
        score: number;
        errorCount: number;
    };
    globalLowStock: Array<{
        name: string;
        partNumber: string;
        totalQuantity: number;
    }>;
}

export default function AdminDashboard() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<{ machines: any[]; customers: any[] } | null>(null);
    const [isSearching, setIsSearching] = useState(false);

    const { data: globalStats, isLoading } = useQuery<AdminSummary>({
        queryKey: ['admin-global-stats'],
        queryFn: () => api.getAdminSummary(),
        refetchInterval: 60000,
        enabled: !!user
    });

    const { data: logs } = useQuery({
        queryKey: ['recent-logs'],
        queryFn: () => api.getLogs(5),
        refetchInterval: 30000,
        enabled: !!user
    });

    // Handle search logic
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (searchQuery.length >= 2) {
                setIsSearching(true);
                try {
                    const results = await api.globalSearch(searchQuery);
                    setSearchResults(results);
                } catch (err) {
                    console.error('Search error:', err);
                } finally {
                    setIsSearching(false);
                }
            } else {
                setSearchResults(null);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-muted border-t-primary rounded-full animate-spin"></div>
                    <p className="text-muted-foreground font-bold animate-pulse">جاري تحميل لوحة التحكم الإدارية...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="px-8 pt-4 pb-8 bg-background min-h-screen space-y-8 animate-fade-in" dir="rtl">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-4xl font-black text-foreground mb-2 flex items-center gap-3">
                        <Activity className="text-primary" size={32} />
                        مركز التحكم العام
                    </h1>
                    <p className="text-muted-foreground font-medium">نظرة شاملة على أداء كل الفروع والمستخدمين في الوقت الفعلي</p>
                </div>
                <div className="flex items-center gap-4 w-full md:w-auto relative">
                    <div className="relative group flex-1 md:flex-none">
                        <Search className={`absolute right-4 top-1/2 -translate-y-1/2 transition-colors ${isSearching ? 'text-primary animate-pulse' : 'text-muted-foreground group-focus-within:text-primary'}`} size={18} />
                        <input
                            placeholder="بحث سريع (سيريال أو كود عميل)..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-card border border-border text-sm rounded-2xl pr-12 pl-4 py-3 w-full md:w-80 outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all shadow-inner font-bold"
                        />

                        {/* Search Results Dropdown */}
                        {searchResults && (searchResults.machines.length > 0 || searchResults.customers.length > 0) && (
                            <div className="absolute top-full right-0 left-0 mt-2 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden z-100 animate-slide-up">
                                <div className="max-h-100 overflow-y-auto custom-scroll">
                                    {searchResults.machines.length > 0 && (
                                        <div className="p-2">
                                            <p className="px-4 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest bg-muted/30 rounded-lg mb-1">الماكينات</p>
                                            {searchResults.machines.map((m: any) => (
                                                <button
                                                    key={m.id}
                                                    onClick={() => navigate('/warehouse-machines', { state: { highlight: m.serialNumber } })}
                                                    className="w-full text-right p-3 hover:bg-primary/5 rounded-xl transition-colors flex items-center justify-between group"
                                                >
                                                    <div>
                                                        <p className="font-black text-sm group-hover:text-primary transition-colors">{m.serialNumber}</p>
                                                        <p className="text-[10px] text-muted-foreground font-bold">{m.model} • {m.branch?.name}</p>
                                                    </div>
                                                    <span className={`text-[9px] font-black px-2 py-1 rounded-lg border ${m.status === 'STANDBY' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-blue-500/10 text-blue-500 border-blue-500/20'}`}>
                                                        {m.status}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {searchResults.customers.length > 0 && (
                                        <div className="p-2 border-t border-border/50">
                                            <p className="px-4 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest bg-muted/30 rounded-lg mb-1">العملاء</p>
                                            {searchResults.customers.map((c: any) => (
                                                <button
                                                    key={c.id}
                                                    onClick={() => navigate('/customers', { state: { highlight: c.bkcode } })}
                                                    className="w-full text-right p-3 hover:bg-primary/5 rounded-xl transition-colors flex items-center group"
                                                >
                                                    <div className="flex-1">
                                                        <p className="font-black text-sm group-hover:text-primary transition-colors">{c.name}</p>
                                                        <p className="text-[10px] text-muted-foreground font-bold">{c.bkcode} • {c.branch?.name}</p>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {searchResults && searchResults.machines.length === 0 && searchResults.customers.length === 0 && (
                            <div className="absolute top-full right-0 left-0 mt-2 bg-card border border-border rounded-2xl shadow-xl p-6 text-center z-100 animate-slide-up">
                                <p className="text-muted-foreground text-sm font-bold">لا توجد نتائج مطابقة</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Top Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <HighlightCard
                    title="إجمالي المستخدمين"
                    value={globalStats?.usersCount || 0}
                    icon={<Users size={24} />}
                    color="blue"
                    onClick={() => navigate('/technicians')}
                />
                <HighlightCard
                    title="الفروع النشطة"
                    value={globalStats?.branchesCount || 0}
                    icon={<Building2 size={24} />}
                    color="emerald"
                    onClick={() => navigate('/branches')}
                />
                <HighlightCard
                    title="العمليات اليومية"
                    value={globalStats?.dailyOps || 0}
                    icon={<Activity size={24} />}
                    color="orange"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Branch Performance Comparison */}
                <div className="lg:col-span-2 bg-card rounded-[2.5rem] border border-border shadow-2xl shadow-primary/5 p-8 transition-all hover:shadow-primary/10">
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="text-xl font-black flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-primary/10 text-primary">
                                <TrendingUp size={24} />
                            </div>
                            أداء الفروع المالي (الإيرادات)
                        </h3>
                        <div className="flex gap-2">
                            <span className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                                <span className="w-2.5 h-2.5 rounded-full bg-primary" /> الإيرادات بالجنيه
                            </span>
                        </div>
                    </div>
                    <div className="h-95 w-full" dir="ltr">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                            <BarChart data={globalStats?.branchPerformance || []}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontWeight: 700 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontWeight: 700 }} />
                                <Tooltip
                                    cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
                                    contentStyle={{
                                        borderRadius: '20px',
                                        backgroundColor: 'hsl(var(--card))',
                                        border: '1px solid hsl(var(--border))',
                                        boxShadow: '0 20px 40px -10px rgb(0 0 0 / 0.2)',
                                        backdropFilter: 'blur(10px)'
                                    }}
                                />
                                <Bar dataKey="revenue" name="الإيرادات" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} barSize={50} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* System & Actions Section */}
                <div className="space-y-6">
                    {/* Operational Status (Real) */}
                    <div className="bg-slate-900 border border-slate-800 text-white rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden group">
                        <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl group-hover:bg-primary/20 transition-all duration-700" />
                        <h3 className="text-xs font-black text-slate-500 mb-8 uppercase tracking-[0.2em] relative z-10">الحالة التشغيلية الذكية</h3>
                        <div className="space-y-8 relative z-10">
                            <HealthMeter
                                label="كفاءة النظام (Success Rate)"
                                value={globalStats?.systemHealth?.score || 100}
                                color={(globalStats?.systemHealth?.score ?? 100) < 90 ? "bg-amber-500" : "bg-emerald-500"}
                            />
                            <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                                <div className="flex items-center gap-3">
                                    <AlertTriangle size={20} className={(globalStats?.systemHealth?.errorCount || 0) > 0 ? "text-amber-500" : "text-emerald-500"} />
                                    <div>
                                        <p className="text-[10px] font-black text-slate-500 uppercase">أخطاء السجل (24س)</p>
                                        <p className="text-xl font-black">{globalStats?.systemHealth?.errorCount || 0}</p>
                                    </div>
                                </div>
                                <span className="text-[10px] font-bold text-slate-400">نظام المراقبة نشط</span>
                            </div>
                        </div>
                    </div>

                    {/* Quick Actions Panel */}
                    <div className="bg-card rounded-[2.5rem] border border-border shadow-xl p-8 transition-all hover:shadow-2xl">
                        <h3 className="text-sm font-black text-muted-foreground mb-6 uppercase tracking-wider">إجراءات سريعة</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => navigate('/technicians')}
                                className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-primary/5 border border-primary/10 hover:bg-primary/10 transition-all group"
                            >
                                <UserPlus size={20} className="text-primary group-hover:scale-110 transition-transform" />
                                <span className="text-[10px] font-bold">إضافة مستخدم</span>
                            </button>
                            <button
                                onClick={() => navigate('/branches')}
                                className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 hover:bg-emerald-500/10 transition-all group"
                            >
                                <PlusCircle size={20} className="text-emerald-500 group-hover:scale-110 transition-transform" />
                                <span className="text-[10px] font-bold">فرع جديد</span>
                            </button>
                            <button
                                onClick={() => navigate('/reports')}
                                className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10 hover:bg-blue-500/10 transition-all group"
                            >
                                <FileText size={20} className="text-blue-500 group-hover:scale-110 transition-transform" />
                                <span className="text-[10px] font-bold">تقارير إدارية</span>
                            </button>
                            <button
                                onClick={() => navigate('/settings')}
                                className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-slate-500/5 border border-slate-500/10 hover:bg-slate-500/10 transition-all group"
                            >
                                <Settings size={20} className="text-slate-500 group-hover:scale-110 transition-transform" />
                                <span className="text-[10px] font-bold">الإعدادات</span>
                            </button>
                        </div>
                    </div>

                    {/* Recent Admin Logs */}
                    <div className="bg-card rounded-[2.5rem] border border-border shadow-xl p-8 transition-all hover:shadow-2xl">
                        <h3 className="text-xl font-black mb-6 flex items-center gap-3">
                            <Clock size={24} className="text-primary" />
                            السجلات الإدارية
                        </h3>
                        <div className="space-y-5">
                            {logs?.map((log: any) => (
                                <div key={log.id} className="flex gap-4 pb-5 border-b border-border/50 last:border-0 last:pb-0 group/log">
                                    <div className="w-2 h-2 rounded-full bg-border mt-2 shrink-0 group-hover/log:bg-primary transition-colors" />
                                    <div className="min-w-0">
                                        <p className="text-sm text-foreground font-black group-hover/log:text-primary transition-colors truncate">{log.action}</p>
                                        <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-2">
                                            <span className="font-bold">{log.performedBy}</span>
                                            <span className="opacity-40">•</span>
                                            <span className="font-mono">{new Date(log.createdAt).toLocaleTimeString('ar-EG')}</span>
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Specialized Centers Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Maintenance Centers Analysis */}
                <div className="bg-card rounded-[2.5rem] border border-border shadow-2xl p-8 overflow-hidden relative">
                    <div className="flex items-center justify-between mb-10">
                        <h3 className="text-xl font-black flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-orange-500/10 text-orange-500">
                                <Zap size={24} />
                            </div>
                            تحليل أداء مراكز الصيانة
                        </h3>
                    </div>

                    <div className="space-y-6">
                        {globalStats?.maintenanceCenterStats?.map(center => (
                            <div key={center.id} className="bg-muted/30 p-6 rounded-3xl border border-border/50 group hover:border-orange-500/30 transition-all">
                                <p className="text-lg font-black mb-4 flex items-center gap-2">
                                    <span className="w-1.5 h-6 bg-orange-500 rounded-full" />
                                    {center.name}
                                </p>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="text-center">
                                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">تحويلات ق.غ</p>
                                        <p className="text-xl font-black text-foreground">{center.partTransfers}</p>
                                    </div>
                                    <div className="text-center border-x border-border/50">
                                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">قيد الإصلاح</p>
                                        <p className="text-xl font-black text-orange-500">{center.inRepair}</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">تم الإصلاح</p>
                                        <p className="text-xl font-black text-emerald-500">{center.repaired}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Admin Affairs Analysis */}
                <div className="bg-card rounded-[2.5rem] border border-border shadow-2xl p-8 overflow-hidden relative">
                    <div className="flex items-center justify-between mb-10">
                        <h3 className="text-xl font-black flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
                                <Package size={24} />
                            </div>
                            توزيع الأصول (الشئون الإدارية)
                        </h3>
                    </div>

                    <div className="space-y-6">
                        {globalStats?.adminAffairsStats?.map(dept => (
                            <div key={dept.id} className="bg-muted/30 p-6 rounded-3xl border border-border/50 group hover:border-blue-500/30 transition-all">
                                <p className="text-lg font-black mb-4 flex items-center gap-2">
                                    <span className="w-1.5 h-6 bg-blue-500 rounded-full" />
                                    {dept.name}
                                </p>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-background/50 p-4 rounded-2xl border border-border/30">
                                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">تحويلات الماكينات</p>
                                        <p className="text-2xl font-black text-blue-500">{dept.machineTransfers}</p>
                                    </div>
                                    <div className="bg-background/50 p-4 rounded-2xl border border-border/30">
                                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">تحويلات الشرائح</p>
                                        <p className="text-2xl font-black text-emerald-500">{dept.simTransfers}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Global Inventory Alerts (New) */}
                <div className="bg-card rounded-[2.5rem] border border-border shadow-2xl p-8 transition-all hover:shadow-primary/5">
                    <h3 className="text-xl font-black mb-10 flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-red-500/10 text-red-500">
                            <TrendingUp size={24} className="rotate-180" />
                        </div>
                        تنبيهات المخزون الشبكي
                    </h3>

                    <div className="space-y-4">
                        {(globalStats?.globalLowStock?.length || 0) === 0 && (
                            <div className="p-12 text-center text-muted-foreground font-bold">
                                <Activity className="mx-auto mb-4 opacity-20" size={48} />
                                جميع مستويات القطع آمنة عبر الشبكة
                            </div>
                        )}
                        {globalStats?.globalLowStock?.map((item: any) => (
                            <div key={item.partNumber} className="flex items-center justify-between p-4 bg-red-500/5 border border-red-500/10 rounded-2xl group hover:bg-red-500/10 transition-all">
                                <div>
                                    <p className="text-sm font-black group-hover:text-red-500 transition-colors">{item.name}</p>
                                    <p className="text-[10px] font-bold text-muted-foreground">{item.partNumber}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-black text-red-500">عجز حرج</p>
                                    <p className="text-sm font-black">{item.totalQuantity} قطعة</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

function HighlightCard({ title, value, icon, color, onClick }: any) {
    const colors: any = {
        blue: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
        emerald: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
        purple: 'text-purple-500 bg-purple-500/10 border-purple-500/20',
        orange: 'text-orange-500 bg-orange-500/10 border-orange-500/20',
    };

    return (
        <div
            onClick={onClick}
            className={`p-8 rounded-4xl border border-border bg-card shadow-lg shadow-primary/5 hover:shadow-xl hover:shadow-primary/10 transition-all group relative overflow-hidden ${onClick ? 'cursor-pointer active:scale-[0.98]' : ''}`}
        >
            <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-5 transition-transform group-hover:scale-150 ${colors[color].split(' ')[1]}`} />

            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-all group-hover:scale-110 border shadow-inner ${colors[color]}`}>
                {icon}
            </div>
            <p className="text-muted-foreground text-sm font-bold tracking-tight uppercase">{title}</p>
            <h2 className="text-4xl font-black text-foreground mt-2 tracking-tighter">{value}</h2>
        </div>
    );
}

function HealthMeter({ label, value, color }: any) {
    return (
        <div className="space-y-3">
            <div className="flex justify-between text-[11px] font-black tracking-widest uppercase">
                <span className="text-slate-500">{label}</span>
                <span className="text-white bg-white/10 px-2 py-0.5 rounded-lg">{value}%</span>
            </div>
            <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden p-0.5 border border-white/5 shadow-inner">
                <div
                    className={`h-full rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(34,197,94,0.3)] ${color}`}
                    style={{ width: `${value}%` }}
                />
            </div>
        </div>
    );
}
