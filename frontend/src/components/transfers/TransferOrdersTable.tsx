import React from 'react';
import { Eye } from 'lucide-react';
import { TransferOrderStatusBadge, TransferOrderTypeBadge } from './TransferBadges';

interface TableProps {
    isLoading: boolean;
    orders: any[] | undefined;
    onViewOrder: (order: any) => void;
    userBranchId?: string;
}

export function TransferOrdersTable({ isLoading, orders, onViewOrder, userBranchId }: TableProps) {
    if (isLoading) {
        return <div className="p-8 text-center text-slate-500">جاري التحميل...</div>;
    }

    if (!orders || orders.length === 0) {
        return <div className="p-8 text-center text-slate-500">لا توجد أذونات</div>;
    }

    return (
        <table className="w-full">
            <thead className="bg-slate-50">
                <tr>
                    <th className="text-center px-4 py-3 font-medium">رقم الإذن</th>
                    <th className="text-center px-4 py-3 font-medium">الاتجاه</th>
                    <th className="text-center px-4 py-3 font-medium">من → إلى</th>
                    <th className="text-center px-4 py-3 font-medium">النوع</th>
                    <th className="text-center px-4 py-3 font-medium">الأصناف</th>
                    <th className="text-center px-4 py-3 font-medium">الحالة</th>
                    <th className="text-center px-4 py-3 font-medium">التاريخ</th>
                    <th className="text-center px-4 py-3 font-medium">الإجراءات</th>
                </tr>
            </thead>
            <tbody>
                {orders.map((order: any) => {
                    const isSent = order.fromBranchId === userBranchId;
                    return (
                        <tr key={order.id} className="border-t hover:bg-slate-50">
                            <td className="px-4 py-3">
                                <span className="font-mono bg-slate-100 px-2 py-1 rounded">
                                    {order.orderNumber}
                                </span>
                            </td>
                            <td className="px-4 py-3">
                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold ${isSent ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' : 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200'
                                    }`}>
                                    {isSent ? 'صادر' : 'وارد'}
                                </span>
                            </td>
                            <td className="px-4 py-3">
                                <div className="flex items-center gap-1 text-sm">
                                    <span className="text-red-600">{order.fromBranch?.name || '—'}</span>
                                    <span className="text-slate-400">→</span>
                                    <span className="text-green-600">{order.toBranch?.name || '—'}</span>
                                </div>
                            </td>
                            <td className="px-4 py-3">
                                <TransferOrderTypeBadge type={order.type} />
                            </td>
                            <td className="px-4 py-3">
                                <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-sm">
                                    {order.items?.length || 0} صنف
                                </span>
                            </td>
                            <td className="px-4 py-3">
                                <TransferOrderStatusBadge status={order.status} />
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-500">
                                {new Date(order.createdAt).toLocaleDateString('ar-EG')}
                            </td>
                            <td className="px-4 py-3">
                                <button
                                    onClick={() => onViewOrder(order)}
                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                                    title="عرض التفاصيل"
                                >
                                    <Eye size={16} />
                                </button>
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}
