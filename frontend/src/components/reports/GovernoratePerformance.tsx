import React from 'react';
import { Building2, Users, Monitor, Wrench, TrendingUp, Percent } from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
    Legend
} from 'recharts';
import { StatCard } from './StatCard';

interface GovernoratePerformanceProps {
    data: any;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export function GovernoratePerformance({ data }: GovernoratePerformanceProps) {
    if (!data || !data.rows) return null;
    const { rows, summary, pagination, metadata } = data;

    // Prepare chart data (top 15 branches)
    const chartData = rows.slice(0, 15).map((row: any, index: number) => ({
        name: row.branchName,
        activities: row.metrics.activities,
        offices: row.metrics.officesServed,
        machines: row.metrics.machineCount,
        color: COLORS[index % COLORS.length]
    }));

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="إجمالي الأنشطة"
                    value={summary.totalActivities}
                    icon={<Wrench />}
                    color="blue"
                />
                <StatCard
                    title="المكاتب المخدومة"
                    value={summary.totalOfficesServed}
                    icon={<Building2 />}
                    color="emerald"
                />
                <StatCard
                    title="إجمالي الماكينات"
                    value={summary.totalMachines}
                    icon={<Monitor />}
                    color="purple"
                />
                <StatCard
                    title="معدل الإغلاق"
                    value={Math.round(summary.avgClosureRate * 100)}
                    icon={<Percent />}
                    color="orange"
                    suffix="%"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Activities Bar Chart */}
                <div className="bg-card rounded-[2.5rem] border border-border p-8 shadow-xl">
                    <h3 className="text-xl font-black mb-8 flex items-center gap-3">
                        <TrendingUp className="text-blue-500" />
                        أداء الفروع حسب الأنشطة
                    </h3>
                    <div className="h-[400px] w-full" dir="ltr">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} layout="vertical" margin={{ left: 80 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="hsl(var(--border))" />
                                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12, fontWeight: 700 }} />
                                <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 600 }} width={80} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '16px', border: '1px solid hsl(var(--border))', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.1)' }}
                                    formatter={(value: any) => [value.toLocaleString(), 'الأنشطة']}
                                />
                                <Bar dataKey="activities" radius={[0, 8, 8, 0]}>
                                    {chartData.map((entry: any, index: number) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Branch Data Table */}
                <div className="bg-card rounded-[2.5rem] border border-border p-8 shadow-xl overflow-hidden">
                    <h3 className="text-xl font-black mb-6 flex items-center gap-3">
                        <Building2 className="text-emerald-500" />
                        تفاصيل الفروع
                    </h3>
                    <div className="overflow-x-auto max-h-[400px] overflow-y-auto scrollbar-thin">
                        <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                                <tr>
                                    <th className="text-right py-3 px-4 font-black">الفرع</th>
                                    <th className="text-center py-3 px-4 font-black">الأنشطة</th>
                                    <th className="text-center py-3 px-4 font-black">المكاتب</th>
                                    <th className="text-center py-3 px-4 font-black">الماكينات</th>
                                    <th className="text-center py-3 px-4 font-black">معدل الإغلاق</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row: any, index: number) => (
                                    <tr key={row.branchId} className="border-b border-border hover:bg-muted/50 transition-colors">
                                        <td className="py-3 px-4 font-bold">{row.branchName}</td>
                                        <td className="py-3 px-4 text-center">
                                            <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 font-black">
                                                {row.metrics.activities.toLocaleString()}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 font-black">
                                                {row.metrics.officesServed.toLocaleString()}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-center font-bold text-muted-foreground">
                                            {row.metrics.machineCount.toLocaleString()}
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full font-black ${row.metrics.closureRate >= 0.8 ? 'bg-emerald-500/10 text-emerald-600' :
                                                    row.metrics.closureRate >= 0.6 ? 'bg-yellow-500/10 text-yellow-600' :
                                                        'bg-red-500/10 text-red-600'
                                                }`}>
                                                {Math.round(row.metrics.closureRate * 100)}%
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="sticky bottom-0 bg-primary/5 font-black">
                                <tr>
                                    <td className="py-3 px-4">الإجمالي</td>
                                    <td className="py-3 px-4 text-center">{summary.totalActivities.toLocaleString()}</td>
                                    <td className="py-3 px-4 text-center">{summary.totalOfficesServed.toLocaleString()}</td>
                                    <td className="py-3 px-4 text-center">{summary.totalMachines.toLocaleString()}</td>
                                    <td className="py-3 px-4 text-center">{Math.round(summary.avgClosureRate * 100)}%</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </div>

            {/* Metadata */}
            {metadata && (
                <div className="text-xs text-muted-foreground text-center">
                    تم إنشاء التقرير في {new Date(metadata.generatedAt).toLocaleString('ar-EG')} • وقت التنفيذ: {metadata.executionTimeMs}ms
                </div>
            )}
        </div>
    );
}
