import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { FaHistory, FaUser, FaInfoCircle, FaCalendarAlt } from 'react-icons/fa';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from './ui/sheet';
import { Button } from './ui/button';

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

    const fetchLogs = async () => {
        setLoading(true);
        try {
            // Depending on how api client is structured, we might need a raw call or add a method
            // Assuming we can use a direct fetch or existing client method if applicable
            // Since client.ts isn't updated yet, we'll try a fetch here or assume client update

            let url = `http://localhost:5000/api/audit-logs?entityType=${entityType}`;
            if (entityId) url += `&entityId=${entityId}`;

            const response = await fetch(url); // TODO: Use api client in production
            const data = await response.json();

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
                    return <span className="text-gray-800">{String(obj)}</span>;
                }

                // Detect special patterns and apply styling
                const isCustomer = obj.client_name || obj.bkcode;
                const isMachine = obj.serialNumber || obj.model;
                const isExchange = obj.incomingMachine && obj.outgoingMachine;
                const isReturn = obj.machine && obj.customer && obj.reason;

                // Handle Exchange
                if (isExchange && depth === 0) {
                    return (
                        <div className="text-sm space-y-2 bg-green-50 p-3 rounded border border-green-200">
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-green-700">🔄 استبدال ماكينة</span>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-red-50 p-2 rounded border border-red-200">
                                    <p className="text-xs text-red-600 font-bold mb-1">⬅️ ماكينة قديمة</p>
                                    {renderObject(obj.outgoingMachine, depth + 1)}
                                </div>
                                <div className="bg-blue-50 p-2 rounded border border-blue-200">
                                    <p className="text-xs text-blue-600 font-bold mb-1">➡️ ماكينة جديدة</p>
                                    {renderObject(obj.incomingMachine, depth + 1)}
                                </div>
                            </div>
                            <div className="pt-2 border-t border-green-300">
                                <span className="text-gray-600 text-xs">العميل:</span>
                                <p className="font-medium text-gray-800">{obj.customer?.client_name} ({obj.customer?.bkcode})</p>
                            </div>
                            {obj.notes && <p className="text-xs text-gray-600 pt-1">📝 {obj.notes}</p>}
                        </div>
                    );
                }

                // Handle Return
                if (isReturn && depth === 0) {
                    return (
                        <div className="text-sm space-y-2 bg-orange-50 p-3 rounded border border-orange-200">
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-orange-700">📦 إرجاع ماكينة</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <span className="text-gray-600 text-xs">السيريال:</span>
                                    <p className="font-mono font-bold text-gray-800">{obj.machine.serialNumber}</p>
                                </div>
                                <div>
                                    <span className="text-gray-600 text-xs">الموديل:</span>
                                    <p className="font-medium text-gray-800">{obj.machine.model || '-'}</p>
                                </div>
                                <div>
                                    <span className="text-gray-600 text-xs">العميل:</span>
                                    <p className="font-medium text-gray-800">{obj.customer.client_name}</p>
                                </div>
                                <div>
                                    <span className="text-gray-600 text-xs">كود:</span>
                                    <p className="font-mono text-gray-800">{obj.customer.bkcode}</p>
                                </div>
                            </div>
                            <div className="pt-2 border-t border-orange-300">
                                <span className="text-gray-600 text-xs">السبب:</span>
                                <p className="text-gray-800">{obj.reason}</p>
                            </div>
                            {obj.notes && <p className="text-xs text-gray-600 pt-1">📝 {obj.notes}</p>}
                        </div>
                    );
                }

                // Handle Customer object
                if (isCustomer && depth > 0) {
                    return (
                        <div className="space-y-0.5">
                            <p className="font-medium text-gray-800">{obj.client_name}</p>
                            <p className="text-xs text-gray-500 font-mono">{obj.bkcode}</p>
                        </div>
                    );
                }

                // Handle Machine object
                if (isMachine && depth > 0) {
                    return (
                        <div className="space-y-0.5">
                            <p className="font-mono text-sm font-bold text-gray-800">{obj.serialNumber}</p>
                            <p className="text-xs text-gray-600">{obj.model || obj.manufacturer || '-'}</p>
                            {obj.status && <p className="text-xs text-gray-500">• {obj.status}</p>}
                        </div>
                    );
                }

                // Handle old/new changes
                if (obj.old !== undefined && obj.new !== undefined) {
                    return (
                        <div className="flex items-center gap-2">
                            <span className="text-red-500 line-through text-sm">{String(obj.old)}</span>
                            <span className="text-gray-400">→</span>
                            <span className="text-green-600 font-medium text-sm">{String(obj.new)}</span>
                        </div>
                    );
                }

                // Generic object rendering - hide long IDs, show important fields
                const entries = Object.entries(obj).filter(([key]) => {
                    // Hide these fields (too technical/long/redundant)
                    const skipFields = [
                        'id', 'createdAt', 'updatedAt', 'userId', 'timestamp',
                        'customer', 'machine', 'incomingMachine', 'outgoingMachine', // Already shown in special cards
                        'client_name', 'bkcode', 'serialNumber', 'model', 'manufacturer', 'address' // Shown in nested renders
                    ];
                    return !skipFields.includes(key) && !key.endsWith('Id');
                });

                // If no important fields left, just show a simple message
                if (entries.length === 0) {
                    return <span className="text-gray-600 text-sm italic">تم تنفيذ العملية</span>;
                }

                return (
                    <div className="space-y-1">
                        {entries.map(([key, value]) => (
                            <div key={key} className="flex gap-2 items-start">
                                <span className="font-semibold text-gray-600 text-xs min-w-[80px]">{translateField(key)}:</span>
                                {typeof value === 'object' && value !== null ? (
                                    <div className="flex-1">{renderObject(value, depth + 1)}</div>
                                ) : (
                                    <span className="text-gray-800 text-sm flex-1">{String(value)}</span>
                                )}
                            </div>
                        ))}
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

            return <span className="text-gray-700 text-sm">{translatedText}</span>;
        }
    };

    const translateAction = (action: string): string => {
        const translations: { [key: string]: string } = {
            'CREATE': 'إنشاء',
            'UPDATE': 'تحديث',
            'DELETE': 'حذف',
            'MACHINE_RECEIVED': 'استلام ماكينة',
            'MACHINE_RETURN': 'إرجاع ماكينة',
            'EXCHANGE_OUT': 'ماكينة مستبدلة خرجت',
            'EXCHANGE_IN': 'ماكينة مستبدلة دخلت',
            'RETURN_FROM_CLIENT': 'إرجاع من عميل',
            'SELL': 'بيع',
            'IMPORT': 'استيراد',
            'STATUS_CHANGE': 'تغيير حالة',
            'DUPLICATE_CLEANUP': 'تنظيف مكررات',
            'ASSIGN': 'تخصيص شريحة',
            'RETURN': 'إرجاع شريحة'
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
            'performedBy': 'تم بواسطة',
            'action': 'الإجراء',
            'cost': 'التكلفة',
            'technicianId': 'رقم الفني',
            'technician': 'الفني',
            'requestId': 'رقم الطلب',
            'paymentMethod': 'طريقة الدفع',
            'amount': 'المبلغ',
            'date': 'التاريخ'
        };
        return translations[field] || field;
    };

    const getActionColor = (action: string) => {
        if (action.includes('CREATE')) return 'bg-green-100 text-green-800';
        if (action.includes('DELETE')) return 'bg-red-100 text-red-800';
        if (action.includes('UPDATE')) return 'bg-blue-100 text-blue-800';
        return 'bg-gray-100 text-gray-800';
    };

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent side="left" className="w-full sm:max-w-xl overflow-y-auto" dir="rtl">
                <SheetHeader className="border-b pb-4">
                    <div className="flex items-center gap-2 text-indigo-900">
                        <div className="p-2 bg-indigo-100 rounded-lg">
                            <FaHistory className="text-indigo-600 text-xl" />
                        </div>
                        <div>
                            <SheetTitle>سجل الحركات {title ? `- ${title}` : ''}</SheetTitle>
                            <SheetDescription>تتبع التغييرات والإجراءات السابقة</SheetDescription>
                        </div>
                    </div>
                </SheetHeader>

                {/* Content */}
                <div className="overflow-y-auto py-4 flex-1">
                    {loading ? (
                        <div className="flex justify-center items-center py-10">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="text-center py-10 text-gray-400">
                            <FaInfoCircle className="mx-auto text-3xl mb-2 opacity-50" />
                            <p>لا توجد سجلات متاحة</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {logs.map((log) => (
                                <div key={log.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative overflow-hidden group">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${getActionColor(log.action)}`}>
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
                                                            <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-mono font-bold border border-indigo-200">
                                                                {isSim ? '💳' : '📱'} {machineSerial}
                                                            </span>
                                                        );
                                                    }
                                                } catch (e) { }
                                                return null;
                                            })()}
                                            <span className="text-xs text-gray-400 flex items-center gap-1">
                                                <FaCalendarAlt className="text-[10px]" />
                                                {new Date(log.createdAt).toLocaleString('ar-EG')}
                                            </span>
                                        </div>
                                        <div className="text-xs font-semibold text-gray-600 flex items-center gap-1 bg-gray-50 px-2 py-1 rounded">
                                            <FaUser className="text-indigo-400" />
                                            {log.performedBy || 'System'}
                                        </div>
                                    </div>

                                    <div className="mt-2 pr-2 border-l-2 border-indigo-100 pl-2">
                                        {formatDetails(log.details)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t pt-4">
                    <Button onClick={onClose} variant="outline" className="w-full">
                        إغلاق
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
    );
};

export default AuditLogModal;
