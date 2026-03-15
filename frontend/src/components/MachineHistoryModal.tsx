import { useState, useEffect } from 'react';
import { History, Wrench, DollarSign, ArrowRightLeft, Package } from 'lucide-react';
import { api } from '../api/client';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from './ui/sheet';
import { Button } from './ui/button';
import { cn } from '../lib/utils';

interface MachineHistoryModalProps {
    serialNumber: string;
    onClose: () => void;
}

export default function MachineHistoryModal({ serialNumber, onClose }: MachineHistoryModalProps) {
    const [history, setHistory] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchHistory();
    }, [serialNumber]);

    const fetchHistory = async () => {
        try {
            const data = await api.getMachineHistory(serialNumber);
            setHistory(data);
        } catch (error) {
            console.error('Failed to fetch machine history:', error);
            setHistory(null);
        } finally {
            setLoading(false);
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'maintenance': return <Wrench size={20} className="text-primary" />;
            case 'payment': return <DollarSign size={20} className="text-green-600" />;
            case 'movement': return <ArrowRightLeft size={20} className="text-purple-600" />;
            default: return <Package size={20} className="text-gray-600" />;
        }
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'maintenance': return 'bg-blue-50 border-blue-200';
            case 'payment': return 'bg-green-50 border-green-200';
            case 'movement': return 'bg-purple-50 border-purple-200';
            default: return 'bg-gray-50 border-gray-200';
        }
    };

    return (
        <Sheet open={true} onOpenChange={(open) => !open && onClose()}>
            <SheetContent side="left" className="w-full sm:max-w-xl lg:max-w-2xl overflow-y-auto p-0" dir="rtl">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-blue-700">
                    <div className="flex items-center gap-3 text-white">
                        <div className="p-2 bg-white/20 rounded-lg">
                            <History size={24} />
                        </div>
                        <div>
                            <SheetTitle className="text-xl font-bold text-white">سجل حركات الماكينة</SheetTitle>
                            <SheetDescription className="text-sm text-blue-100">السيريال: {serialNumber}</SheetDescription>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="flex-1 flex items-center justify-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    </div>
                ) : !history ? (
                    <div className="flex-1 flex items-center justify-center py-20 text-gray-500">
                        <p>فشل تحميل البيانات</p>
                    </div>
                ) : (
                    <>
                        {/* Stats */}
                        {history.stats && (
                            <div className="px-6 py-4 bg-gray-50 border-b grid grid-cols-3 gap-4">
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-primary">{history.stats.totalMaintenance || 0}</div>
                                    <div className="text-sm text-gray-600">طلبات صيانة</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-green-600">{(history.stats.totalCost || 0).toFixed(2)} ج.م</div>
                                    <div className="text-sm text-gray-600">إجمالي التكاليف</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-purple-600">{history.stats.totalMovements || 0}</div>
                                    <div className="text-sm text-gray-600">حركات</div>
                                </div>
                            </div>
                        )}

                        {/* Timeline */}
                        <div className="flex-1 overflow-y-auto p-6">
                            {history.timeline.length === 0 ? (
                                <div className="text-center py-20 text-gray-500">
                                    <History size={48} className="mx-auto mb-4 opacity-30" />
                                    <p>لا توجد حركات مسجلة لهذه الماكينة</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {history.timeline.map((item: any, index: number) => (
                                        <div
                                            key={index}
                                            className={`border rounded-lg p-4 ${getTypeColor(item.type)} transition-all hover:shadow-md`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className="mt-1">{getIcon(item.type)}</div>
                                                <div className="flex-1">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <h4 className="font-bold text-gray-800">{item.title}</h4>
                                                        <span className="text-xs text-gray-500">
                                                            {new Date(item.date).toLocaleDateString('ar-EG')}
                                                        </span>
                                                    </div>

                                                    {/* Maintenance Details */}
                                                    {item.type === 'maintenance' && (
                                                        <div className="space-y-1 text-sm">
                                                            {item.details.complaint && (
                                                                <p className="text-gray-700">
                                                                    <span className="font-semibold">الشكوى:</span> {item.details.complaint}
                                                                </p>
                                                            )}
                                                            {item.details.action && (
                                                                <p className="text-gray-700">
                                                                    <span className="font-semibold">الإجراء:</span> {item.details.action}
                                                                </p>
                                                            )}
                                                            {item.details.usedParts && item.details.usedParts.length > 0 && (
                                                                <div className="mt-2 bg-white/50 rounded p-2">
                                                                    <p className="font-semibold text-xs text-gray-600 mb-1">قطع الغيار:</p>
                                                                    <ul className="list-disc list-inside text-xs text-gray-600 space-y-0.5">
                                                                        {item.details.usedParts.map((part: any, i: number) => (
                                                                            <li key={i}>
                                                                                {part.name} × {part.quantity}
                                                                                {part.cost > 0 && ` - ${part.cost} ج.م`}
                                                                            </li>
                                                                        ))}
                                                                    </ul>
                                                                </div>
                                                            )}
                                                            {item.details.totalCost > 0 && (
                                                                <p className="text-green-700 font-bold mt-2">
                                                                    التكلفة: {item.details.totalCost} ج.م
                                                                </p>
                                                            )}
                                                            {item.details.receiptNumber && (
                                                                <p className="text-xs text-gray-500">
                                                                    إيصال: {item.details.receiptNumber}
                                                                </p>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Payment Details */}
                                                    {item.type === 'payment' && (
                                                        <div className="space-y-1 text-sm">
                                                            <p className="text-green-700 font-bold text-lg">
                                                                {item.details.amount} ج.م
                                                            </p>
                                                            <p className="text-gray-700">{item.details.reason}</p>
                                                            {item.details.receiptNumber && (
                                                                <p className="text-xs text-gray-500">
                                                                    إيصال: {item.details.receiptNumber}
                                                                </p>
                                                            )}
                                                            <p className="text-xs text-gray-500">
                                                                مكان الدفع: {item.details.paymentPlace}
                                                            </p>
                                                        </div>
                                                    )}

                                                    {/* Movement Details */}
                                                    {item.type === 'movement' && (
                                                        <div className="space-y-1.5">
                                                            {(() => {
                                                                try {
                                                                    const data = typeof item.details.details === 'string' ? JSON.parse(item.details.details) : item.details.details;
                                                                    const action = item.details.action;

                                                                    // Compact Row Component Helper
                                                                    const CompactMovementRow = ({ icon, label, children, bgColor, textColor, borderColor }: any) => (
                                                                        <div className={cn("flex items-center justify-between p-2 rounded-xl border shadow-sm transition-all hover:bg-white", bgColor, borderColor)}>
                                                                            <div className="flex items-center gap-2 overflow-hidden">
                                                                                <span className={cn("text-[10px] font-black px-2 py-0.5 rounded-lg flex items-center gap-1 whitespace-nowrap", textColor, bgColor.replace('50', '100'))}>
                                                                                    {icon} {label}
                                                                                </span>
                                                                                <div className="text-[11px] font-bold text-slate-600 truncate">
                                                                                    {children}
                                                                                </div>
                                                                            </div>
                                                                            <div className="text-[9px] font-black text-slate-400 bg-white/80 px-2 py-0.5 rounded-full border border-slate-100 whitespace-nowrap ml-2">
                                                                                {item.details.performedBy || 'النظام'}
                                                                            </div>
                                                                        </div>
                                                                    );

                                                                    // 1. Exchange (Specific for Machine History)
                                                                    if (action.includes('EXCHANGE') || data.oldMachine || data.newMachine) {
                                                                        const isOutgoingExchange = action === 'EXCHANGE_OUT' || data.outgoingMachine?.serialNumber === serialNumber;
                                                                        const otherSerial = isOutgoingExchange
                                                                            ? (data.newMachine?.serialNumber || data.incomingMachine?.serialNumber)
                                                                            : (data.oldMachine?.serialNumber || data.outgoingMachine?.serialNumber);

                                                                        return (
                                                                            <CompactMovementRow icon="🔄" label="استبدال ماكينة" bgColor="bg-amber-50/50" textColor="text-amber-700" borderColor="border-amber-100/50">
                                                                                <div className="flex items-center gap-1.5">
                                                                                    <span className="text-slate-400 font-mono opacity-60">
                                                                                        {isOutgoingExchange ? serialNumber : (otherSerial || 'القديمة')}
                                                                                    </span>
                                                                                    <ArrowRightLeft size={10} className="text-slate-300 shrink-0" />
                                                                                    <span className="text-emerald-600 font-mono">
                                                                                        {isOutgoingExchange ? (otherSerial || 'الجديدة') : serialNumber}
                                                                                    </span>
                                                                                </div>
                                                                            </CompactMovementRow>
                                                                        );
                                                                    }

                                                                    // 2. Sale
                                                                    if (data.sale || action === 'SELL') {
                                                                        return (
                                                                            <CompactMovementRow icon="🛒" label="عملية بيع" bgColor="bg-emerald-50/50" textColor="text-emerald-700" borderColor="border-emerald-100/50">
                                                                                {data.customer?.client_name || 'عميل'} | {data.sale?.type === 'CASH' ? 'كاش' : 'قسط'}
                                                                            </CompactMovementRow>
                                                                        );
                                                                    }

                                                                    // 3. Transfers
                                                                    if (action.includes('TRANSFER') || action === 'IMPORT' || data.orderId) {
                                                                        const isIncoming = action === 'TRANSFER_IN' || action === 'IMPORT';
                                                                        return (
                                                                            <CompactMovementRow icon={isIncoming ? "📥" : "📤"} label={isIncoming ? "استلام تحويل" : "إرسال تحويل"} bgColor="bg-indigo-50/50" textColor="text-indigo-700" borderColor="border-indigo-100/50">
                                                                                {isIncoming ? 'من: ' : 'إلى: '} {data.fromBranchName || data.toBranchName || 'فرع آخر'}
                                                                            </CompactMovementRow>
                                                                        );
                                                                    }

                                                                    // 4. Returns
                                                                    if (action.includes('RETURN') || data.reason) {
                                                                        return (
                                                                            <CompactMovementRow icon="🔄" label="إرجاع مخزن" bgColor="bg-rose-50/50" textColor="text-rose-700" borderColor="border-rose-100/50">
                                                                                العميل: {data.customer?.client_name || 'غير محدد'}
                                                                            </CompactMovementRow>
                                                                        );
                                                                    }

                                                                    // 5. Assignments
                                                                    if (action === 'ASSIGN') {
                                                                        return (
                                                                            <CompactMovementRow icon="📠" label="تسليم عميل" bgColor="bg-blue-50/50" textColor="text-blue-700" borderColor="border-blue-100/50">
                                                                                العميل: {data.customer?.client_name || 'غير محدد'}
                                                                            </CompactMovementRow>
                                                                        );
                                                                    }

                                                                    return <div className="text-[11px] text-slate-400 italic bg-slate-50 p-1.5 rounded-lg border border-dashed">{item.details.action}: {item.details.details}</div>;
                                                                } catch (e) {
                                                                    return <div className="text-[11px] text-slate-400 italic">{item.details.details}</div>;
                                                                }
                                                            })()}
                                                        </div>
                                                    )}

                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )}

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                    <Button onClick={onClose} className="w-full bg-primary hover:bg-primary/90">
                        إغلاق
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
    );
}
