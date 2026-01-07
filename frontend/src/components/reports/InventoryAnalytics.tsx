import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Package, Database } from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

interface InventoryAnalyticsProps {
    data: any;
    filters: any;
}

export function InventoryAnalytics({ data, filters }: InventoryAnalyticsProps) {
    const { user } = useAuth();
    if (!data || !data.financials) return null;
    const { financials } = data;

    // Fetch the standard inventory report for the table
    const { data: inventory } = useQuery<any[]>({
        queryKey: ['report-inventory-exec', filters.branchId],
        queryFn: () => api.getInventoryReport({ branchId: filters.branchId }) as Promise<any[]>,
        enabled: !!user
    });

    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="lg:col-span-1 space-y-6">
                <div className="bg-purple-600 rounded-[2.5rem] p-8 text-white shadow-xl shadow-purple-600/20 relative overflow-hidden group">
                    <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-3xl group-hover:scale-125 transition-transform" />
                    <Package className="mb-6 opacity-50" size={40} />
                    <p className="text-purple-100 font-bold mb-2">القيمة السوقية للمخزون</p>
                    <h2 className="text-4xl font-black">{financials.inventoryValue.toLocaleString()} <span className="text-sm">ج.م</span></h2>
                    <div className="mt-8 pt-8 border-t border-white/10 text-xs text-purple-200 leading-relaxed font-medium">
                        تم احتساب القيمة بناءً على متوسط سعر التكلفة للقطع المتاحة في جميع الفروع والمخزن الرئيسي.
                    </div>
                </div>

                <div className="bg-card rounded-[2.5rem] border border-border p-8 shadow-lg">
                    <h4 className="font-black mb-6 text-sm uppercase tracking-widest text-muted-foreground">حالة القطع الحرجة</h4>
                    <div className="space-y-4">
                        {inventory?.filter(i => i.quantity < 5).slice(0, 5).map(item => (
                            <div key={item.id} className="flex justify-between items-center p-4 bg-muted/30 rounded-2xl border border-border group hover:bg-red-50 hover:border-red-200 transition-colors">
                                <span className="text-sm font-bold truncate ml-4 group-hover:text-red-700">{item.name}</span>
                                <span className="shrink-0 px-2 py-1 bg-red-100 text-red-600 text-[10px] font-black rounded-lg">{item.quantity} متاح</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="lg:col-span-3 bg-card rounded-[2.5rem] border border-border shadow-xl overflow-hidden">
                <div className="p-8 border-b border-border flex justify-between items-center">
                    <h3 className="text-xl font-black flex items-center gap-3">
                        <Database className="text-primary" />
                        سجل جرد الأصول (قطع غيار)
                    </h3>
                </div>
                <div className="max-h-150 overflow-y-auto overflow-x-auto custom-scroll">
                    <table className="w-full text-sm whitespace-nowrap">
                        <thead className="bg-muted/50 sticky top-0 z-10 backdrop-blur-sm">
                            <tr>
                                <th className="p-4 text-right">كود القطعة</th>
                                <th className="p-4 text-right">اسم القطعة</th>
                                <th className="p-4 text-center">الكمية</th>
                                <th className="p-4 text-center">التكلفة</th>
                                <th className="p-4 text-center">إجمالي القيمة</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {inventory?.map((item: any) => (
                                <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                                    <td className="p-4 font-mono text-slate-500">{item.partNumber}</td>
                                    <td className="p-4 font-bold">{item.name}</td>
                                    <td className="p-4 text-center">
                                        <span className={`font-black ${item.quantity < 5 ? 'text-red-500' : 'text-foreground'}`}>{item.quantity}</span>
                                    </td>
                                    <td className="p-4 text-center text-muted-foreground">{item.defaultCost.toLocaleString()} ج.م</td>
                                    <td className="p-4 text-center font-black text-primary">{(item.quantity * item.defaultCost).toLocaleString()} ج.م</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
