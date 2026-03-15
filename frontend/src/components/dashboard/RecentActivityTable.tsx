import React from 'react';
import { useNavigate } from 'react-router-dom';

interface RecentActivityTableProps {
    activities: any[];
}

const RecentActivityTable: React.FC<RecentActivityTableProps> = ({ activities }) => {
    const navigate = useNavigate();

    return (
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-base text-slate-800">آخر العمليات</h3>
                <button onClick={() => navigate('/payments')} className="text-sm text-primary hover:underline">عرض الكل</button>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="text-right text-slate-400 text-sm border-b border-slate-50">
                            <th className="pb-2 font-normal">العميل</th>
                            <th className="pb-2 font-normal">العملية</th>
                            <th className="pb-2 font-normal">المبلغ</th>
                            <th className="pb-2 font-normal">التاريخ</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm">
                        {activities?.map((activity: any) => {
                            const typeMap: Record<string, { label: string, color: string }> = {
                                'MAINTENANCE': { label: 'صيانة', color: 'bg-blue-50 text-blue-600 border-blue-100' },
                                'SALE': { label: 'بيع', color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
                                'INSTALLMENT': { label: 'قسط', color: 'bg-amber-50 text-amber-600 border-amber-100' },
                                'MANUAL': { label: 'يدوي', color: 'bg-slate-50 text-slate-600 border-slate-100' }
                            };
                            const typeInfo = typeMap[activity.type] || { label: activity.type || 'أخرى', color: 'bg-slate-50 text-slate-500' };

                            return (
                                <tr key={activity.id} className="group hover:bg-slate-50 transition-colors border-b border-slate-50/50 last:border-0">
                                    <td className="py-3 font-bold text-slate-700">{activity.customerName || 'عميل نقدي'}</td>
                                    <td className="py-3">
                                        <div className="flex flex-col gap-0.5">
                                            <span className={`w-fit px-2 py-0.5 rounded-full text-[10px] font-black border uppercase tracking-tighter ${typeInfo.color}`}>
                                                {typeInfo.label}
                                            </span>
                                            <span className="text-[11px] text-slate-500 font-medium truncate max-w-[150px]" title={activity.reason}>
                                                {activity.reason || '-'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="py-3 font-black text-slate-900">{activity.amount.toLocaleString()} ج.م</td>
                                    <td className="py-3 text-slate-400 text-[10px] font-bold">
                                        {new Date(activity.createdAt).toLocaleDateString('ar-EG', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                    </td>
                                </tr>
                            );
                        })}
                        {(!activities || activities.length === 0) && (
                            <tr>
                                <td colSpan={4} className="py-8 text-center text-slate-400 font-bold">
                                    لا توجد عمليات حديثة
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default RecentActivityTable;
