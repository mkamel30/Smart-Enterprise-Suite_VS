import React from 'react';
import { Eye, ArrowLeftRight, Package } from 'lucide-react';
import { TransferOrderStatusBadge, TransferOrderTypeBadge } from './TransferBadges';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

interface TableProps {
    isLoading: boolean;
    orders: any[] | undefined;
    onViewOrder: (order: any) => void;
    userBranchId?: string;
}

export function TransferOrdersTable({ isLoading, orders, onViewOrder, userBranchId }: TableProps) {
    return (
        <div className="bg-white/50 backdrop-blur-sm rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
                <table className="w-full text-right text-sm whitespace-nowrap">
                    <thead className="bg-slate-50/50 border-b border-slate-200">
                        <tr>
                            <th className="p-5 font-bold text-slate-500 uppercase tracking-wider text-xs">رقم الإذن</th>
                            <th className="p-5 font-bold text-slate-500 uppercase tracking-wider text-xs">مسار النقل</th>
                            <th className="p-5 font-bold text-slate-500 uppercase tracking-wider text-xs">النوع</th>
                            <th className="p-5 font-bold text-slate-500 uppercase tracking-wider text-xs text-center">الأصناف</th>
                            <th className="p-5 font-bold text-slate-500 uppercase tracking-wider text-xs">الحالة</th>
                            <th className="p-5 font-bold text-slate-500 uppercase tracking-wider text-xs">التاريخ</th>
                            <th className="p-5 font-bold text-slate-500 uppercase tracking-wider text-xs w-24"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {isLoading ? (
                            <tr>
                                <td colSpan={7} className="p-12 text-center">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                                        <span className="text-slate-500 font-medium">جاري تحميل البيانات...</span>
                                    </div>
                                </td>
                            </tr>
                        ) : !orders || orders.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="p-12 text-center">
                                    <div className="flex flex-col items-center gap-2">
                                        <p className="text-slate-400 font-bold text-lg">لا توجد أذونات حالياً</p>
                                        <p className="text-slate-400 text-sm">سيتم عرض الأذونات الواردة والصادرة هنا</p>
                                    </div>
                                </td>
                            </tr>
                        ) : orders.map((order: any, index: number) => {
                            const isSent = order.fromBranchId === userBranchId;
                            return (
                                <motion.tr
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.03 }}
                                    key={order.id}
                                    className="group hover:bg-slate-50/80 transition-all cursor-pointer"
                                    onClick={() => onViewOrder(order)}
                                >
                                    <td className="p-5">
                                        <span className="font-mono font-black text-slate-900 bg-slate-100 px-3 py-1.5 rounded-lg text-xs">
                                            {order.orderNumber}
                                        </span>
                                    </td>
                                    <td className="p-5">
                                        <div className="flex items-center gap-4">
                                            <div className={cn(
                                                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:rotate-12",
                                                isSent ? "bg-amber-100 text-amber-600" : "bg-indigo-100 text-indigo-600"
                                            )}>
                                                <ArrowLeftRight size={20} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 text-sm font-bold">
                                                    <span className="text-slate-700">{order.fromBranch?.name || '—'}</span>
                                                    <span className="text-slate-300">→</span>
                                                    <span className="text-slate-700">{order.toBranch?.name || '—'}</span>
                                                </div>
                                                <span className={cn(
                                                    "text-[10px] font-black uppercase tracking-widest",
                                                    isSent ? "text-amber-500" : "text-indigo-500"
                                                )}>
                                                    {isSent ? 'صادر من فرعك' : 'وارد إلى فرعك'}
                                                </span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-5">
                                        <TransferOrderTypeBadge type={order.type} />
                                    </td>
                                    <td className="p-5 text-center">
                                        <div className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-xl text-xs font-black border border-blue-100">
                                            <Package size={14} />
                                            {order.items?.length || 0}
                                        </div>
                                    </td>
                                    <td className="p-5">
                                        <TransferOrderStatusBadge status={order.status} />
                                    </td>
                                    <td className="p-5 font-mono text-[10px] text-slate-400 font-bold">
                                        {new Date(order.createdAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}
                                    </td>
                                    <td className="p-5">
                                        <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                className="p-2.5 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-xl transition-all shadow-lg shadow-indigo-100/50 bg-white border border-indigo-100"
                                            >
                                                <Eye size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </motion.tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
