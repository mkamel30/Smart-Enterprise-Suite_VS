import React, { useState } from 'react';
import { Users, Package, TrendingUp, ChevronDown, ChevronUp, DollarSign } from 'lucide-react';
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

interface TechnicianConsumptionReportProps {
    data: any;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export function TechnicianConsumptionReport({ data }: TechnicianConsumptionReportProps) {
    const [expandedTech, setExpandedTech] = useState<string | null>(null);

    if (!data || !data.rows) return (
        <div className="flex flex-col items-center justify-center p-12 bg-muted/20 rounded-[2.5rem] border-2 border-dashed border-muted">
            <Package size={48} className="text-muted-foreground mb-4 opacity-50" />
            <p className="text-muted-foreground font-bold">لا توجد بيانات متاحة لهام الفترة</p>
        </div>
    );

    const { rows, summary, metadata } = data;

    // Prepare chart data (top 10 technicians by value)
    const chartData = rows.slice(0, 10).map((row: any, index: number) => ({
        name: row.technicianName,
        value: row.totalValue,
        color: COLORS[index % COLORS.length]
    }));

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="عدد الفنيين"
                    value={summary.totalTechnicians}
                    icon={<Users />}
                    color="blue"
                />
                <StatCard
                    title="إجمالي القطع"
                    value={summary.totalPartsConsumed}
                    icon={<Package />}
                    color="emerald"
                />
                <StatCard
                    title="قيمة الاستهلاك"
                    value={summary.totalConsumptionValue.toLocaleString()}
                    icon={<DollarSign />}
                    color="purple"
                    suffix=" ج.م"
                />
                <StatCard
                    title="متوسط الفني"
                    value={summary.avgConsumptionPerTech.toLocaleString()}
                    icon={<TrendingUp />}
                    color="orange"
                    suffix=" ج.م"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Consumption Value Bar Chart */}
                <div className="bg-card rounded-[2.5rem] border border-border p-8 shadow-xl">
                    <h3 className="text-xl font-black mb-8 flex items-center gap-3 text-foreground">
                        <TrendingUp className="text-blue-500" />
                        أعلى الفنيين استهلاكاً (القيمة)
                    </h3>
                    <div className="h-[400px] w-full" dir="ltr">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} layout="vertical" margin={{ left: 80 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="hsl(var(--border))" />
                                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12, fontWeight: 700 }} />
                                <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 600 }} width={80} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '16px', border: '1px solid hsl(var(--border))', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.1)' }}
                                    formatter={(value: any) => [value.toLocaleString() + ' ج.م', 'القيمة']}
                                />
                                <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                                    {chartData.map((entry: any, index: number) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Technician Details List */}
                <div className="bg-card rounded-[2.5rem] border border-border p-8 shadow-xl overflow-hidden">
                    <h3 className="text-xl font-black mb-6 flex items-center gap-3 text-foreground">
                        <Users className="text-emerald-500" />
                        تفاصيل استهلاك الفنيين
                    </h3>
                    <div className="space-y-4 max-h-[400px] overflow-y-auto scrollbar-thin pr-2">
                        {rows.map((row: any) => (
                            <div key={row.technicianName} className="border border-border rounded-2xl overflow-hidden">
                                <button
                                    onClick={() => setExpandedTech(expandedTech === row.technicianName ? null : row.technicianName)}
                                    className="w-full flex items-center justify-between p-4 bg-muted/30 hover:bg-muted/50 transition-colors"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black">
                                            {row.technicianName.charAt(0)}
                                        </div>
                                        <div className="text-right">
                                            <p className="font-black text-sm">{row.technicianName}</p>
                                            <p className="text-[10px] text-muted-foreground">{row.branchName}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        <div className="text-center">
                                            <p className="text-[10px] text-muted-foreground font-bold">القطع</p>
                                            <p className="font-black text-xs text-blue-600">{row.totalQuantity}</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-[10px] text-muted-foreground font-bold">القيمة</p>
                                            <p className="font-black text-xs text-emerald-600">{row.totalValue.toLocaleString()} ج.م</p>
                                        </div>
                                        {expandedTech === row.technicianName ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                    </div>
                                </button>

                                {expandedTech === row.technicianName && (
                                    <div className="p-4 bg-background animate-in slide-in-from-top-2 duration-300">
                                        <table className="w-full text-[11px]">
                                            <thead>
                                                <tr className="border-b border-border text-muted-foreground">
                                                    <th className="text-right py-2 font-black">القطعة</th>
                                                    <th className="text-center py-2 font-black">الحالة</th>
                                                    <th className="text-center py-2 font-black">الكمية</th>
                                                    <th className="text-center py-2 font-black">القيمة</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {row.parts.map((part: any, i: number) => (
                                                    <tr key={i} className="border-b border-border/50">
                                                        <td className="py-2 font-bold">{part.partName}</td>
                                                        <td className="py-2 text-center">
                                                            {part.isPaid ? (
                                                                <span className="bg-amber-100/50 text-amber-700 px-2 py-0.5 rounded-md text-[9px] font-black border border-amber-200/50">بمقابل</span>
                                                            ) : (
                                                                <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md text-[9px] font-black border border-slate-200">مجاني</span>
                                                            )}
                                                        </td>
                                                        <td className="py-2 text-center font-black">{part.quantity}</td>
                                                        <td className="py-2 text-center text-emerald-600 font-bold">{part.value.toLocaleString()} ج.م</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        <div className="mt-4 pt-4 border-t border-border flex justify-between items-center">
                                            <span className="text-[10px] text-muted-foreground font-bold">عدد الطلبات التي شارك فيها:</span>
                                            <span className="bg-primary/10 text-primary px-3 py-1 rounded-full font-black text-xs">{row.requestCount}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Metadata */}
            {metadata && (
                <div className="text-[10px] text-muted-foreground text-center bg-muted/30 py-3 rounded-2xl border border-border">
                    <span className="font-bold">تم إنشاء التقرير في:</span> {new Date(metadata.generatedAt).toLocaleString('ar-EG')} •
                    <span className="font-bold ml-4">وقت التنفيذ:</span> {metadata.executionTimeMs}ms
                </div>
            )}
        </div>
    );
}
