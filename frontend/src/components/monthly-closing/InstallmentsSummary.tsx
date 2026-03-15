import { CalendarCheck, AlertTriangle, Clock, CalendarDays } from 'lucide-react';

interface InstallmentsProps {
    installments: {
        collected: { count: number; totalAmount: number; details: any[] };
        overdue: { count: number; totalAmount: number; details: any[] };
        upcoming: { count: number; totalAmount: number; details: any[] };
    } | undefined;
}

const fmt = (val: number) => val?.toLocaleString('ar-EG') || '0';

export function InstallmentsSummary({ installments }: InstallmentsProps) {
    if (!installments) return null;

    return (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6 animate-fade-in">
            <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-50 rounded-2xl text-blue-600">
                    <CalendarDays size={24} />
                </div>
                <h2 className="text-xl font-black text-slate-800">الأقساط</h2>
            </div>

            {/* Installment Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-2">
                        <CalendarCheck size={18} className="text-emerald-600" />
                        <span className="font-bold text-emerald-700">محصّل هذا الشهر</span>
                    </div>
                    <p className="text-3xl font-black text-emerald-700">{fmt(installments.collected.totalAmount)} <span className="text-sm">ج.م</span></p>
                    <p className="text-sm text-emerald-600 mt-1">{installments.collected.count} قسط</p>
                </div>

                <div className={`border rounded-2xl p-5 ${installments.overdue.count > 0 ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-100'}`}>
                    <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle size={18} className={installments.overdue.count > 0 ? 'text-red-600' : 'text-slate-400'} />
                        <span className={`font-bold ${installments.overdue.count > 0 ? 'text-red-700' : 'text-slate-500'}`}>أقساط متأخرة</span>
                    </div>
                    <p className={`text-3xl font-black ${installments.overdue.count > 0 ? 'text-red-700' : 'text-slate-400'}`}>
                        {fmt(installments.overdue.totalAmount)} <span className="text-sm">ج.م</span>
                    </p>
                    <p className={`text-sm mt-1 ${installments.overdue.count > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                        {installments.overdue.count} قسط
                    </p>
                </div>

                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-2">
                        <Clock size={18} className="text-amber-600" />
                        <span className="font-bold text-amber-700">أقساط قادمة</span>
                    </div>
                    <p className="text-3xl font-black text-amber-700">{fmt(installments.upcoming.totalAmount)} <span className="text-sm">ج.م</span></p>
                    <p className="text-sm text-amber-600 mt-1">{installments.upcoming.count} قسط</p>
                </div>
            </div>

            {/* Overdue Details */}
            {installments.overdue.details.length > 0 && (
                <div>
                    <h3 className="font-bold text-red-700 mb-3 flex items-center gap-2">
                        <AlertTriangle size={16} /> تفاصيل الأقساط المتأخرة
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-red-50 text-red-600">
                                    <th className="text-right py-3 px-4 rounded-tr-xl">العميل</th>
                                    <th className="text-right py-3 px-4">كود العميل</th>
                                    <th className="text-right py-3 px-4">المبلغ</th>
                                    <th className="text-right py-3 px-4">تاريخ الاستحقاق</th>
                                    <th className="text-right py-3 px-4 rounded-tl-xl">أيام التأخير</th>
                                </tr>
                            </thead>
                            <tbody>
                                {installments.overdue.details.map((i: any) => (
                                    <tr key={i.id} className="border-b border-red-50 hover:bg-red-50/50 transition-colors">
                                        <td className="py-3 px-4 font-bold">{i.customerName}</td>
                                        <td className="py-3 px-4 font-mono text-slate-500">{i.customerCode}</td>
                                        <td className="py-3 px-4 font-bold text-red-600">{fmt(i.amount)} ج.م</td>
                                        <td className="py-3 px-4 text-slate-500">{new Date(i.dueDate).toLocaleDateString('ar-EG')}</td>
                                        <td className="py-3 px-4">
                                            <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-black">
                                                {i.daysOverdue} يوم
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Collected Details */}
            {installments.collected.details.length > 0 && (
                <div>
                    <h3 className="font-bold text-emerald-700 mb-3 flex items-center gap-2">
                        <CalendarCheck size={16} /> تفاصيل الأقساط المحصّلة
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-emerald-50 text-emerald-600">
                                    <th className="text-right py-3 px-4 rounded-tr-xl">العميل</th>
                                    <th className="text-right py-3 px-4">المبلغ</th>
                                    <th className="text-right py-3 px-4">تاريخ الدفع</th>
                                    <th className="text-right py-3 px-4 rounded-tl-xl">رقم الإيصال</th>
                                </tr>
                            </thead>
                            <tbody>
                                {installments.collected.details.map((i: any) => (
                                    <tr key={i.id} className="border-b border-emerald-50 hover:bg-emerald-50/50 transition-colors">
                                        <td className="py-3 px-4 font-bold">{i.customerName}</td>
                                        <td className="py-3 px-4 font-bold text-emerald-600">{fmt(i.amount)} ج.م</td>
                                        <td className="py-3 px-4 text-slate-500">{i.paidAt ? new Date(i.paidAt).toLocaleDateString('ar-EG') : '-'}</td>
                                        <td className="py-3 px-4 text-slate-500">{i.receiptNumber || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
