import React, { useMemo } from 'react';
import { ShoppingCart, DollarSign, Clock, TrendingUp, Calendar, ArrowUpRight, ArrowDownRight } from 'lucide-react';
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

interface PosSalesReportProps {
    data: any;
    granularity: 'monthly' | 'daily';
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export function PosSalesReport({ data, granularity }: PosSalesReportProps) {
    if (!data || !data.timeline) return null;
    const { timeline, branchBreakdown, summary, modelDistribution, metadata } = data;

    // Prepare chart data
    const chartData = useMemo(() => {
        return timeline.map((item: any) => ({
            name: granularity === 'monthly' ? item.monthLabel || item.month : item.date,
            total: item.machineCount,
            cash: item.sales.cash,
            review: item.sales.review,
            financed: item.sales.financed,
            revenue: item.revenue?.estimatedTotal || 0
        }));
    }, [timeline, granularity]);

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="إجمالي المبيعات"
                    value={summary.grandTotal}
                    icon={<ShoppingCart />}
                    color="blue"
                    suffix="جهاز"
                />
                <StatCard
                    title="مبيعات نقدية"
                    value={summary.periodSales?.cash || 0}
                    icon={<DollarSign />}
                    color="emerald"
                />
                <StatCard
                    title="قيد المراجعة"
                    value={summary.periodSales?.review || 0}
                    icon={<Clock />}
                    color="orange"
                />
                <StatCard
                    title="تقسيط"
                    value={summary.periodSales?.financed || 0}
                    icon={<TrendingUp />}
                    color="purple"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Sales Trend Chart */}
                <div className="lg:col-span-2 bg-card rounded-[2.5rem] border border-border p-8 shadow-xl">
                    <h3 className="text-xl font-black mb-8 flex items-center gap-3">
                        <Calendar className="text-blue-500" />
                        منحنى المبيعات {granularity === 'monthly' ? 'الشهرية' : 'اليومية'}
                    </h3>
                    <div className="h-[350px] w-full" dir="ltr">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorCash" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorReview" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 600 }}
                                    angle={granularity === 'daily' ? -45 : 0}
                                    textAnchor={granularity === 'daily' ? 'end' : 'middle'}
                                    height={granularity === 'daily' ? 60 : 30}
                                />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12, fontWeight: 700 }} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '16px', border: '1px solid hsl(var(--border))', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.1)' }}
                                    formatter={(value: any) => [value.toLocaleString(), '']}
                                />
                                <Area type="monotone" dataKey="cash" name="نقدي" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorCash)" />
                                <Area type="monotone" dataKey="review" name="مراجعة" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorReview)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Status Breakdown */}
                <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-16 -mt-16" />
                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-8">توزيع الحالات</h3>

                    <div className="space-y-6">
                        {[
                            { label: 'نقدي', value: summary.periodSales?.cash || 0, percentage: summary.periodBreakdown?.cash || 0, color: 'bg-emerald-500' },
                            { label: 'مراجعة', value: summary.periodSales?.review || 0, percentage: summary.periodBreakdown?.review || 0, color: 'bg-yellow-500' },
                            { label: 'تقسيط', value: summary.periodSales?.financed || 0, percentage: summary.periodBreakdown?.financed || 0, color: 'bg-purple-500' },
                        ].map((item) => (
                            <div key={item.label} className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-400 font-medium">{item.label}</span>
                                    <span className="text-white font-black">{item.value.toLocaleString()}</span>
                                </div>
                                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full ${item.color} rounded-full transition-all duration-500`}
                                        style={{ width: `${(item.percentage * 100)}%` }}
                                    />
                                </div>
                                <div className="text-xs text-slate-500 text-left">{(item.percentage * 100).toFixed(1)}%</div>
                            </div>
                        ))}
                    </div>

                    {summary.avgMonthly && (
                        <div className="mt-8 pt-6 border-t border-slate-700">
                            <div className="text-xs text-slate-500 mb-2">المتوسط الشهري</div>
                            <div className="text-3xl font-black">{summary.avgMonthly}</div>
                        </div>
                    )}
                </div>
            </div>

            {/* Branch Performance Table */}
            {branchBreakdown && branchBreakdown.length > 0 && (
                <div className="bg-card rounded-[2.5rem] border border-border p-8 shadow-xl overflow-hidden">
                    <h3 className="text-xl font-black mb-6 flex items-center gap-3">
                        <TrendingUp className="text-emerald-500" />
                        أداء الفروع
                    </h3>
                    <div className="overflow-x-auto max-h-[400px] overflow-y-auto scrollbar-thin">
                        <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                                <tr>
                                    <th className="text-right py-3 px-4 font-black">الفرع</th>
                                    <th className="text-center py-3 px-4 font-black">الإجمالي</th>
                                    <th className="text-center py-3 px-4 font-black">نقدي</th>
                                    <th className="text-center py-3 px-4 font-black">مراجعة</th>
                                    <th className="text-center py-3 px-4 font-black">تقسيط</th>
                                    <th className="text-center py-3 px-4 font-black">الإيراد المقدر</th>
                                </tr>
                            </thead>
                            <tbody>
                                {branchBreakdown.map((branch: any) => (
                                    <tr key={branch.branchId} className="border-b border-border hover:bg-muted/50 transition-colors">
                                        <td className="py-3 px-4 font-bold">{branch.branchName}</td>
                                        <td className="py-3 px-4 text-center">
                                            <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 font-black">
                                                {branch.periodTotal?.toLocaleString() || branch.total?.toLocaleString() || 0}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-center font-bold text-emerald-600">
                                            {branch.sales?.cash?.toLocaleString() || 0}
                                        </td>
                                        <td className="py-3 px-4 text-center font-bold text-yellow-600">
                                            {branch.sales?.review?.toLocaleString() || 0}
                                        </td>
                                        <td className="py-3 px-4 text-center font-bold text-purple-600">
                                            {branch.sales?.financed?.toLocaleString() || 0}
                                        </td>
                                        <td className="py-3 px-4 text-center font-bold text-muted-foreground">
                                            {branch.estimatedRevenue?.toLocaleString() || branch.totalRevenue?.toLocaleString() || 0} ج.م
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Model Distribution (Daily only) */}
            {modelDistribution && modelDistribution.length > 0 && (
                <div className="bg-card rounded-[2.5rem] border border-border p-8 shadow-xl">
                    <h3 className="text-xl font-black mb-6">توزيع الموديلات</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                        {modelDistribution.slice(0, 5).map((model: any, index: number) => (
                            <div key={model.modelId} className="p-4 rounded-2xl bg-muted/50 text-center">
                                <div className="text-2xl font-black" style={{ color: COLORS[index] }}>{model.count}</div>
                                <div className="text-sm font-bold text-muted-foreground mt-1">{model.modelName}</div>
                                <div className="text-xs text-muted-foreground mt-1">{(model.percentage * 100).toFixed(1)}%</div>
                            </div>
                        ))}
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
