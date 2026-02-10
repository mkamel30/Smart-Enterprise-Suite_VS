import { useState } from 'react';
import { api } from '../api/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Wrench, Package, Truck, FileText, RotateCcw, CheckCircle, Monitor } from 'lucide-react';

interface MachineDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    serialNumber: string;
    shipmentId: string;
}

export default function MachineDetailsModal({ isOpen, onClose, serialNumber, shipmentId }: MachineDetailsModalProps) {
    const queryClient = useQueryClient();
    const [showReturnConfirm, setShowReturnConfirm] = useState(false);
    const [driverName, setDriverName] = useState('');
    const [driverPhone, setDriverPhone] = useState('');
    const [returnNotes, setReturnNotes] = useState('');
    const [createdOrder, setCreatedOrder] = useState<any>(null);
    const [showShippingDoc, setShowShippingDoc] = useState(false);

    // Fetch machine details from maintenance center
    const { data: machine, isLoading } = useQuery({
        queryKey: ['machine-details', serialNumber],
        queryFn: async () => {
            const res = await api.get(`/maintenance-center/machines/by-serial/${serialNumber}`);
            return res.data;
        },
        enabled: isOpen
    });

    // Fetch movement logs
    const { data: logs } = useQuery({
        queryKey: ['machine-logs', serialNumber],
        queryFn: async () => {
            try {
                const res = await api.get(`/machines/${serialNumber}/history`);
                return res || [];
            } catch (e) {
                return [];
            }
        },
        enabled: !!serialNumber
    });

    // Return to branch mutation
    const returnMutation = useMutation({
        mutationFn: async () => {
            const res = await api.post('/maintenance-center/return/create', {
                machineIds: [machine?.id],
                driverName,
                driverPhone,
                notes: returnNotes
            });
            return res.data;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['shipment', shipmentId] });
            queryClient.invalidateQueries({ queryKey: ['machine-details', serialNumber] });
            if (data?.data?.orders?.[0]) {
                setCreatedOrder(data.data.orders[0]);
                setShowShippingDoc(true);
            }
            setShowReturnConfirm(false);
        }
    });

    if (isLoading) {
        return (
            <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
                <DialogContent dir="rtl">
                    <div className="text-center py-8">جاري التحميل...</div>
                </DialogContent>
            </Dialog>
        );
    }

    if (!machine) {
        return (
            <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
                <DialogContent dir="rtl">
                    <div className="text-center py-8 text-red-500">
                        لم يتم العثور على الماكينة في المخزن
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={onClose}>إغلاق</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    }

    const usedParts = (() => {
        try {
            return machine?.usedParts ? JSON.parse(machine.usedParts) : [];
        } catch (e) {
            return [];
        }
    })();
    const totalCost = machine?.totalCost || 0;
    const isRepaired = machine?.status === 'REPAIRED' || machine?.status === 'REPAIR' || machine?.resolution === 'REPAIRED';
    const isReturned = machine?.status === 'IN_RETURN_TRANSIT' || machine?.status === 'RETURNED' || machine?.status === 'DELIVERED_TO_CLIENT';

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <FileText className="w-6 h-6 text-blue-600" />
                        تقرير الماكينة: {serialNumber}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Status Badge */}
                    <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                        <span className="text-sm text-gray-600">الحالة الحالية:</span>
                        <Badge className={
                            isRepaired ? 'bg-green-100 text-green-700' :
                            isReturned ? 'bg-blue-100 text-blue-700' :
                            'bg-yellow-100 text-yellow-700'
                        }>
                            {isRepaired ? 'تم الإصلاح' : isReturned ? 'تم الإرجاع للفرع' : machine?.status}
                        </Badge>
                    </div>

                    {/* Parts Used Section */}
                    <div className="border rounded-lg p-4">
                        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                            <Package className="w-5 h-5 text-orange-600" />
                            قطع الغيار المستخدمة
                        </h3>
                        
                        {usedParts.length > 0 ? (
                            <div className="space-y-2">
                                <table className="w-full">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="text-right p-2 text-sm">القطعة</th>
                                            <th className="text-center p-2 text-sm">الكمية</th>
                                            <th className="text-left p-2 text-sm">التكلفة</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {usedParts.map((part: any, idx: number) => (
                                            <tr key={idx} className="border-b">
                                                <td className="p-2">{part.name}</td>
                                                <td className="p-2 text-center">{part.quantity}</td>
                                                <td className="p-2 text-left">{part.cost?.toLocaleString()} ج.م</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <div className="flex justify-between items-center pt-4 border-t">
                                    <span className="font-bold">إجمالي التكلفة:</span>
                                    <span className="text-xl font-bold text-green-700">{totalCost.toLocaleString()} ج.م</span>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-4 text-gray-500">
                                لا توجد قطع غيار مسجلة
                            </div>
                        )}
                    </div>

                    {/* Cost Summary */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                            <FileText className="w-5 h-5 text-blue-600" />
                            ملخص التكاليف
                        </h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span>تكلفة قطع الغيار:</span>
                                <span>{usedParts.reduce((sum: number, p: any) => sum + (p.cost * p.quantity), 0).toLocaleString()} ج.م</span>
                            </div>
                            <div className="flex justify-between">
                                <span>أجر الصيانة:</span>
                                <span>{(totalCost - usedParts.reduce((sum: number, p: any) => sum + (p.cost * p.quantity), 0)).toLocaleString()} ج.م</span>
                            </div>
                            <div className="flex justify-between pt-2 border-t border-blue-200">
                                <span className="font-bold">الإجمالي المستحق من الفرع:</span>
                                <span className="text-lg font-bold text-blue-700">{totalCost.toLocaleString()} ج.م</span>
                            </div>
                        </div>
                    </div>

                    {/* Activity Log */}
                    <div className="border rounded-lg p-4">
                        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                            <RotateCcw className="w-5 h-5 text-gray-600" />
                            سجل الحركات
                        </h3>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                            {logs?.map((log: any, idx: number) => (
                                <div key={idx} className="flex items-start gap-3 p-2 bg-gray-50 rounded">
                                    <div className="w-2 h-2 rounded-full bg-blue-500 mt-2"></div>
                                    <div className="flex-1">
                                        <div className="font-medium text-sm">{log.action}</div>
                                        <div className="text-xs text-gray-500">{new Date(log.createdAt).toLocaleString('ar-EG')}</div>
                                        {log.details && (
                                            <div className="text-xs text-gray-600 mt-1">{JSON.stringify(log.details)}</div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Return to Branch Section */}
                    {isRepaired && !isReturned && (
                        <div className="border-2 border-orange-200 rounded-lg p-4 bg-orange-50">
                            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                                <Truck className="w-5 h-5 text-orange-600" />
                                إرجاع للفرع
                            </h3>
                            
                            {!showReturnConfirm ? (
                                <Button 
                                    onClick={() => setShowReturnConfirm(true)}
                                    className="w-full bg-orange-600 hover:bg-orange-700"
                                >
                                    <Truck className="w-4 h-4 ml-2" />
                                    إنشاء طرد إرجاع للفرع
                                </Button>
                            ) : (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">اسم السائق</label>
                                        <input
                                            type="text"
                                            value={driverName}
                                            onChange={(e) => setDriverName(e.target.value)}
                                            className="w-full border rounded-lg p-2"
                                            placeholder="اسم السائق..."
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">هاتف السائق</label>
                                        <input
                                            type="text"
                                            value={driverPhone}
                                            onChange={(e) => setDriverPhone(e.target.value)}
                                            className="w-full border rounded-lg p-2"
                                            placeholder="رقم الهاتف..."
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">ملاحظات</label>
                                        <textarea
                                            value={returnNotes}
                                            onChange={(e) => setReturnNotes(e.target.value)}
                                            className="w-full border rounded-lg p-2"
                                            rows={2}
                                            placeholder="ملاحظات الإرجاع..."
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <Button 
                                            variant="outline" 
                                            onClick={() => setShowReturnConfirm(false)}
                                            className="flex-1"
                                        >
                                            إلغاء
                                        </Button>
                                        <Button 
                                            onClick={() => returnMutation.mutate()}
                                            disabled={returnMutation.isPending || !driverName}
                                            className="flex-1 bg-orange-600 hover:bg-orange-700"
                                        >
                                            {returnMutation.isPending ? 'جاري...' : 'تأكيد الإرجاع'}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {showShippingDoc && createdOrder && (
                        <div className="bg-white border-2 border-green-200 rounded-lg p-6">
                            <div className="text-center border-b-2 border-green-600 pb-4 mb-4">
                                <h2 className="text-xl font-bold text-green-800">بوليصة شحن - إرجاع من الصيانة</h2>
                                <p className="text-gray-600 mt-1">رقم الإذن: <span className="font-mono font-bold">{createdOrder.orderNumber || 'تم الإنشاء'}</span></p>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div className="bg-gray-50 p-3 rounded-lg">
                                    <p className="text-sm text-gray-500">اسم السائق</p>
                                    <p className="font-medium">{createdOrder.driverName || '-'}</p>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-lg">
                                    <p className="text-sm text-gray-500">هاتف السائق</p>
                                    <p className="font-medium">{createdOrder.driverPhone || '-'}</p>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-lg">
                                    <p className="text-sm text-gray-500">المركز</p>
                                    <p className="font-medium">مركز الصيانة الرئيسي</p>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-lg">
                                    <p className="text-sm text-gray-500">الوجهة</p>
                                    <p className="font-medium">{machine?.originBranch?.name || machine?.branchName || '-'}</p>
                                </div>
                            </div>
                            
                            <div className="border-t pt-4 mb-4">
                                <p className="font-bold mb-2 flex items-center gap-2">
                                    <Monitor className="w-4 h-4 text-blue-600" />
                                    الماكينات المرسلة:
                                </p>
                                <div className="bg-blue-50 border border-blue-200 rounded-lg overflow-hidden">
                                    <table className="w-full">
                                        <thead className="bg-blue-100">
                                            <tr>
                                                <th className="text-right px-3 py-2 text-sm">السيريال</th>
                                                <th className="text-right px-3 py-2 text-sm">النوع</th>
                                                <th className="text-right px-3 py-2 text-sm">الموديل</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr className="border-t border-blue-200">
                                                <td className="px-3 py-2 font-mono">{serialNumber}</td>
                                                <td className="px-3 py-2">{machine?.type || '-'}</td>
                                                <td className="px-3 py-2">{machine?.model || '-'}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            
                            {usedParts.length > 0 && (
                                <div className="border-t pt-4 mb-4">
                                    <p className="font-bold mb-2 flex items-center gap-2">
                                        <Package className="w-4 h-4 text-orange-600" />
                                        قطع الغيار المستخدمة:
                                    </p>
                                    <div className="bg-orange-50 border border-orange-200 rounded-lg overflow-hidden">
                                        <table className="w-full">
                                            <thead className="bg-orange-100">
                                                <tr>
                                                    <th className="text-right px-3 py-2 text-sm">القطعة</th>
                                                    <th className="text-center px-3 py-2 text-sm">الكمية</th>
                                                    <th className="text-left px-3 py-2 text-sm">التكلفة</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {usedParts.map((part: any, idx: number) => (
                                                    <tr key={idx} className="border-t border-orange-200">
                                                        <td className="px-3 py-2">{part.name}</td>
                                                        <td className="px-3 py-2 text-center">{part.quantity}</td>
                                                        <td className="px-3 py-2 text-left">{part.cost?.toLocaleString()} ج.م</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                            
                            <div className="border-t-2 border-green-600 pt-4">
                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-lg">إجمالي التكلفة:</span>
                                    <span className="text-2xl font-bold text-green-700">{totalCost.toLocaleString()} ج.م</span>
                                </div>
                            </div>
                            
                            {createdOrder.notes && (
                                <div className="border-t pt-4 mt-4">
                                    <p className="text-sm text-gray-500 mb-1">ملاحظات</p>
                                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-yellow-800">
                                        {createdOrder.notes}
                                    </div>
                                </div>
                            )}
                            
                            <div className="mt-4 pt-4 border-t flex gap-2 print:hidden">
                                <Button 
                                    onClick={() => window.print()} 
                                    className="flex-1 bg-green-600 hover:bg-green-700"
                                >
                                    <FileText className="w-4 h-4 ml-2" />
                                    طباعة بوليصة الشحن
                                </Button>
                                <Button 
                                    variant="outline"
                                    onClick={() => {
                                        setShowShippingDoc(false);
                                        setCreatedOrder(null);
                                    }}
                                    className="flex-1"
                                >
                                    إغلاق
                                </Button>
                            </div>
                            
                            <style>{`
                                @media print {
                                    .print\\:hidden { display: none !important; }
                                    body { 
                                        direction: rtl !important; 
                                        font-family: 'Tahoma', 'Arial', sans-serif !important;
                                    }
                                }
                            `}</style>
                        </div>
                    )}

                    {isReturned && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                            <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-2" />
                            <p className="font-bold text-green-800">تم إرجاع الماكينة للفرع</p>
                            <p className="text-sm text-green-600">الماكينة في طريقها للفرع أو تم استلامها</p>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>إغلاق</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
