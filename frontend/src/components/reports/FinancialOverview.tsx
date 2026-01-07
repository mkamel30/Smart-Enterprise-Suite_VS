import React from 'react';
import { TrendingUp, Zap, Target, Package } from 'lucide-react';
import {
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area,
    Cell,
    PieChart as RechartsPieChart,
    Pie
} from 'recharts';
import { StatCard } from './StatCard';

interface FinancialOverviewProps {
    data: any;
}

export function FinancialOverview({ data }: FinancialOverviewProps) {
    if (!data || !data.financials) return null;
    const { financials, trends } = data;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="إجمالي المبيعات"
                    value={financials.totalSales}
                    icon={<TrendingUp />}
                    color="blue"
                    suffix="ج.م"
                />
                <StatCard
                    title="إجمالي التحصيلات"
                    value={financials.totalCollected}
                    icon={<Zap />}
                    color="emerald"
                    suffix="ج.م"
                    breakdown={financials.breakdown}
                />
                <StatCard
                    title="المديونية المتبقية"
                    value={financials.totalOutstanding}
                    icon={<Target />}
                    color="orange"
                    suffix="ج.م"
                />
                <StatCard
                    title="قيمة المخزون"
                    value={financials.inventoryValue}
                    icon={<Package />}
                    color="purple"
                    suffix="ج.م"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Sales Trend Chart */}
                <div className="lg:col-span-2 bg-card rounded-[2.5rem] border border-border p-8 shadow-xl">
                    <h3 className="text-xl font-black mb-8 flex items-center gap-3">
                        <TrendingUp className="text-blue-500" />
                        منحنى تطور الأداء المالي (6 أشهر)
                    </h3>
                    <div className="h-[350px] w-full" dir="ltr">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trends}>
                                <defs>
                                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorCollections" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12, fontWeight: 700 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12, fontWeight: 700 }} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '20px', border: '1px solid hsl(var(--border))', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.1)' }}
                                />
                                <Area type="monotone" dataKey="sales" name="المبيعات المتوقعة" stroke="hsl(var(--primary))" strokeWidth={4} fillOpacity={1} fill="url(#colorSales)" />
                                <Area type="monotone" dataKey="collections" name="التحصيلات الفعلية" stroke="#10b981" strokeWidth={4} fillOpacity={1} fill="url(#colorCollections)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Collection Ratio */}
                <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-primary/20 transition-all" />
                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-10">نسبة التحصيل الإجمالية</h3>

                    <div className="flex flex-col items-center justify-center h-full pb-10">
                        <div className="relative w-48 h-48">
                            <ResponsiveContainer width="100%" height="100%">
                                <RechartsPieChart>
                                    <Pie
                                        data={[
                                            { name: 'Collected', value: financials.totalCollected },
                                            { name: 'Remaining', value: financials.totalOutstanding }
                                        ]}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={65}
                                        outerRadius={85}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        <Cell fill="hsl(var(--primary))" />
                                        <Cell fill="rgba(255,255,255,0.05)" />
                                    </Pie>
                                </RechartsPieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-4xl font-black">
                                    {Math.round((financials.totalCollected / financials.totalSales) * 100)}%
                                </span>
                                <span className="text-[10px] font-bold text-slate-500">تم تحصيله</span>
                            </div>
                        </div>

                        <div className="mt-10 space-y-4 w-full">
                            <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/5">
                                <span className="text-sm font-bold text-slate-400">نقدية محصلة</span>
                                <span className="font-black text-emerald-400">{financials.totalCollected.toLocaleString()} ج.م</span>
                            </div>
                            <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/5">
                                <span className="text-sm font-bold text-slate-400">ديون معلقة</span>
                                <span className="font-black text-orange-400">{financials.totalOutstanding.toLocaleString()} ج.م</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
