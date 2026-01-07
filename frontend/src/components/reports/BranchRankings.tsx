import React from 'react';
import { Building2 } from 'lucide-react';

interface BranchRankingsProps {
    data: any;
}

export function BranchRankings({ data }: BranchRankingsProps) {
    if (!data || !data.branchPerformance) return null;
    const { branchPerformance } = data;

    return (
        <div className="bg-card rounded-[2.5rem] border border-border p-8 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-2xl font-black mb-10 text-foreground flex items-center gap-4">
                <Building2 className="text-primary" />
                تحليل مقارن لأداء الفروع
            </h3>

            <div className="overflow-x-auto overflow-y-hidden">
                <table className="w-full whitespace-nowrap">
                    <thead>
                        <tr className="text-muted-foreground text-xs uppercase tracking-widest border-b border-border">
                            <th className="p-6 text-right font-black">الفرع</th>
                            <th className="p-6 text-center font-black">المبيعات الكلية</th>
                            <th className="p-6 text-center font-black">نسبة التحصيل</th>
                            <th className="p-6 text-center font-black">الماكينات المباعة</th>
                            <th className="p-6 text-center font-black">الصيانات المنجزة</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                        {branchPerformance.map((branch: any, idx: number) => (
                            <tr key={branch.id} className="group hover:bg-muted/30 transition-colors">
                                <td className="p-6">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center font-black text-primary">
                                            {idx + 1}
                                        </div>
                                        <div>
                                            <p className="font-black text-lg group-hover:text-primary transition-colors">{branch.name}</p>
                                            <p className="text-xs text-muted-foreground font-bold">فرع نشط</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="p-6 text-center font-black text-lg">
                                    {branch.revenue.toLocaleString()} ج.م
                                </td>
                                <td className="p-6 text-center">
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="w-full max-w-[120px] h-2 bg-muted rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-emerald-500 transition-all duration-1000"
                                                style={{ width: `${(branch.collections / branch.revenue) * 100}%` }}
                                            />
                                        </div>
                                        <span className="text-xs font-black text-emerald-600">
                                            {Math.round((branch.collections / branch.revenue) * 100)}%
                                        </span>
                                    </div>
                                </td>
                                <td className="p-6 text-center">
                                    <span className="px-4 py-2 bg-blue-500/10 text-blue-600 rounded-xl font-black text-sm border border-blue-500/20">
                                        {branch.salesCount} ماكينة
                                    </span>
                                </td>
                                <td className="p-6 text-center">
                                    <span className="px-4 py-2 bg-purple-500/10 text-purple-600 rounded-xl font-black text-sm border border-purple-500/20">
                                        {branch.repairCount} طلب
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
