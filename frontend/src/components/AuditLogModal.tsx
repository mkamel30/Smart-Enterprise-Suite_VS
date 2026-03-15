import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { FaHistory, FaUser, FaInfoCircle, FaCalendarAlt } from 'react-icons/fa';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from './ui/sheet';
import { X, ArrowRightLeft } from 'lucide-react';
import { cn } from '../lib/utils';

interface AuditLogModalProps {
    entityType: 'CUSTOMER' | 'USER' | 'REQUEST' | 'PAYMENT' | 'PART' | 'ALL';
    entityId?: string;
    isOpen: boolean;
    onClose: () => void;
    title?: string;
}

interface AuditLog {
    id: string;
    action: string;
    details: string;
    performedBy: string;
    createdAt: string;
    entityType: string;
}

const AuditLogModal: React.FC<AuditLogModalProps> = ({ entityType, entityId, isOpen, onClose, title }) => {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchLogs();
        }
    }, [isOpen, entityType, entityId]);

    // ESC key handler is handled by Sheet component automatically

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const data = await api.getAuditLogs({ entityType, entityId });
            if (Array.isArray(data)) {
                setLogs(data);
            }
        } catch (error) {
            console.error('Failed to fetch logs:', error);
        } finally {
            setLoading(false);
        }
    };


    const formatDetails = (details: string) => {
        try {
            const parsed = JSON.parse(details);

            // Smart generic formatter
            const renderObject = (obj: any, depth = 0): React.ReactElement => {
                // Skip if not an object
                if (typeof obj !== 'object' || obj === null) {
                    return <span className="text-slate-800 font-medium">{String(obj)}</span>;
                }

                // Detect special patterns and apply styling
                const isCustomer = obj.client_name || obj.bkcode;
                const isMachine = obj.serialNumber || obj.model;
                const isExchange = obj.incomingMachine && obj.outgoingMachine;
                const isReturn = obj.machine && obj.customer && obj.reason;

                // Handle Exchange
                if (isExchange && depth === 0) {
                    return (
                        <div className="text-sm space-y-3 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 shadow-sm">
                            <div className="flex items-center gap-2">
                                <span className="font-black text-indigo-700">🔄 استبدال ماكينة</span>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-white p-3 rounded-lg border border-red-100 shadow-sm">
                                    <p className="text-[10px] text-red-600 font-black mb-1.5 uppercase tracking-tighter">⬅️ ماكينة قديمة</p>
                                    {renderObject(obj.outgoingMachine, depth + 1)}
                                </div>
                                <div className="bg-white p-3 rounded-lg border border-emerald-100 shadow-sm">
                                    <p className="text-[10px] text-emerald-600 font-black mb-1.5 uppercase tracking-tighter">➡️ ماكينة جديدة</p>
                                    {renderObject(obj.incomingMachine, depth + 1)}
                                </div>
                            </div>
                            <div className="pt-3 border-t border-indigo-100 flex items-center justify-between">
                                <span className="text-slate-500 text-xs font-bold">العميل:</span>
                                <p className="font-bold text-slate-900 text-sm">{obj.customer?.client_name} <span className="text-slate-400 font-mono text-xs">({obj.customer?.bkcode})</span></p>
                            </div>
                            {obj.notes && <p className="text-xs text-slate-600 pt-1 italic bg-white/50 p-2 rounded-lg border border-indigo-50">📝 {obj.notes}</p>}
                        </div>
                    );
                }

                // Handle Part Usage (Stock Movement in Request)
                const isPartUsage = obj.partName && obj.quantity && obj.type === 'OUT';
                if (isPartUsage && depth === 0) {
                    return (
                        <div className="text-sm space-y-3 bg-blue-50/50 p-4 rounded-xl border border-blue-100 shadow-sm">
                            <div className="flex items-center gap-2">
                                <span className="font-black text-blue-700">🔧 استخدام قطعة غيار</span>
                            </div>
                            <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-blue-100 shadow-sm">
                                <div>
                                    <p className="font-black text-slate-900">{obj.partName}</p>
                                    <p className="text-[10px] text-slate-400 font-mono font-bold tracking-tight">{obj.partNumber}</p>
                                </div>
                                <div className="text-right">
                                    <span className="bg-indigo-600 text-white px-3 py-1 rounded-full text-[10px] font-black shadow-sm">
                                        الكمية: {obj.quantity}
                                    </span>
                                </div>
                            </div>
                            <div className="pt-2 border-t border-blue-100">
                                <span className="text-slate-500 text-xs text-right block font-bold">السبب: {obj.reason || 'صيانة'}</span>
                            </div>
                        </div>
                    );
                }

                // Handle Return
                if (isReturn && depth === 0) {
                    return (
                        <div className="text-sm space-y-3 bg-orange-50/50 p-4 rounded-xl border border-orange-100 shadow-sm">
                            <div className="flex items-center gap-2">
                                <span className="font-black text-orange-700">📦 إرجاع ماكينة</span>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-white p-2.5 rounded-lg border border-orange-100 shadow-sm">
                                    <span className="text-slate-400 text-[10px] font-black uppercase mb-0.5 block">السيريال</span>
                                    <p className="font-mono font-black text-slate-900 text-sm">{obj.machine.serialNumber}</p>
                                </div>
                                <div className="bg-white p-2.5 rounded-lg border border-orange-100 shadow-sm">
                                    <span className="text-slate-400 text-[10px] font-black uppercase mb-0.5 block">الموديل</span>
                                    <p className="font-bold text-slate-900 text-sm whitespace-nowrap overflow-hidden text-ellipsis">{obj.machine.model || '-'}</p>
                                </div>
                                <div className="bg-white p-2.5 rounded-lg border border-orange-100 shadow-sm col-span-2">
                                    <span className="text-slate-400 text-[10px] font-black uppercase mb-0.5 block">العميل</span>
                                    <div className="flex justify-between items-center">
                                        <p className="font-black text-slate-900 text-sm">{obj.customer.client_name}</p>
                                        <p className="font-mono text-[10px] font-black bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">{obj.customer.bkcode}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="pt-2 border-t border-orange-200">
                                <span className="text-slate-500 text-[10px] font-black block mb-1">السبب:</span>
                                <p className="text-slate-800 font-bold text-sm bg-white/50 p-2 rounded-lg border border-orange-50">{obj.reason}</p>
                            </div>
                            {obj.notes && <p className="text-xs text-slate-500 pt-1 italic">📝 {obj.notes}</p>}
                        </div>
                    );
                }

                // Handle Customer object
                if (isCustomer && depth > 0) {
                    return (
                        <div className="space-y-0.5">
                            <p className="font-black text-slate-900 text-sm">{obj.client_name}</p>
                            <p className="text-[10px] text-slate-400 font-mono font-bold tracking-tight">{obj.bkcode}</p>
                        </div>
                    );
                }

                // Handle Machine object
                if (isMachine && depth > 0) {
                    return (
                        <div className="space-y-1">
                            <p className="font-mono text-sm font-black text-slate-900">{obj.serialNumber}</p>
                            <div className="flex items-center gap-1.5">
                                <p className="text-[10px] text-slate-500 font-bold bg-slate-100 px-1.5 py-0.5 rounded">{obj.model || obj.manufacturer || '-'}</p>
                                {obj.status && <p className="text-[10px] text-indigo-500 font-black">• {obj.status}</p>}
                            </div>
                        </div>
                    );
                }

                // Handle old/new changes (detailed diffs)
                if (obj.oldValue !== undefined || obj.newValue !== undefined) {
                    return (
                        <div className="flex flex-col gap-1.5 bg-slate-50/50 p-3 rounded-xl border border-slate-100 shadow-sm">
                            {obj.field && (
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                    {obj.field}
                                </div>
                            )}
                            <div className="flex items-center gap-3">
                                <div className="flex-1 px-3 py-2 bg-rose-50 rounded-lg border border-rose-100/50 text-rose-700 text-xs font-bold line-through decoration-rose-300 opacity-80">
                                    {String(obj.oldValue || '-')}
                                </div>
                                <div className="text-slate-300 font-black">
                                    <ArrowRightLeft size={14} />
                                </div>
                                <div className="flex-1 px-3 py-2 bg-emerald-50 rounded-lg border border-emerald-100/50 text-emerald-700 text-sm font-black shadow-sm">
                                    {String(obj.newValue || '-')}
                                </div>
                            </div>
                        </div>
                    );
                }

                // Handle old/new changes (legacy)
                if (obj.old !== undefined && obj.new !== undefined) {
                    return (
                        <div className="flex items-center gap-2">
                            <span className="text-red-400 line-through text-xs font-bold">{String(obj.old)}</span>
                            <span className="text-slate-300 font-black">→</span>
                            <span className="text-emerald-600 font-black text-sm">{String(obj.new)}</span>
                        </div>
                    );
                }

                // Detect if value is a JSON string that should be parsed
                const parseIfJson = (val: any) => {
                    if (typeof val !== 'string') return val;
                    try {
                        const p = JSON.parse(val);
                        if (typeof p === 'object' && p !== null) return p;
                    } catch (e) { }
                    return val;
                };

                const entries = Object.entries(obj);
                return (
                    <div className="space-y-3">
                        {entries.map(([key, value]) => {
                            // Specialized renderer for usedParts
                            if (key === 'usedParts' || key === 'parts') {
                                const data = parseIfJson(value);
                                const parts = data?.parts || (Array.isArray(data) ? data : []);
                                const total = data?.totalCost || 0;

                                if (parts.length > 0) {
                                    return (
                                        <div key={key} className="space-y-2 mt-1 border-t border-slate-50 pt-3 first:border-0 first:pt-0">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{translateField(key)} ({parts.length}):</span>
                                                {total > 0 && <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100 shadow-sm">{total} ج.م</span>}
                                            </div>
                                            <div className="grid grid-cols-1 gap-2">
                                                {parts.map((part: any, i: number) => (
                                                    <div key={i} className="flex justify-between items-center bg-slate-50/80 p-2.5 rounded-xl border border-slate-100/50 group/part hover:bg-white hover:shadow-sm transition-all duration-300">
                                                        <div className="flex items-center gap-2.5">
                                                            <span className="w-6 h-6 bg-white rounded-lg flex items-center justify-center text-[11px] font-black text-indigo-600 shadow-sm border border-slate-100 group-hover/part:scale-110 transition-transform">{part.quantity}</span>
                                                            <span className="text-[11px] font-bold text-slate-700 leading-tight">{part.partName || part.name}</span>
                                                        </div>
                                                        <span className={cn(
                                                            "text-[10px] font-black px-2.5 py-1 rounded-full border shadow-sm transition-all",
                                                            part.isPaid ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                                        )}>
                                                            {part.isPaid ? `${(part.totalCost || part.cost * part.quantity)} ج.م` : 'مجاني'}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                }
                            }

                            return (
                                <div key={key} className="flex gap-3 items-start border-b border-slate-100/30 pb-2.5 last:border-0 last:pb-0">
                                    <span className="font-black text-slate-400 text-[10px] uppercase tracking-tighter min-w-[85px] mt-1 shrink-0">{translateField(key)}:</span>
                                    <div className="flex-1">
                                        {(() => {
                                            const val = parseIfJson(value);
                                            if (typeof val === 'object' && val !== null) {
                                                return renderObject(val, depth + 1);
                                            }

                                            // Highlight specific values
                                            if (key === 'status') {
                                                return <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 text-[10px] font-black">{String(val)}</span>;
                                            }

                                            return <span className="text-slate-800 text-sm font-bold leading-relaxed">{String(val)}</span>;
                                        })()}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                );
            };

            return renderObject(parsed);


        } catch (e) {
            // If not JSON, translate common patterns and return as plain text
            const translatedText = details
                .replace(/Created request for customer/gi, 'تم إنشاء طلب للعميل')
                .replace(/Updated customer/gi, 'تم تحديث بيانات العميل')
                .replace(/Deleted customer/gi, 'تم حذف العميل')
                .replace(/Created payment/gi, 'تم إنشاء دفعة')
                .replace(/Machine received/gi, 'تم استلام ماكينة')
                .replace(/Machine returned/gi, 'تم إرجاع ماكينة')
                .replace(/Exchanged machine/gi, 'تم استبدال ماكينة')
                .replace(/Sold machine/gi, 'تم بيع ماكينة')
                .replace(/Closed request/gi, 'تم إغلاق الطلب')
                .replace(/Assigned to technician/gi, 'تم التعيين للفني')
                .replace(/Action Cost/gi, 'تكلفة الإجراء')
                .replace(/In Progress/gi, 'قيد التنفيذ')
                .replace(/Pending/gi, 'قيد الانتظار')
                .replace(/Completed/gi, 'مكتمل')
                .replace(/Cancelled/gi, 'ملغي')
                .replace(/for customer/gi, 'للعميل')
                .replace(/from customer/gi, 'من العميل')
                .replace(/to customer/gi, 'للعميل')
                .replace(/with status/gi, 'بحالة')
                .replace(/Imported/gi, 'تم استيراد')
                .replace(/Removed/gi, 'تم إزالة')
                .replace(/duplicate machines/gi, 'ماكينات مكررة')
                .replace(/kept with customers/gi, 'محفوظة مع العملاء')
                .replace(/from warehouse/gi, 'من المخزن')
                .replace(/Manually added/gi, 'تمت الإضافة يدوياً')
                .replace(/Status changed/gi, 'تم تغيير الحالة')
                .replace(/Payment recorded/gi, 'تم تسجيل الدفعة');

            return <span className="text-slate-700 text-sm font-bold bg-white/40 p-2.5 rounded-xl border border-slate-100 block">{translatedText}</span>;
        }
    };

    const translateAction = (action: string): string => {
        const translations: { [key: string]: string } = {
            'CREATE': 'إنشاء',
            'UPDATE': 'تحديث',
            'DELETE': 'حذف',
            'MACHINE_RECEIVED': 'استلام ماكينة',
            'MACHINE_RETURN': 'إرجاع ماكينة',
            'EXCHANGE_OUT': 'إخراج مستبدلة',
            'EXCHANGE_IN': 'إدخال بديلة',
            'RETURN_FROM_CLIENT': 'إرجاع من عميل',
            'SELL': 'بيع',
            'IMPORT': 'استيراد',
            'STATUS_CHANGE': 'تغيير حالة',
            'DUPLICATE_CLEANUP': 'تنظيف مكررات',
            'ASSIGN': 'تخصيص شريحة',
            'RETURN': 'إرجاع شريحة',
            'PART_USAGE': 'استخدام قطعة غيار'
        };
        return translations[action] || action;
    };

    const translateField = (field: string): string => {
        const translations: { [key: string]: string } = {
            'machineId': 'رقم الماكينة',
            'machine': 'الماكينة',
            'notes': 'ملاحظات',
            'reason': 'السبب',
            'status': 'الحالة',
            'customerId': 'رقم العميل',
            'customer': 'العميل',
            'serialNumber': 'السيريال',
            'model': 'الموديل',
            'manufacturer': 'الشركة المصنعة',
            'actionTaken': 'الإجراء المتخذ',
            'usedParts': 'قطع الغيار',
            'totalCost': 'إجمالي التكلفة',
            'receiptNumber': 'رقم الإيصال',
            'closingUserName': 'بواسطة',
            'technician': 'الفني',
            'technicianName': 'الفني',
            'complaint': 'الشكوى',
            'performedBy': 'تم بواسطة',
            'action': 'الإجراء',
            'cost': 'التكلفة',
            'technicianId': 'رقم الفني',
            'requestId': 'رقم الطلب',
            'paymentMethod': 'طريقة الدفع',
            'amount': 'المبلغ',
            'date': 'التاريخ'
        };
        return translations[field] || field;
    };

    const getActionColor = (action: string) => {
        if (action.includes('CREATE')) return 'bg-emerald-50 text-emerald-700 border-emerald-100 shadow-emerald-50';
        if (action.includes('DELETE')) return 'bg-rose-50 text-rose-700 border-rose-100 shadow-rose-50';
        if (action.includes('UPDATE')) return 'bg-blue-50 text-blue-700 border-blue-100 shadow-blue-50';
        return 'bg-slate-50 text-slate-700 border-slate-100 shadow-slate-50';
    };

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent side="left" className="w-full sm:max-w-xl flex flex-col p-0 border-r-0 bg-slate-50/50" dir="rtl">
                <SheetHeader className="bg-white p-6 border-b shrink-0 shadow-sm relative z-10">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-50 rounded-2xl border border-indigo-100 shadow-sm">
                            <FaHistory className="text-indigo-600 text-2xl" />
                        </div>
                        <div>
                            <SheetTitle className="text-2xl font-black text-slate-900 leading-tight">سجل الحركات</SheetTitle>
                            <SheetDescription className="text-slate-500 font-bold text-sm mt-0.5">{title ? `${title}` : 'تتبع التغييرات والإجراءات السابقة للنظام'}</SheetDescription>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="absolute left-6 top-6 p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-900 transition-all border border-transparent hover:border-slate-200"
                    >
                        <X size={20} />
                    </button>
                </SheetHeader>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-6 py-8 space-y-6 custom-scroll">
                    {loading ? (
                        <div className="flex flex-col justify-center items-center py-20 gap-4">
                            <div className="animate-spin rounded-full h-12 w-12 border-[4px] border-indigo-600/20 border-t-indigo-600 shadow-sm"></div>
                            <p className="text-slate-400 font-bold text-sm">جاري جلب السجلات...</p>
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="text-center py-20 px-8 bg-white rounded-3xl border-2 border-dashed border-slate-200 shadow-sm mt-10 mx-4">
                            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                                <FaInfoCircle className="text-slate-300 text-4xl opacity-50" />
                            </div>
                            <h3 className="font-black text-slate-900 text-lg mb-1">لا توجد سجلات بعد</h3>
                            <p className="text-slate-400 font-medium">سيتم تسجيل جميع الحركات المستقبلية هنا تلقائياً</p>
                        </div>
                    ) : (
                        <div className="space-y-4 relative">
                            {/* Vertical Timeline Line */}
                            <div className="absolute top-0 bottom-0 right-[22px] w-[2px] bg-slate-200/50 hidden sm:block"></div>

                            {Array.isArray(logs) && logs.map((log, idx) => (
                                <div key={log.id} className="relative translate-y-0 opacity-0 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-forwards" style={{ animationDelay: `${idx * 50}ms` }}>
                                    {/* Timeline Dot */}
                                    <div className="absolute top-6 right-[17px] w-3 h-3 rounded-full bg-indigo-500 border-[3px] border-white shadow-sm z-10 hidden sm:block"></div>

                                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md hover:border-indigo-100/50 transition-all group mr-0 sm:mr-10">
                                        <div className="flex justify-between items-start mb-4 gap-3 flex-wrap sm:flex-nowrap">
                                            <div className="flex items-center gap-2.5 flex-wrap">
                                                <span className={`text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-wider border shadow-sm ${getActionColor(log.action)}`}>
                                                    {translateAction(log.action)}
                                                </span>
                                                {(() => {
                                                    try {
                                                        const details = JSON.parse(log.details);
                                                        const machineSerial =
                                                            details.machine?.serialNumber ||
                                                            details.incomingMachine?.serialNumber ||
                                                            details.outgoingMachine?.serialNumber ||
                                                            details.serialNumber ||
                                                            details.sim?.phoneNumber; // For SIMs

                                                        const isSim = log.action === 'ASSIGN' || log.action === 'RETURN' || details.simId || details.sim;

                                                        if (machineSerial) {
                                                            return (
                                                                <span className="text-[10px] bg-indigo-600 text-white px-2.5 py-1 rounded-lg font-mono font-black border border-indigo-700 shadow-sm">
                                                                    {isSim ? '💳' : '📠'} {machineSerial}
                                                                </span>
                                                            );
                                                        }
                                                    } catch (e) { }
                                                    return null;
                                                })()}
                                            </div>
                                            <div className="flex flex-col items-end gap-1.5 min-w-[120px]">
                                                <div className="text-[10px] font-black text-slate-700 flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-100 group-hover:bg-indigo-50 group-hover:text-indigo-700 group-hover:border-indigo-100 transition-colors">
                                                    <FaUser className="text-indigo-400 group-hover:text-indigo-600" size={10} />
                                                    {log.performedBy || 'النظام'}
                                                </div>
                                                <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1 opacity-80">
                                                    <FaCalendarAlt className="text-[9px]" />
                                                    {new Date(log.createdAt).toLocaleString('ar-EG', {
                                                        year: 'numeric',
                                                        month: 'short',
                                                        day: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="relative">
                                            <div className="text-slate-900">
                                                {formatDetails(log.details)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t bg-white shrink-0 shadow-[0_-4px_10px_rgba(0,0,0,0.02)] relative z-10">
                    <button
                        onClick={onClose}
                        className="w-full bg-slate-900 text-white font-black py-3.5 rounded-2xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 active:scale-[0.98] text-sm"
                    >
                        إغلاق السجل
                    </button>
                </div>
            </SheetContent>
        </Sheet>
    );
};

export default AuditLogModal;

