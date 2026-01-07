import React from 'react';
import { Printer } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';

interface MachineLogsTableProps {
    logs: any[];
    isLoading: boolean;
    openReplacementReport: (data: any) => void;
    openReturnReport: (data: any) => void;
    openSaleReport: (data: any) => void;
    branches?: any[];
}

const ACTION_MAP: Record<string, { label: string; color: string }> = {
    'IMPORT': { label: 'استيراد', color: 'bg-blue-100 text-blue-700' },
    'CREATE': { label: 'إضافة', color: 'bg-green-100 text-green-700' },
    'STATUS_CHANGE': { label: 'تغيير حالة', color: 'bg-orange-100 text-orange-700' },
    'SELL': { label: 'بيع', color: 'bg-purple-100 text-purple-700' },
    'EXCHANGE_IN': { label: 'استبدال (وارد)', color: 'bg-teal-100 text-teal-700' },
    'EXCHANGE_OUT': { label: 'استبدال (صادر)', color: 'bg-cyan-100 text-cyan-700' },
    'RETURN_TO_CUSTOMER': { label: 'استرجاع للعميل', color: 'bg-indigo-100 text-indigo-700' },
    'RETURN_FROM_CUSTOMER': { label: 'مرتجع من عميل', color: 'bg-amber-100 text-amber-700' },
    'SALE_VOID': { label: 'إلغاء بيع', color: 'bg-red-100 text-red-700' },
    'MAINTENANCE_OUT': { label: 'صيانة خارجية', color: 'bg-yellow-100 text-yellow-700' },
    'MAINTENANCE_IN': { label: 'عودة من صيانة', color: 'bg-lime-100 text-lime-700' },
};

export const MachineLogsTable: React.FC<MachineLogsTableProps> = ({
    logs,
    isLoading,
    openReplacementReport,
    openReturnReport,
    openSaleReport,
    branches = []
}) => {
    const getBranchName = (id: string) => {
        return branches.find(b => b.id === id)?.name || id;
    };

    const parseDetails = (log: any) => {
        try {
            // Handle plain text common patterns
            if (log.details?.startsWith('Sold to')) {
                const match = log.details.match(/Sold to customer (.+) \((.+)\)/);
                if (match) return `بيع للعميل: ${match[1]} (${match[2] === 'CASH' ? 'كاش' : 'قسط'})`;
            }

            if (log.details?.startsWith('Status changed')) {
                const match = log.details.match(/Status changed from (\w+) to (\w+)/);
                if (match) {
                    const statusMap: any = { 'NEW': 'جديدة', 'STANDBY': 'استبدال', 'DEFECTIVE': 'تالفة', 'CLIENT_REPAIR': 'صيانة عميل', 'SOLD': 'مباعة' };
                    return `تغيير الحالة: ${statusMap[match[1]] || match[1]} ← ${statusMap[match[2]] || match[2]}`;
                }
            }

            // Handle IMPORT action with simple message
            if (log.action === 'IMPORT') {
                if (log.details?.includes('Imported with status')) {
                    const statusMatch = log.details.match(/status\s+(\w+)/);
                    const status = statusMatch?.[1];
                    const statusMap: any = { 'NEW': 'جديدة', 'STANDBY': 'استبدال', 'DEFECTIVE': 'تالفة' };
                    return `تم استيراد الماكينة بحالة: ${statusMap[status] || status || 'جديدة'}`;
                }
                return 'تم استيراد الماكينة';
            }

            // Parse JSON
            const data = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;

            if (data.customer && data.incomingMachine && data.outgoingMachine) {
                return (
                    <div className="flex items-center justify-between gap-4">
                        <div className="text-xs">
                            <span className="font-bold text-blue-700">استبدال:</span> صادر {data.outgoingMachine.serialNumber} | وارد {data.incomingMachine.serialNumber}
                            <div className="text-slate-500">العميل: {data.customer.client_name}</div>
                        </div>
                        <button onClick={() => openReplacementReport(data)} className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100">
                            <Printer size={14} />
                        </button>
                    </div>
                );
            }

            if (log.action === 'SELL' && data.sale) {
                return (
                    <div className="flex items-center justify-between gap-4">
                        <div className="text-xs">
                            <span className="font-bold text-emerald-700">بيع:</span> {data.sale.customer.client_name}
                            <div className="text-slate-500">{data.sale.type === 'CASH' ? 'كاش' : 'قسط'} | {data.sale.totalPrice} ج.م</div>
                        </div>
                        <button onClick={() => openSaleReport(data)} className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100">
                            <Printer size={14} />
                        </button>
                    </div>
                );
            }

            if (log.action === 'RETURN_FROM_CUSTOMER' && data.customer) {
                return (
                    <div className="flex items-center justify-between gap-4">
                        <div className="text-xs">
                            <span className="font-bold text-amber-700">مرتجع:</span> {data.customer.client_name}
                        </div>
                        <button onClick={() => openReturnReport(data)} className="p-1.5 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100">
                            <Printer size={14} />
                        </button>
                    </div>
                );
            }

            // Handle Transfer Logs
            if (data.reason === 'Transfer Order Received' || data.reason === 'Transfer Order Created') {
                return (
                    <div className="text-xs">
                        <span className="font-bold text-blue-700">
                            {data.reason === 'Transfer Order Received' ? 'استلام تحويل' : 'إنشاء تحويل'}
                        </span>
                        <div className="text-slate-500">
                            رقم الإذن: <span className="font-mono">{data.orderNumber}</span>
                            {data.fromBranchId && <span> | من فرع: {getBranchName(data.fromBranchId)}</span>}
                            {data.toBranchId && <span> | إلى فرع: {getBranchName(data.toBranchId)}</span>}
                        </div>
                    </div>
                );
            }

            // For JSON data, extract meaningful info
            if (data.message) return data.message;
            if (data.notes) return data.notes;

            return log.details;
        } catch (e) {
            // Fallback: try to regex extract common transfer fields if parsing failed
            if (log.details && typeof log.details === 'string') {
                if (log.details.includes('Transfer Order')) {
                    const orderMatch = log.details.match(/"orderNumber":"([^"]+)"/);
                    const reasonMatch = log.details.match(/"reason":"([^"]+)"/);
                    if (orderMatch) {
                        return `تحويل مخزني: ${orderMatch[1]} (${reasonMatch?.[1] === 'Transfer Order Received' ? 'استلام' : 'إرسال'})`;
                    }
                }

                // Remove JSON noise and extract message
                const msgMatch = log.details.match(/"message"\s*:\s*"([^"]+)"/);
                if (msgMatch) return msgMatch[1];

                // If it's still raw text, return a fallback
                if (log.details.includes('Imported')) return 'تم استيراد الماكينة';
            }
            return log.details || '-';
        }
    };

    return (
        <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-sm">
            <table className="w-full text-right text-sm">
                <thead className="bg-slate-50/80 border-b border-slate-200">
                    <tr>
                        <th className="p-4 font-semibold text-slate-600">التاريخ</th>
                        <th className="p-4 font-semibold text-slate-600">النوع</th>
                        <th className="p-4 font-semibold text-slate-600">السيريال</th>
                        <th className="p-4 font-semibold text-slate-600">التفاصيل</th>
                        <th className="p-4 font-semibold text-slate-600">المستخدم</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    <AnimatePresence mode="popLayout">
                        {isLoading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <tr key={i} className="animate-pulse">
                                    <td colSpan={5} className="p-4"><div className="h-4 bg-slate-100 rounded-lg w-full" /></td>
                                </tr>
                            ))
                        ) : logs.length === 0 ? (
                            <tr><td colSpan={5} className="p-8 text-center text-slate-400 italic">لا توجد سجلات حركات حالياً</td></tr>
                        ) : (
                            logs.map((log, index) => {
                                const action = ACTION_MAP[log.action] || { label: log.action, color: 'bg-slate-100 text-slate-700' };
                                return (
                                    <motion.tr
                                        key={log.id}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.02 }}
                                        className="hover:bg-slate-50 group"
                                    >
                                        <td className="p-4 text-slate-500 font-mono text-xs">
                                            {new Date(log.createdAt).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}
                                        </td>
                                        <td className="p-4">
                                            <span className={cn("px-2.5 py-1 rounded-full text-[10px] font-bold uppercase", action.color)}>
                                                {action.label}
                                            </span>
                                        </td>
                                        <td className="p-4 font-mono font-bold text-blue-600">{log.serialNumber}</td>
                                        <td className="p-4 max-w-md text-slate-600">
                                            {parseDetails(log)}
                                        </td>
                                        <td className="p-4 text-slate-500">{log.performedBy || '-'}</td>
                                    </motion.tr>
                                );
                            })
                        )}
                    </AnimatePresence>
                </tbody>
            </table>
        </div>
    );
};
