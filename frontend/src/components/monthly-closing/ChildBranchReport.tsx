import { Building2 } from 'lucide-react';

interface ChildBranchProps {
    childBranches: Array<{
        branchId: string;
        branchName: string;
        branchCode: string;
        sales: { count: number; totalPrice: number; paidAmount: number };
        installmentsCollected: { count: number; amount: number };
        partsOut: number;
    }>;
    month: string;
}

const fmt = (val: number) => val?.toLocaleString('ar-EG') || '0';

export function ChildBranchReport({ childBranches, month }: ChildBranchProps) {
    if (!childBranches || childBranches.length === 0) return null;

    const totals = childBranches.reduce((acc, b) => ({
        salesCount: acc.salesCount + b.sales.count,
        salesTotal: acc.salesTotal + b.sales.totalPrice,
        salesPaid: acc.salesPaid + b.sales.paidAmount,
        installmentsCount: acc.installmentsCount + b.installmentsCollected.count,
        installmentsAmount: acc.installmentsAmount + b.installmentsCollected.amount,
        partsOut: acc.partsOut + b.partsOut
    }), { salesCount: 0, salesTotal: 0, salesPaid: 0, installmentsCount: 0, installmentsAmount: 0, partsOut: 0 });

    return (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6 animate-fade-in">
            <div className="flex items-center gap-3">
                <div className="p-3 bg-violet-50 rounded-2xl text-violet-600">
                    <Building2 size={24} />
                </div>
                <h2 className="text-xl font-black text-slate-800">الفروع التابعة</h2>
                <span className="bg-violet-100 text-violet-700 px-3 py-1 rounded-full text-xs font-black">
                    {childBranches.length} فرع
                </span>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-violet-50 text-violet-600">
                            <th className="text-right py-3 px-4 rounded-tr-xl">الفرع</th>
                            <th className="text-right py-3 px-4">المبيعات</th>
                            <th className="text-right py-3 px-4">إجمالي المبيعات</th>
                            <th className="text-right py-3 px-4">المحصّل</th>
                            <th className="text-right py-3 px-4">أقساط محصّلة</th>
                            <th className="text-right py-3 px-4 rounded-tl-xl">قطع غيار</th>
                        </tr>
                    </thead>
                    <tbody>
                        {childBranches.map((b) => (
                            <tr key={b.branchId} className="border-b border-slate-100 hover:bg-violet-50/30 transition-colors">
                                <td className="py-3 px-4 font-bold">
                                    <div className="flex items-center gap-2">
                                        <Building2 size={14} className="text-violet-500" />
                                        {b.branchName}
                                    </div>
                                </td>
                                <td className="py-3 px-4 font-bold">{b.sales.count}</td>
                                <td className="py-3 px-4 font-bold text-primary">{fmt(b.sales.totalPrice)} ج.م</td>
                                <td className="py-3 px-4 font-bold text-emerald-600">{fmt(b.sales.paidAmount)} ج.م</td>
                                <td className="py-3 px-4">
                                    <span className="font-bold">{fmt(b.installmentsCollected.amount)} ج.م</span>
                                    <span className="text-slate-400 text-xs mr-1">({b.installmentsCollected.count})</span>
                                </td>
                                <td className="py-3 px-4 font-bold text-amber-600">{b.partsOut}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="bg-violet-50 font-black text-violet-800">
                            <td className="py-3 px-4 rounded-br-xl">الإجمالي</td>
                            <td className="py-3 px-4">{totals.salesCount}</td>
                            <td className="py-3 px-4">{fmt(totals.salesTotal)} ج.م</td>
                            <td className="py-3 px-4">{fmt(totals.salesPaid)} ج.م</td>
                            <td className="py-3 px-4">{fmt(totals.installmentsAmount)} ج.م</td>
                            <td className="py-3 px-4 rounded-bl-xl">{totals.partsOut}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
}
