import { Wrench, DollarSign, Shield, Trophy } from 'lucide-react';

interface PartItem {
    partName: string;
    quantity: number;
    unitCost: number;
    totalValue: number;
    customerName: string;
    customerBkcode: string;
    technician: string;
    closedAt: string;
    receiptNumber: string;
    requestId: string;
}

interface SparePartsProps {
    spareParts: {
        paid: { count: number; totalValue: number; details: PartItem[] };
        free: { count: number; totalValue: number; details: PartItem[] };
        topParts: Array<{
            name: string;
            totalQuantity: number;
            totalCost: number;
            paidCount: number;
            freeCount: number;
        }>;
    } | undefined;
}

const fmt = (val: number) => val?.toLocaleString('ar-EG') || '0';

function PartTable({ items, colorScheme }: { items: PartItem[]; colorScheme: 'emerald' | 'blue' }) {
    const colors = {
        emerald: { header: 'bg-emerald-50 text-emerald-600', cost: 'text-emerald-600' },
        blue: { header: 'bg-blue-50 text-blue-600', cost: 'text-blue-600' }
    };
    const c = colors[colorScheme];

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className={c.header}>
                        <th className="text-right py-3 px-4 rounded-tr-xl">القطعة</th>
                        <th className="text-right py-3 px-4">الكمية</th>
                        <th className="text-right py-3 px-4">سعر الوحدة</th>
                        <th className="text-right py-3 px-4">الإجمالي</th>
                        <th className="text-right py-3 px-4">العميل</th>
                        <th className="text-right py-3 px-4">الفني</th>
                        <th className="text-right py-3 px-4">التاريخ</th>
                        <th className="text-right py-3 px-4 rounded-tl-xl">الإيصال</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item, idx) => (
                        <tr key={`${item.requestId}-${item.partName}-${idx}`} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                            <td className="py-3 px-4 font-bold">{item.partName}</td>
                            <td className="py-3 px-4 font-bold">{item.quantity}</td>
                            <td className="py-3 px-4 font-mono text-slate-600">{fmt(item.unitCost)} ج.م</td>
                            <td className={`py-3 px-4 font-bold ${c.cost}`}>{fmt(item.totalValue)} ج.م</td>
                            <td className="py-3 px-4">
                                <span className="font-bold">{item.customerName}</span>
                                {item.customerBkcode && (
                                    <span className="text-slate-400 text-xs block font-mono">{item.customerBkcode}</span>
                                )}
                            </td>
                            <td className="py-3 px-4">{item.technician}</td>
                            <td className="py-3 px-4 text-slate-500 whitespace-nowrap">{new Date(item.closedAt).toLocaleDateString('ar-EG')}</td>
                            <td className="py-3 px-4 text-slate-500">{item.receiptNumber || '-'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export function SparePartsSummary({ spareParts }: SparePartsProps) {
    if (!spareParts) return null;

    const topParts = spareParts.topParts || [];
    const maxQty = topParts.length > 0 ? topParts[0].totalQuantity : 1;
    const totalParts = spareParts.paid.count + spareParts.free.count;

    return (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6 animate-fade-in">
            <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-50 rounded-2xl text-amber-600">
                    <Wrench size={24} />
                </div>
                <h2 className="text-xl font-black text-slate-800">قطع الغيار</h2>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-2">
                        <DollarSign size={18} className="text-emerald-600" />
                        <span className="font-bold text-emerald-700">بمقابل مادي</span>
                    </div>
                    <p className="text-2xl font-black text-emerald-700">{spareParts.paid.count} قطعة</p>
                    <p className="text-sm font-bold text-emerald-600 mt-1">{fmt(spareParts.paid.totalValue)} ج.م</p>
                </div>

                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-2">
                        <Shield size={18} className="text-blue-600" />
                        <span className="font-bold text-blue-700">بدون مقابل (ضمان)</span>
                    </div>
                    <p className="text-2xl font-black text-blue-700">{spareParts.free.count} قطعة</p>
                    <p className="text-sm font-bold text-blue-600 mt-1">قيمتها: {fmt(spareParts.free.totalValue)} ج.م</p>
                </div>

                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-2">
                        <Wrench size={18} className="text-amber-600" />
                        <span className="font-bold text-amber-700">إجمالي الاستهلاك</span>
                    </div>
                    <p className="text-2xl font-black text-amber-700">{totalParts} قطعة</p>
                    <p className="text-sm font-bold text-amber-600 mt-1">
                        {fmt(spareParts.paid.totalValue + spareParts.free.totalValue)} ج.م
                    </p>
                </div>
            </div>

            {/* Top Consumed Parts */}
            {topParts.length > 0 && (
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-5 space-y-4">
                    <h3 className="font-black text-amber-800 flex items-center gap-2">
                        <Trophy size={18} className="text-amber-600" />
                        أكثر القطع استهلاكاً
                    </h3>
                    <div className="space-y-3">
                        {topParts.map((part, idx) => (
                            <div key={part.name} className="flex items-center gap-3">
                                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${idx === 0 ? 'bg-amber-500 text-white' :
                                        idx === 1 ? 'bg-slate-400 text-white' :
                                            idx === 2 ? 'bg-amber-700 text-white' :
                                                'bg-slate-200 text-slate-600'
                                    }`}>
                                    {idx + 1}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="font-bold text-slate-700 text-sm truncate">{part.name}</span>
                                        <div className="flex items-center gap-2 shrink-0 mr-2">
                                            <span className="text-xs font-black text-amber-700">{part.totalQuantity} قطعة</span>
                                            {part.paidCount > 0 && (
                                                <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-bold">{part.paidCount} مدفوع</span>
                                            )}
                                            {part.freeCount > 0 && (
                                                <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-bold">{part.freeCount} ضمان</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="w-full h-2 bg-amber-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-l from-amber-500 to-orange-400 rounded-full transition-all"
                                            style={{ width: `${(part.totalQuantity / maxQty) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Paid Parts Detail Table */}
            {spareParts.paid.details.length > 0 && (
                <div>
                    <h3 className="font-bold text-emerald-700 mb-3 flex items-center gap-2">
                        <DollarSign size={16} /> تفاصيل القطع بمقابل مادي
                        <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-black">{spareParts.paid.count}</span>
                    </h3>
                    <PartTable items={spareParts.paid.details} colorScheme="emerald" />
                </div>
            )}

            {/* Free Parts Detail Table */}
            {spareParts.free.details.length > 0 && (
                <div>
                    <h3 className="font-bold text-blue-700 mb-3 flex items-center gap-2">
                        <Shield size={16} /> تفاصيل القطع بدون مقابل (ضمان)
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-black">{spareParts.free.count}</span>
                    </h3>
                    <PartTable items={spareParts.free.details} colorScheme="blue" />
                </div>
            )}

            {totalParts === 0 && (
                <div className="text-center py-8 text-slate-400">
                    <Wrench size={40} className="mx-auto mb-3 opacity-50" />
                    <p className="font-bold">لا توجد عمليات استهلاك قطع غيار في هذا الشهر</p>
                </div>
            )}
        </div>
    );
}
