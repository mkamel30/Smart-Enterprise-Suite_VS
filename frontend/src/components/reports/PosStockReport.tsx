import React from 'react';
import { Package, Monitor, AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react';
import {
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

interface PosStockReportProps {
    data: any;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

const STATUS_CONFIG = {
    NORMAL: { label: 'طبيعي', color: 'bg-emerald-500', textColor: 'text-emerald-600', icon: CheckCircle },
    LOW: { label: 'منخفض', color: 'bg-yellow-500', textColor: 'text-yellow-600', icon: AlertCircle },
    CRITICAL: { label: 'حرج', color: 'bg-red-500', textColor: 'text-red-600', icon: AlertTriangle }
};

export function PosStockReport({ data }: PosStockReportProps) {
    if (!data || !data.rows) return null;
    const { rows, modelSummary, summary, metadata } = data;

    // Prepare model chart data
    const modelChartData = modelSummary?.map((model: any, index: number) => ({
        name: model.modelName,
        stock: model.totalStock,
        color: COLORS[index % COLORS.length]
    })) || [];

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="إجمالي المخزون"
                    value={summary.grandTotal}
                    icon={<Package />}
                    color="blue"
                    suffix="جهاز"
                />
                <StatCard
                    title="قيمة المخزون"
                    value={summary.grandTotalValue}
                    icon={<Monitor />}
                    color="emerald"
                    suffix="ج.م"
                />
                <StatCard
                    title="تنبيهات مخزون منخفض"
                    value={summary.totalLowStockAlerts}
                    icon={<AlertCircle />}
                    color="orange"
                />
                <StatCard
                    title="تنبيهات حرجة"
                    value={summary.totalCriticalStockAlerts}
                    icon={<AlertTriangle />}
                    color="purple"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Model Distribution Chart */}
                <div className="bg-card rounded-[2.5rem] border border-border p-8 shadow-xl">
                    <h3 className="text-xl font-black mb-8 flex items-center gap-3">
                        <Monitor className="text-blue-500" />
                        توزيع الموديلات
                    </h3>
                    <div className="h-[300px] w-full" dir="ltr">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={modelChartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 600 }}
                                    angle={-45}
                                    textAnchor="end"
                                    height={80}
                                />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12, fontWeight: 700 }} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '16px', border: '1px solid hsl(var(--border))', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.1)' }}
                                    formatter={(value: any) => [value.toLocaleString(), 'المخزون']}
                                />
                                <Bar dataKey="stock" radius={[8, 8, 0, 0]}>
                                    {modelChartData.map((entry: any, index: number) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Model Summary Cards */}
                <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-16 -mt-16" />
                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-8">ملخص الموديلات</h3>

                    <div className="space-y-4 max-h-[280px] overflow-y-auto scrollbar-thin pr-2">
                        {modelSummary?.map((model: any, index: number) => (
                            <div key={model.modelId} className="p-4 bg-slate-800/50 rounded-2xl flex items-center justify-between">
                                <div>
                                    <div className="font-bold text-white">{model.modelName}</div>
                                    <div className="text-xs text-slate-400 mt-1">
                                        {model.branchCount} فرع • متوسط {model.avgStockPerBranch} لكل فرع
                                    </div>
                                </div>
                                <div className="text-left">
                                    <div className="text-2xl font-black" style={{ color: COLORS[index % COLORS.length] }}>
                                        {model.totalStock}
                                    </div>
                                    <div className="text-xs text-slate-500">
                                        {model.totalValue?.toLocaleString()} ج.م
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Branch Stock Table */}
            <div className="bg-card rounded-[2.5rem] border border-border p-8 shadow-xl overflow-hidden">
                <h3 className="text-xl font-black mb-6 flex items-center gap-3">
                    <Package className="text-purple-500" />
                    مخزون الفروع
                </h3>
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto scrollbar-thin">
                    <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-muted/80 backdrop-blur z-10">
                            <tr>
                                <th className="text-right py-3 px-4 font-black">الفرع</th>
                                <th className="text-center py-3 px-4 font-black">الإجمالي</th>
                                {modelSummary?.slice(0, 5).map((model: any) => (
                                    <th key={model.modelId} className="text-center py-3 px-4 font-black">{model.modelName}</th>
                                ))}
                                <th className="text-center py-3 px-4 font-black">تنبيهات</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((branch: any) => (
                                <tr key={branch.branchId} className="border-b border-border hover:bg-muted/50 transition-colors">
                                    <td className="py-3 px-4 font-bold">{branch.branchName}</td>
                                    <td className="py-3 px-4 text-center">
                                        <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 font-black">
                                            {branch.branchTotal}
                                        </span>
                                    </td>
                                    {modelSummary?.slice(0, 5).map((model: any) => (
                                        <td key={model.modelId} className="py-3 px-4 text-center font-bold text-muted-foreground">
                                            {branch.models[model.modelName] || 0}
                                        </td>
                                    ))}
                                    <td className="py-3 px-4 text-center">
                                        {(branch.lowStockAlerts > 0 || branch.criticalStockAlerts > 0) ? (
                                            <div className="flex items-center justify-center gap-2">
                                                {branch.criticalStockAlerts > 0 && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/10 text-red-600 text-xs font-bold">
                                                        <AlertTriangle size={12} />
                                                        {branch.criticalStockAlerts}
                                                    </span>
                                                )}
                                                {branch.lowStockAlerts > 0 && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-500/10 text-yellow-600 text-xs font-bold">
                                                        <AlertCircle size={12} />
                                                        {branch.lowStockAlerts}
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-xs font-bold">
                                                <CheckCircle size={12} />
                                                جيد
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="sticky bottom-0 bg-primary/5 font-black">
                            <tr>
                                <td className="py-3 px-4">الإجمالي</td>
                                <td className="py-3 px-4 text-center">{summary.grandTotal}</td>
                                {modelSummary?.slice(0, 5).map((model: any) => (
                                    <td key={model.modelId} className="py-3 px-4 text-center">{model.totalStock}</td>
                                ))}
                                <td className="py-3 px-4 text-center">
                                    {summary.totalCriticalStockAlerts + summary.totalLowStockAlerts} تنبيه
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            {/* Metadata */}
            {metadata && (
                <div className="text-xs text-muted-foreground text-center">
                    آخر تحديث: {new Date(summary.lastUpdated).toLocaleString('ar-EG')} • وقت التنفيذ: {metadata.executionTimeMs}ms
                </div>
            )}
        </div>
    );
}
