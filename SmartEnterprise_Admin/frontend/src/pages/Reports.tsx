import { useState, useEffect } from 'react';
import adminClient from '../api/adminClient';
import { 
  TrendingUp, DollarSign, Download, RefreshCw, 
  ChevronRight, Calendar, Building, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Cell
} from 'recharts';
import toast from 'react-hot-toast';

export default function Reports() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const fetchReports = async () => {
        try {
            setLoading(true);
            const res = await adminClient.get('/reports/financial-summary');
            setData(res.data);
        } catch (error) {
            toast.error('فشل في تحميل التقارير المالية');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReports();
    }, []);

    const COLORS = ['#0A2472', '#0E6BA8', '#A6E1FA', '#001D4A', '#22C55E'];

    return (
        <div className="space-y-10 pb-20 font-arabic" dir="rtl">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-4xl font-black text-brand-primary italic uppercase tracking-tight flex items-center gap-3">
                        <TrendingUp className="text-brand-cyan" size={40} />
                        التدقيق <span className="text-brand-cyan">المالي الموحد</span>
                    </h1>
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mt-2">مراجعة الإيرادات والتدفقات النقدية عبر شبكة الفروع</p>
                </div>
                <div className="flex gap-4">
                     <button onClick={fetchReports} className="p-4 bg-white text-slate-400 rounded-2xl border border-slate-100 hover:text-brand-primary transition-all active:scale-95 shadow-sm">
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <button className="flex items-center gap-3 px-8 py-4 bg-brand-primary text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-brand-blue shadow-lg shadow-brand-primary/10 transition-all">
                        <Download size={18} />
                        تصدير الدفتر الأستاذ العام
                    </button>
                </div>
            </div>

            {/* Quick Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <SummaryCard 
                    title="إجمالي إيرادات المجموعة" 
                    value={`${data?.totalEnterpriseRevenue?.toLocaleString() || 0} ج.م`} 
                    trend="+15.4%" 
                    isUp={true}
                    icon={<DollarSign />} 
                />
                <SummaryCard 
                    title="متوسط دخل الفرع" 
                    value={`${(data?.totalEnterpriseRevenue / (data?.branchBreakdown?.length || 1)).toLocaleString(undefined, {maximumFractionDigits: 0}) || 0} ج.م`} 
                    trend="+5.2%" 
                    isUp={true}
                    icon={<Building />} 
                />
                <SummaryCard 
                    title="مستحقات معلقة" 
                    value="12,450 ج.م" 
                    trend="-2.1%" 
                    isUp={false}
                    icon={<Calendar />} 
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Revenue Breakdown by Branch */}
                <div className="lg:col-span-2 bg-white rounded-[3rem] p-10 border border-slate-100 shadow-xl shadow-slate-200/50">
                    <div className="flex justify-between items-center mb-10">
                        <div>
                            <h3 className="text-2xl font-black text-brand-primary tracking-tight uppercase">تصنيف أرباح الفروع</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">تتبع أداء العقد في الوقت الفعلي</p>
                        </div>
                    </div>
                    <div className="h-96 w-full" dir="ltr">
                        <ResponsiveContainer width="100%" height="100%" minHeight={1}>
                            <BarChart data={data?.branchBreakdown || []}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="branchName" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} />
                                <Tooltip 
                                    cursor={{ fill: '#f8fafc' }}
                                    contentStyle={{ borderRadius: '1.5rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '1.5rem', textAlign: 'right' }}
                                />
                                <Bar dataKey="revenue" radius={[10, 10, 0, 0]} barSize={50}>
                                    {(data?.branchBreakdown || []).map((_entry: any, index: number) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Data Insights */}
                <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-xl shadow-slate-200/50">
                     <div className="mb-10 text-right">
                        <h3 className="text-2xl font-black text-brand-primary tracking-tight uppercase">تحليل الشبكة</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">تدقيق تقاطع العقد البرمجية</p>
                    </div>
                    <div className="space-y-8">
                        {data?.branchBreakdown?.sort((a: any, b: any) => b.revenue - a.revenue).map((b: any, idx: number) => (
                            <div key={b.branchId} className="flex items-center justify-between group cursor-default flex-row-reverse">
                                <div className="flex items-center gap-4 flex-row-reverse">
                                    <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center font-black text-slate-400 group-hover:bg-brand-primary group-hover:text-white transition-all ml-0 mr-auto">
                                        {idx + 1}
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-black text-brand-primary uppercase group-hover:text-brand-blue transition-colors">{b.branchName}</p>
                                        <p className="text-[9px] font-bold text-slate-300 uppercase mt-0.5">{b.requestCount} عملية صيانة تنفييذية</p>
                                    </div>
                                </div>
                                <div className="text-left">
                                    <p className="text-sm font-black text-slate-700">{b.revenue.toLocaleString()} ج.م</p>
                                    <div className="flex items-center gap-1 justify-start mt-0.5">
                                        <div className="w-1 h-1 rounded-full bg-emerald-500"></div>
                                        <p className="text-[8px] font-black text-emerald-500 uppercase tracking-tighter">أداء مرتفع</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <button className="w-full mt-10 py-5 bg-brand-primary/5 text-brand-primary hover:bg-brand-primary hover:text-white rounded-[1.5rem] font-black uppercase tracking-widest text-[10px] transition-all shadow-sm">
                        عرض كشف الحساب المركزي الشامل
                    </button>
                </div>
            </div>

            {/* Detailed Ledger Section */}
            <div className="bg-white rounded-[3rem] border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden">
                <div className="p-10 border-b border-slate-50 flex justify-between items-center flex-row-reverse">
                    <div className="text-right">
                        <h3 className="text-2xl font-black text-brand-primary tracking-tight uppercase">دفتر الأستاذ الموحد</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">سجل المعاملات المالي الموحد للمجموعة</p>
                    </div>
                    <div className="flex gap-4">
                        <div className="px-6 py-3 bg-slate-50 rounded-xl flex items-center gap-3">
                            <Calendar size={16} className="text-slate-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">مارس 2026 (على مستوى الشبكة)</span>
                        </div>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-right">
                        <thead>
                            <tr className="bg-slate-50/50">
                                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">تتبع المعاملة</th>
                                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">الإيرادات (ج.م)</th>
                                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">كثافة العمليات</th>
                                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">قاعدة العملاء</th>
                                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">أجهزة الـ POS</th>
                                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">حجم المخزون</th>
                                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-left">الإجراء</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {data?.branchBreakdown?.map((b: any) => (
                                <tr key={b.branchId} className="group hover:bg-slate-50/20 transition-colors">
                                    <td className="px-10 py-6">
                                        <div className="flex items-center gap-4 flex-row-reverse">
                                            <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-brand-cyan group-hover:text-white transition-all shadow-inner">
                                                <Building size={18} />
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-black text-brand-primary uppercase">{b.branchName}</p>
                                                <p className="text-[9px] font-bold text-slate-300 uppercase mt-0.5">معرف العقدة: {b.branchId.slice(-5)}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-10 py-6">
                                        <span className="text-sm font-black text-slate-700">{b.revenue.toLocaleString()}</span>
                                    </td>
                                    <td className="px-10 py-6">
                                        <div className="flex items-center gap-3 flex-row-reverse">
                                            <div className="h-1.5 w-24 bg-slate-100 rounded-full overflow-hidden">
                                                <div className="h-full bg-brand-primary rounded-full transition-all" style={{ width: `${Math.min(b.requestCount * 5, 100)}%` }}></div>
                                            </div>
                                            <span className="text-[10px] font-black text-slate-400">{b.requestCount}</span>
                                        </div>
                                    </td>
                                     <td className="px-10 py-6">
                                        <span className="text-sm font-black text-slate-700">{b.customerCount}</span>
                                    </td>
                                     <td className="px-10 py-6">
                                        <span className="text-sm font-black text-slate-700">{b.machineCount}</span>
                                    </td>
                                     <td className="px-10 py-6">
                                        <span className="text-sm font-black text-slate-700">{b.stockCount}</span>
                                    </td>
                                    <td className="px-10 py-6 text-left">
                                        <button className="p-3 bg-slate-50 text-slate-300 hover:text-brand-primary hover:bg-white rounded-xl transition-all shadow-sm">
                                            <ChevronRight size={18} className="transform rotate-180" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function SummaryCard({ title, value, trend, isUp, icon }: any) {
    return (
        <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden text-right">
            <div className="absolute top-0 left-0 w-32 h-32 bg-slate-50/50 rounded-full -translate-x-12 -translate-y-12 group-hover:scale-150 transition-all duration-700"></div>
            <div className="flex justify-between items-start relative z-10 flex-row-reverse">
                <div className="w-14 h-14 bg-brand-primary/5 text-brand-primary rounded-2xl flex items-center justify-center mb-10 group-hover:bg-brand-primary group-hover:text-white transition-all shadow-sm">
                    {icon}
                </div>
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-tighter shadow-sm ${isUp ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                    {isUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                    {trend}
                </div>
            </div>
            <div className="relative z-10">
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">{title}</p>
                <h2 className="text-3xl font-black text-brand-primary tracking-tighter uppercase">{value}</h2>
            </div>
        </div>
    );
}
