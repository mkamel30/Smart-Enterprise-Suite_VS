import React, { useMemo } from 'react';
import { Package, TrendingUp, DollarSign, Percent, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import {
    AreaChart,
    Area,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell
} from 'recharts';
import { StatCard } from './StatCard';

interface InventoryMovementReportProps {
    data: any;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export function InventoryMovementReport({ data }: InventoryMovementReportProps) {
    if (!data || !data.timeline) return null;
    const { timeline, branchBreakdown, summary, metadata } = data;

    // Prepare chart data
    const chartData = useMemo(() => {
        return timeline.map((item: any) => ({
            name: item.month,
            paid: item.allocation.paid.value,
            free: item.allocation.freeWarranty.value,
            total: item.allocation.total.value
        })).reverse(); // Chronological order for chart
    }, [timeline]);

    const formatCurrency = (value: number) => {
        if (value >= 1000000) return `${(value / 1000000).toFixed(1)} مليون`;
        if (value >= 1000) return `${(value / 1000).toFixed(0)} ألف`;
        return value.toString();
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="إجمالي قيمة القطع"
                    value={summary.grandTotal?.value || 0}
                    icon={<Package />}
                    color="blue"
                    suffix="ج.م"
                />
                <StatCard
                    title="صيانة مدفوعة"
                    value={summary.paidTotal?.value || 0}
                    icon={<DollarSign />}
                    color="emerald"
                    suffix="ج.م"
                />
                <StatCard
                    title="ضمان مجاني"
                    value={summary.freeTotal?.value || 0}
                    icon={<TrendingUp />}
                    color="orange"
                    suffix="ج.م"
                />
                <StatCard
                    title="نسبة المدفوع"
                    value={Math.round((summary.avgPaidPercentage || 0) * 100)}
                    icon={<Percent />}
                    color="purple"
                    suffix="%"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Timeline Chart */}
                <div className="lg:col-span-2 bg-card rounded-[2.5rem] border border-border p-8 shadow-xl">
                    <h3 className="text-xl font-black mb-8 flex items-center gap-3">
                        <TrendingUp className="text-blue-500" />
                        حركة قطع الغيار الشهرية
                    </h3>
                    <div className="h-[350px] w-full" dir="ltr">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorPaid" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorFree" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 600 }} />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12, fontWeight: 700 }}
                                    tickFormatter={formatCurrency}
                                />
                                <Tooltip
                                    contentStyle={{ borderRadius: '16px', border: '1px solid hsl(var(--border))', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.1)' }}
                                    formatter={(value: any) => [value.toLocaleString() + ' ج.م', '']}
                                />
                                <Area type="monotone" dataKey="paid" name="مدفوع" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorPaid)" stackId="1" />
                                <Area type="monotone" dataKey="free" name="ضمان" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorFree)" stackId="1" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Monthly Breakdown */}
                <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-16 -mt-16" />
                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-8">تفاصيل شهرية</h3>

                    <div className="space-y-4 max-h-[300px] overflow-y-auto scrollbar-thin pr-2">
                        {timeline.slice(0, 6).map((month: any) => (
                            <div key={month.month} className="p-4 bg-slate-800/50 rounded-2xl">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-slate-400 font-medium">{month.month}</span>
                                    <span className="text-white font-black">{formatCurrency(month.allocation.total.value)}</span>
                                </div>
                                <div className="flex gap-4 text-xs">
                                    <span className="text-emerald-400">مدفوع: {(month.paidPercentage * 100).toFixed(0)}%</span>
                                    <span className="text-yellow-400">ضمان: {(month.freePercentage * 100).toFixed(0)}%</span>
                                </div>
                                <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden mt-2 flex">
                                    <div
                                        className="h-full bg-emerald-500 transition-all duration-500"
                                        style={{ width: `${(month.paidPercentage * 100)}%` }}
                                    />
                                    <div
                                        className="h-full bg-yellow-500 transition-all duration-500"
                                        style={{ width: `${(month.freePercentage * 100)}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Branch Breakdown */}
            {branchBreakdown && branchBreakdown.length > 0 && (
                <div className="bg-card rounded-[2.5rem] border border-border p-8 shadow-xl">
                    <h3 className="text-xl font-black mb-6 flex items-center gap-3">
                        <Package className="text-purple-500" />
                        توزيع الفروع
                    </h3>
                    <div className="h-[300px] w-full" dir="ltr">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={branchBreakdown.slice(0, 10)} layout="vertical" margin={{ left: 100 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="hsl(var(--border))" />
                                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12, fontWeight: 700 }} tickFormatter={formatCurrency} />
                                <YAxis type="category" dataKey="branchName" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 600 }} width={100} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '16px', border: '1px solid hsl(var(--border))', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.1)' }}
                                    formatter={(value: any) => [value.toLocaleString() + ' ج.م', 'القيمة']}
                                />
                                <Bar dataKey="totalValue" radius={[0, 8, 8, 0]}>
                                    {branchBreakdown.slice(0, 10).map((entry: any, index: number) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* Metadata */}
            {metadata && (
                <div className="text-xs text-muted-foreground text-center">
                    تم إنشاء التقرير في {new Date(metadata.generatedAt).toLocaleString('ar-EG')} • وقت التنفيذ: {metadata.executionTimeMs}ms
                </div>
            )}
        </div>
    );
}
