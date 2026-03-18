import {
  Users, Building2, Activity, Clock, Zap,
  UserPlus, Settings, Cpu, Box, Database
} from 'lucide-react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import adminClient from '../api/adminClient';
import toast from 'react-hot-toast';
import { useState, useEffect } from 'react';

export default function Dashboard() {
    const navigate = useNavigate();
    const [stats, setStats] = useState<any>(null);

    const fetchStats = async () => {
        try {
            const res = await adminClient.get('/dashboard/stats');
            setStats(res.data);
        } catch (error) {
            toast.error('فشل في مزامنة بيانات لوحة التحكم');
        }
    };

    useEffect(() => {
        fetchStats();
    }, []);

    return (
        <div className="space-y-10 pb-10" dir="rtl">
            {/* Hero Section */}
            <div className="relative overflow-hidden bg-gradient-smart-blue rounded-[3rem] p-12 text-white shadow-2xl">
                <div className="absolute top-0 left-0 w-1/3 h-full bg-white/5 skew-x-12 transform -translate-x-20"></div>
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
                    <div>
                        <h1 className="text-5xl font-black tracking-tight uppercase mb-4">
                            مركز التحكم <span className="text-brand-cyan">الرئيسي</span>
                        </h1>
                        <p className="text-brand-cyan/80 font-bold uppercase tracking-[0.2em] text-[10px]">
                            مجموعة سمارت للخدمات المتكاملة • وحدة الإدارة المركزية 2026
                        </p>
                    </div>
                    <div className="flex gap-6">
                        <div className="text-center group cursor-pointer" onClick={() => navigate('/branches')}>
                            <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mb-2 group-hover:bg-brand-cyan/20 transition-all">
                                <Building2 size={24} className="text-brand-cyan" />
                            </div>
                            <p className="text-[10px] font-black uppercase">الفروع</p>
                        </div>
                        <div className="text-center group cursor-pointer" onClick={() => navigate('/parameters')}>
                            <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mb-2 group-hover:bg-brand-cyan/20 transition-all">
                                <Settings size={24} className="text-brand-cyan" />
                            </div>
                            <p className="text-[10px] font-black uppercase">الإعدادات</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard 
                    title="المستخدمين النشطين" 
                    value={stats?.usersCount || 0} 
                    icon={<Users />} 
                    trend="+12% نمو"
                    color="blue"
                />
                <MetricCard 
                    title="إجمالي الماكينات" 
                    value={stats?.totalMachines || 0} 
                    icon={<Cpu />} 
                    trend="+45 جهاز"
                    color="cyan"
                />
                <MetricCard 
                    title="حالة النظام" 
                    value={`${stats?.systemHealth || 100}%`} 
                    icon={<Activity />} 
                    trend="مستقرة"
                    color="green"
                />
                <MetricCard 
                    title="عمليات اليوم" 
                    value={stats?.dailyOps || 0} 
                    icon={<Zap />} 
                    trend="معدل طبيعي"
                    color="orange"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Performance Chart */}
                <div className="lg:col-span-2 bg-white rounded-[3rem] p-10 border border-slate-100 shadow-xl shadow-slate-200/50">
                    <div className="flex justify-between items-center mb-10">
                        <div>
                            <h3 className="text-2xl font-black text-brand-primary tracking-tight uppercase">معدلات الأداء العام</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">تحليل الإيرادات عبر شبكة الفروع</p>
                        </div>
                        <div className="flex gap-2">
                             <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
                                <div className="w-2 h-2 rounded-full bg-brand-primary animate-pulse ml-2"></div>
                                <span className="text-[10px] font-black text-brand-primary uppercase">بيانات حية</span>
                             </div>
                        </div>
                    </div>
                    <div className="h-80 w-full" dir="ltr">
                        <ResponsiveContainer width="100%" height="100%" minHeight={1}>
                            <BarChart data={stats?.performanceData || []}>
                                <defs>
                                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#0A2472" />
                                        <stop offset="100%" stopColor="#0E6BA8" />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis 
                                    dataKey="name" 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} 
                                />
                                <YAxis 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} 
                                />
                                <Tooltip 
                                    cursor={{ fill: '#f8fafc' }}
                                    contentStyle={{ 
                                        borderRadius: '1.5rem', 
                                        border: 'none', 
                                        boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                                        padding: '1.5rem',
                                        textAlign: 'right'
                                    }}
                                />
                                <Bar dataKey="revenue" fill="url(#barGradient)" radius={[15, 15, 0, 0]} barSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* System Logs */}
                <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-xl shadow-slate-200/50">
                    <div className="mb-10 text-right">
                        <h3 className="text-2xl font-black text-brand-primary tracking-tight uppercase">سجل الأحداث المركزية</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">تتبع التدفقات العالمية</p>
                    </div>
                    <div className="space-y-6">
                        {stats?.recentActions.map((log: any) => (
                            <div key={log.id} className="flex gap-4 group cursor-pointer hover:-translate-x-2 transition-all">
                                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-brand-primary group-hover:text-white transition-all shadow-sm">
                                    <Clock size={18} />
                                </div>
                                <div className="flex-1 border-b border-slate-50 pb-4 group-last:border-0 text-right">
                                    <p className="text-sm font-black text-brand-primary group-hover:text-brand-blue transition-colors">
                                        {log.action}
                                    </p>
                                    <div className="flex items-center gap-3 mt-1.5 justify-end">
                                        <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">{log.time}</span>
                                        <span className="text-[9px] font-black px-2 py-0.5 bg-slate-100 text-slate-500 rounded uppercase tracking-tighter">{log.branch}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <button 
                        onClick={() => navigate('/reports')}
                        className="w-full mt-8 py-4 bg-slate-50 text-slate-400 hover:text-brand-primary hover:bg-slate-100 rounded-2xl font-black uppercase tracking-widest text-[9px] transition-all"
                    >
                        عرض التقارير المالية المفصلة
                    </button>
                </div>
            </div>

            {/* Control Groups */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <ControlBox 
                    title="الوصول والمستخدمين" 
                    desc="إدارة الموظفين والصلاحيات والأدوار" 
                    icon={<UserPlus />} 
                    onClick={() => navigate('/users')}
                    color="blue"
                />
                <ControlBox 
                    title="المخزون العام" 
                    desc="التحكم في العهد وقطع الغيار" 
                    icon={<Box />} 
                    onClick={() => navigate('/spare-parts')}
                    color="cyan"
                />
                <ControlBox 
                    title="النسخ الاحتياطي" 
                    desc="مراقبة واستعادة بيانات الفروع" 
                    icon={<Database />} 
                    onClick={() => navigate('/branches')}
                    color="purple"
                />
            </div>
        </div>
    );
}

function MetricCard({ title, value, icon, trend, color }: any) {
    const colorStyles = {
        blue: 'text-brand-primary bg-brand-primary/5',
        cyan: 'text-brand-cyan bg-brand-cyan/5',
        green: 'text-green-600 bg-green-50',
        orange: 'text-orange-500 bg-orange-50',
    };

    return (
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all group overflow-hidden relative text-right">
            <div className="absolute top-0 left-0 w-32 h-32 bg-slate-50/50 rounded-full -translate-x-12 -translate-y-12 group-hover:scale-150 transition-all duration-700"></div>
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 relative z-10 mr-0 ml-auto ${colorStyles[color as keyof typeof colorStyles]}`}>
                {icon}
            </div>
            <div className="relative z-10">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</p>
                <div className="flex items-end justify-between flex-row-reverse">
                    <h2 className="text-3xl font-black text-brand-primary tracking-tighter">{value}</h2>
                    <span className="text-[9px] font-black px-2 py-1 bg-slate-50 rounded-lg text-slate-500 uppercase tracking-tighter">{trend}</span>
                </div>
            </div>
        </div>
    );
}

function ControlBox({ title, desc, icon, onClick, color }: any) {
    const variants = {
        blue: 'hover:bg-brand-primary hover:text-white border-brand-primary/10',
        cyan: 'hover:bg-brand-cyan hover:text-white border-brand-cyan/10',
        purple: 'hover:bg-brand-purple hover:text-white border-brand-purple/10',
    };

    return (
        <div 
            onClick={onClick}
            className={`cursor-pointer bg-white p-10 rounded-[3rem] border transition-all shadow-sm group ${variants[color as keyof typeof variants]}`}
        >
            <div className="flex items-start gap-6 flex-row-reverse">
                <div className="shrink-0 w-16 h-16 bg-slate-50 rounded-[1.5rem] flex items-center justify-center text-slate-400 group-hover:bg-white/20 group-hover:text-white transition-all shadow-sm ml-0 mr-auto">
                    {icon}
                </div>
                <div className="text-right">
                    <h4 className="font-black text-xl tracking-tight uppercase group-hover:text-white transition-colors">{title}</h4>
                    <p className="text-sm font-medium opacity-60 mt-1">{desc}</p>
                </div>
            </div>
        </div>
    );
}
