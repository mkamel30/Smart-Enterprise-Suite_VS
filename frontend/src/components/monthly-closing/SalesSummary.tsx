import { ShoppingCart, CreditCard, DollarSign } from 'lucide-react';

interface SalesProps {
    sales: {
        cash: { count: number; totalPrice: number; paidAmount: number; remaining: number; details: any[] };
        installment: { count: number; totalPrice: number; paidAmount: number; remaining: number; details: any[] };
        totalRevenue: number;
        totalCollected: number;
    } | undefined;
}

const fmt = (val: number) => val?.toLocaleString('ar-EG') || '0';

export function SalesSummary({ sales }: SalesProps) {
    if (!sales) return null;

    return (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6 animate-fade-in">
            <div className="flex items-center gap-3">
                <div className="p-3 bg-primary/10 rounded-2xl text-primary">
                    <ShoppingCart size={24} />
                </div>
                <h2 className="text-xl font-black text-slate-800">المبيعات</h2>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-emerald-50 rounded-2xl p-4 text-center">
                    <p className="text-sm text-emerald-600 font-medium">مبيعات كاش</p>
                    <p className="text-2xl font-black text-emerald-700">{sales.cash.count}</p>
                    <p className="text-sm font-bold text-emerald-600">{fmt(sales.cash.totalPrice)} ج.م</p>
                </div>
                <div className="bg-blue-50 rounded-2xl p-4 text-center">
                    <p className="text-sm text-blue-600 font-medium">مبيعات قسط</p>
                    <p className="text-2xl font-black text-blue-700">{sales.installment.count}</p>
                    <p className="text-sm font-bold text-blue-600">{fmt(sales.installment.totalPrice)} ج.م</p>
                </div>
                <div className="bg-primary/10 rounded-2xl p-4 text-center">
                    <p className="text-sm text-primary font-medium">إجمالي المبيعات</p>
                    <p className="text-2xl font-black text-primary">{fmt(sales.totalRevenue)}</p>
                    <p className="text-sm font-bold text-primary">ج.م</p>
                </div>
                <div className="bg-amber-50 rounded-2xl p-4 text-center">
                    <p className="text-sm text-amber-600 font-medium">المحصّل فعلياً</p>
                    <p className="text-2xl font-black text-amber-700">{fmt(sales.totalCollected)}</p>
                    <p className="text-sm font-bold text-amber-600">ج.م</p>
                </div>
            </div>

            {/* Cash Details */}
            {sales.cash.details.length > 0 && (
                <div>
                    <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                        <DollarSign size={16} className="text-emerald-500" /> تفاصيل الكاش
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50 text-slate-500">
                                    <th className="text-right py-3 px-4 rounded-tr-xl">المسلسل</th>
                                    <th className="text-right py-3 px-4">العميل</th>
                                    <th className="text-right py-3 px-4">التاريخ</th>
                                    <th className="text-right py-3 px-4">الإجمالي</th>
                                    <th className="text-right py-3 px-4 rounded-tl-xl">المدفوع</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sales.cash.details.map((s: any) => (
                                    <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                        <td className="py-3 px-4 font-mono font-bold text-slate-700">{s.serialNumber}</td>
                                        <td className="py-3 px-4 font-bold">{s.customerName}</td>
                                        <td className="py-3 px-4 text-slate-500">{new Date(s.saleDate).toLocaleDateString('ar-EG')}</td>
                                        <td className="py-3 px-4 font-bold text-emerald-600">{fmt(s.totalPrice)}</td>
                                        <td className="py-3 px-4 font-bold">{fmt(s.paidAmount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Installment Details */}
            {sales.installment.details.length > 0 && (
                <div>
                    <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                        <CreditCard size={16} className="text-blue-500" /> تفاصيل مبيعات القسط
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50 text-slate-500">
                                    <th className="text-right py-3 px-4 rounded-tr-xl">المسلسل</th>
                                    <th className="text-right py-3 px-4">العميل</th>
                                    <th className="text-right py-3 px-4">التاريخ</th>
                                    <th className="text-right py-3 px-4">الإجمالي</th>
                                    <th className="text-right py-3 px-4">المدفوع</th>
                                    <th className="text-right py-3 px-4 rounded-tl-xl">المتبقي</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sales.installment.details.map((s: any) => (
                                    <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                        <td className="py-3 px-4 font-mono font-bold text-slate-700">{s.serialNumber}</td>
                                        <td className="py-3 px-4 font-bold">{s.customerName}</td>
                                        <td className="py-3 px-4 text-slate-500">{new Date(s.saleDate).toLocaleDateString('ar-EG')}</td>
                                        <td className="py-3 px-4 font-bold text-blue-600">{fmt(s.totalPrice)}</td>
                                        <td className="py-3 px-4 font-bold">{fmt(s.paidAmount)}</td>
                                        <td className="py-3 px-4 font-bold text-red-500">{fmt(s.totalPrice - s.paidAmount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {sales.cash.details.length === 0 && sales.installment.details.length === 0 && (
                <div className="text-center py-8 text-slate-400">
                    <ShoppingCart size={40} className="mx-auto mb-3 opacity-50" />
                    <p className="font-bold">لا توجد مبيعات في هذا الشهر</p>
                </div>
            )}
        </div>
    );
}
