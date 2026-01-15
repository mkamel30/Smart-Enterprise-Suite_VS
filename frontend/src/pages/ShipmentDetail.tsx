import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
// Using lucide-react instead of heroicons
import { ArrowLeft, Box, Wrench, AlertTriangle, CheckCircle } from 'lucide-react';
import ProcessingModal from '../components/ProcessingModal';

const ShipmentDetail: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [selectedMachine, setSelectedMachine] = useState<any>(null);
    const [isProcessingModalOpen, setIsProcessingModalOpen] = useState(false);

    const { data: shipment, isLoading } = useQuery({
        queryKey: ['shipment', id],
        queryFn: async () => {
            const res = await api.get('/maintenance/shipments');
            return (res as any[]).find(s => s.id === id);
        }
    });

    const receiveMutation = useMutation({
        mutationFn: async () => {
            await api.post(`/maintenance/shipments/${id}/receive`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['shipment', id] });
            queryClient.invalidateQueries({ queryKey: ['maintenance-shipments'] });
        }
    });

    const handleInspect = async (serial: string) => {
        await api.post(`/maintenance/machine/${serial}/transition`, { action: 'INSPECT', data: {} });
        queryClient.invalidateQueries({ queryKey: ['shipment', id] });
    };

    const handleStartWork = async (serial: string) => {
        // نفس حركة البدء من لوحة الكانبان: نعتبره فحص مبدئي وينقل لـ UNDER_INSPECTION
        await api.post(`/maintenance/machine/${serial}/transition`, { action: 'INSPECT', data: {} });
        queryClient.invalidateQueries({ queryKey: ['shipment', id] });
    };

    if (isLoading) return <div className="p-8 text-center">جار التحميل...</div>;
    if (!shipment) return <div className="p-8 text-center text-red-500">الشحنة غير موجودة</div>;

    const isPending = shipment.status === 'PENDING';

    return (
        <div className="p-6 space-y-6" dir="rtl">
            {/* Header */}
            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <Button variant="ghost" size="sm" onClick={() => navigate('/maintenance/shipments')} className="mb-2 text-gray-500">
                            <ArrowLeft className="w-4 h-4 ml-1" />
                            العودة للقائمة
                        </Button>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            شحنة رقم: <span className="text-primary" dir="ltr">{shipment.orderNumber}</span>
                        </h1>
                        <p className="text-gray-500 mt-1">القادمة من: <span className="font-medium text-black">{shipment.fromBranch.name}</span></p>
                    </div>
                </div>

                {isPending ? (
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Box className="w-6 h-6 text-primary" />
                            <div>
                                <h3 className="font-bold text-blue-900">تأكيد الاستلام</h3>
                                <p className="text-blue-700 text-sm">يرجى تأكيد استلام الشحنة لتمكين الفنيين من العمل عليها</p>
                            </div>
                        </div>
                        <Button
                            onClick={() => receiveMutation.mutate()}
                            variant="default" // primary -> default
                            disabled={receiveMutation.isPending}
                        >
                            {receiveMutation.isPending ? 'جار التأكيد...' : 'تأكيد استلام الشحنة'}
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm font-medium">
                            <span>تقدم العمل في الشحنة</span>
                            <span>{shipment.progress}%</span>
                        </div>
                        <Progress value={shipment.progress} className="h-3" />
                    </div>
                )}
            </div>

            {/* Machines List */}
            <div className="space-y-4">
                {shipment.items.map((item: any) => {
                    const statusInfo = shipment.machineStatuses?.find((m: any) => m.serialNumber === item.serialNumber);
                    const currentStatus = statusInfo?.status || 'UNKNOWN';

                    const isAssigned = currentStatus === 'ASSIGNED';
                    const isInspection = currentStatus === 'RECEIVED_AT_CENTER';
                    const isUnderWork = currentStatus === 'UNDER_INSPECTION' || currentStatus === 'AWAITING_APPROVAL';
                    const isCompleted = ['REPAIRED', 'SCRAPPED', 'RETURNED_AS_IS', 'READY_FOR_DELIVERY'].includes(currentStatus);

                    // Map status to badge variant (default, secondary, destructive, outline)
                    let badgeVariant: "default" | "secondary" | "destructive" | "outline" = "default";
                    if (isCompleted) badgeVariant = "default"; // green-ish usually? default is primary.
                    else if (isUnderWork) badgeVariant = "secondary";
                    else if (currentStatus === 'UNKNOWN') badgeVariant = "outline";

                    return (
                        <div key={item.serialNumber} className="bg-white p-4 rounded-lg border border-gray-200 flex justify-between items-center">
                            <div className="flex items-center gap-4">
                                <div className="bg-gray-100 p-3 rounded-md">
                                    <Box className="w-6 h-6 text-gray-600" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-bold text-lg" dir="ltr">{item.serialNumber}</h3>
                                        <Badge variant={badgeVariant}>
                                            {
                                                currentStatus === 'ASSIGNED' ? 'مُعين' :
                                                    currentStatus === 'RECEIVED_AT_CENTER' ? 'تم الاستلام' :
                                                        currentStatus === 'UNDER_INSPECTION' ? 'تحت الفحص' :
                                                            currentStatus === 'AWAITING_APPROVAL' ? 'بانتظار الموافقة' :
                                                                currentStatus === 'IN_MAINTENANCE' ? 'قيد الصيانة' :
                                                                    currentStatus === 'REPAIRED' ? 'تم الإصلاح' :
                                                                        currentStatus
                                            }
                                        </Badge>
                                    </div>
                                    <p className="text-sm text-gray-500">{item.manufacturer} - {item.model}</p>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                {/* Actions based on Status */}
                                {!isPending && (
                                    <>
                                        {isAssigned && (
                                            <Button size="sm" variant="default" onClick={() => handleStartWork(item.serialNumber)}>
                                                <AlertTriangle className="w-4 h-4 ml-1" />
                                                بدء العمل
                                            </Button>
                                        )}

                                        {isInspection && (
                                            <Button size="sm" variant="outline" onClick={() => handleInspect(item.serialNumber)}>
                                                <AlertTriangle className="w-4 h-4 ml-1" />
                                                بدء الفحص
                                            </Button>
                                        )}

                                        {(currentStatus === 'IN_MAINTENANCE' || currentStatus === 'UNDER_INSPECTION' || currentStatus === 'AWAITING_APPROVAL' || currentStatus === 'REPAIR_APPROVED' || currentStatus === 'REPAIRED') && (
                                            <Button
                                                size="sm"
                                                variant={isCompleted ? 'ghost' : 'default'} // primary -> default
                                                onClick={() => {
                                                    setSelectedMachine(item.serialNumber);
                                                    setIsProcessingModalOpen(true);
                                                }}
                                                disabled={currentStatus === 'AWAITING_APPROVAL'}
                                            >
                                                <Wrench className="w-4 h-4 ml-1" />
                                                {isCompleted ? 'عرض التفاصيل' : currentStatus === 'AWAITING_APPROVAL' ? 'طلب موافقة (مرسل)' : 'إجراء / صيانة'}
                                            </Button>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Modal */}
            {isProcessingModalOpen && selectedMachine && (
                <ProcessingModal
                    isOpen={isProcessingModalOpen}
                    onClose={() => setIsProcessingModalOpen(false)}
                    serialNumber={selectedMachine}
                    onSuccess={() => {
                        queryClient.invalidateQueries({ queryKey: ['shipment', id] });
                        setIsProcessingModalOpen(false);
                    }}
                />
            )}
        </div>
    );
};

export default ShipmentDetail;
