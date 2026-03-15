"use client";

import React, { useState, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useApiMutation } from '../hooks/useApiMutation';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle
} from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Alert, AlertDescription } from '../components/ui/alert';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '../components/ui/table';
import {
    ArrowRight,
    Clock,
    AlertTriangle,
    FileText,
    Package,
    Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';

// Components
import MachineInfoCard from '../components/maintenance/MachineInfoCard';
import ActivityLog from '../components/maintenance/ActivityLog';
import MaintenanceCostCard from '../components/maintenance/MaintenanceCostCard';
import InspectionForm from '../components/maintenance/InspectionForm';
import RepairFormUI from '../components/maintenance/RepairFormUI';
import ReturnFormUI from '../components/maintenance/ReturnFormUI';
import ApprovalStatusCard from '../components/maintenance/ApprovalStatusCard';

// Types & Config
import type { MaintenanceDetail } from '../components/maintenance/MaintenanceTypes';
import { statusConfig } from '../components/maintenance/MaintenanceTypes';

const MaintenanceMachineDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const queryClient = useQueryClient();

    const [activeTab, setActiveTab] = useState<string>(() => {
        const action = searchParams.get('action');
        const tab = searchParams.get('tab');
        if (action === 'inspect' || action === 'repair') return 'actions';
        if (tab) return tab;
        return 'details';
    });

    // Forms State
    const [inspectionForm, setInspectionForm] = useState({
        problemDescription: '',
        estimatedCost: '',
        notes: '',
        selectedParts: [] as { partId: string; partName: string; quantity: number; cost: number; isPaid: boolean }[]
    });

    const [repairForm, setRepairForm] = useState({
        finalCost: '',
        voucherNumber: '',
        notes: ''
    });

    const [returnForm, setReturnForm] = useState({
        waybillNumber: '',
        returnNotes: ''
    });

    // Queries
    const { data: machine, isLoading, refetch } = useQuery<any>({
        queryKey: ['maintenance-machine', id],
        queryFn: () => api.getMaintenanceCenterMachine(id!),
        enabled: !!id
    });

    const { data: technicians } = useQuery({
        queryKey: ['technicians'],
        queryFn: () => api.getTechnicians(),
    });

    const { data: inventoryParts } = useQuery({
        queryKey: ['maintenance-inventory-parts'],
        queryFn: () => api.getMaintenanceCenterInventory(),
    });

    // Mutations
    const assignMutation = useApiMutation({
        mutationFn: (data: { technicianId: string }) => api.assignMaintenanceTechnician(id!, data),
        onSuccess: () => {
            toast.success('تم تعيين الفني بنجاح');
            refetch();
        }
    });

    const inspectMutation = useApiMutation({
        mutationFn: (data: any) => api.inspectMaintenanceMachine(id!, data),
        onSuccess: () => {
            toast.success('تم توثيق الفحص بنجاح');
            refetch();
        }
    });

    const startRepairMutation = useApiMutation({
        mutationFn: (data: any) => api.startMaintenanceRepair(id!, data),
        onSuccess: () => {
            toast.success('تم بدء عملية الإصلاح');
            refetch();
        }
    });

    const requestApprovalMutation = useApiMutation({
        mutationFn: (data: any) => api.requestMaintenanceApproval(id!, data),
        onSuccess: () => {
            toast.success('تم إرسال طلب الموافقة للفرع');
            refetch();
        }
    });

    const markRepairedMutation = useApiMutation({
        mutationFn: (data: any) => api.markMachineRepaired(id!, data),
        onSuccess: () => {
            toast.success('تم إكمال الإصلاح بنجاح');
            refetch();
        }
    });

    const markTotalLossMutation = useApiMutation({
        mutationFn: (data: any) => api.markMachineTotalLoss(id!, data),
        onSuccess: () => {
            toast.success('تم تعليم الماكينة كخسارة كلية');
            refetch();
        }
    });

    const returnMutation = useApiMutation({
        mutationFn: (data: any) => api.returnMachineToOrigin(id!, data),
        onSuccess: () => {
            toast.success('تمت جدولة الماكينة للإرجاع');
            navigate('/maintenance-center');
        }
    });

    // Handlers
    const handlePartSelect = (partId: string) => {
        const part = inventoryParts?.find((p: any) => p.partId === partId);
        if (!part) return;

        setInspectionForm(prev => {
            const exists = prev.selectedParts.find(p => p.partId === partId);
            if (exists) {
                return {
                    ...prev,
                    selectedParts: prev.selectedParts.filter(p => p.partId !== partId)
                };
            }
            return {
                ...prev,
                selectedParts: [...prev.selectedParts, {
                    partId,
                    partName: part.part?.name || part.name,
                    quantity: 1,
                    cost: part.price || 0,
                    isPaid: true
                }]
            };
        });
    };

    const togglePartPaid = (partId: string) => {
        setInspectionForm(prev => ({
            ...prev,
            selectedParts: prev.selectedParts.map(p =>
                p.partId === partId ? { ...p, isPaid: !p.isPaid } : p
            )
        }));
    };

    const updatePartQuantity = (partId: string, quantity: number) => {
        setInspectionForm(prev => ({
            ...prev,
            selectedParts: prev.selectedParts.map(p =>
                p.partId === partId ? { ...p, quantity } : p
            )
        }));
    };

    const totalPartsCost = useMemo(() => {
        return inspectionForm.selectedParts
            .filter(p => p.isPaid)
            .reduce((sum, p) => sum + (p.cost * p.quantity), 0);
    }, [inspectionForm.selectedParts]);

    const handleStartRepair = (type: 'FREE' | 'PAID') => {
        const finalParts = type === 'FREE'
            ? inspectionForm.selectedParts.map(p => ({ ...p, isPaid: false }))
            : inspectionForm.selectedParts;

        const finalCost = type === 'FREE' ? 0 : totalPartsCost;

        startRepairMutation.mutate({
            ...inspectionForm,
            repairType: type === 'PAID' ? 'PAID_WITH_PARTS' : 'FREE_WITH_PARTS',
            parts: finalParts,
            cost: finalCost
        });
    };

    if (isLoading) {
        return (
            <div className="p-6 space-y-6" dir="rtl">
                <div className="text-center py-12">
                    <Loader2 className="animate-spin mx-auto mb-4" size={32} />
                    <p className="text-muted-foreground">جاري تحميل البيانات...</p>
                </div>
            </div>
        );
    }

    if (!machine) {
        return (
            <div className="p-6 space-y-6" dir="rtl">
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>الماكينة غير موجودة</AlertDescription>
                </Alert>
            </div>
        );
    }

    const currentStatus = statusConfig[machine.status] || {
        label: machine.status,
        color: 'bg-gray-100',
        icon: <Package size={16} />
    };

    return (
        <div className="p-6 space-y-6" dir="rtl">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" onClick={() => navigate('/maintenance-center')}>
                        <ArrowRight className="ml-2" size={16} />
                        عودة
                    </Button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-black text-foreground">تفاصيل الماكينة</h1>
                            <Badge variant="outline" className={`${currentStatus.color} flex items-center gap-1`}>
                                {currentStatus.icon}
                                {currentStatus.label}
                            </Badge>
                        </div>
                        <p className="text-muted-foreground text-sm">رقم السريال: {machine.serialNumber}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm">
                        <Clock className="ml-2" size={16} />
                        {machine.daysAtCenter || 0} يوم في المركز
                    </Button>
                </div>
            </div>

            <MachineInfoCard
                machine={machine}
                technicians={technicians || []}
                onAssignTechnician={(techId) => assignMutation.mutate({ technicianId: techId })}
            />

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList className="grid w-full grid-cols-4 lg:w-[400px]">
                    <TabsTrigger value="details">التفاصيل</TabsTrigger>
                    <TabsTrigger value="actions">الإجراءات</TabsTrigger>
                    <TabsTrigger value="approval">الموافقة</TabsTrigger>
                    <TabsTrigger value="history">السجل</TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <FileText size={18} />
                                وصف المشكلة
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label>شكوى العميل</Label>
                                <p className="mt-1 p-3 bg-muted rounded-lg">{machine.customerComplaint || 'غير محدد'}</p>
                            </div>
                            <div>
                                <Label>وصف المشكلة من الفرع</Label>
                                <p className="mt-1 p-3 bg-muted rounded-lg">{machine.problemDescription || 'غير محدد'}</p>
                            </div>
                        </CardContent>
                    </Card>

                    {machine.parts && machine.parts.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Package size={18} />
                                    القطع المستخدمة
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>القطعة</TableHead>
                                            <TableHead>الكمية</TableHead>
                                            <TableHead>التكلفة</TableHead>
                                            <TableHead>الإجمالي</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {machine.parts.map((part: any) => (
                                            <TableRow key={part.id}>
                                                <TableCell>{part.partName}</TableCell>
                                                <TableCell>{part.quantity}</TableCell>
                                                <TableCell>{part.cost} ج.م</TableCell>
                                                <TableCell>{part.cost * part.quantity} ج.م</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    )}

                    <MaintenanceCostCard
                        estimatedCost={machine.estimatedCost}
                        finalCost={machine.finalCost}
                    />
                </TabsContent>

                <TabsContent value="actions" className="space-y-4">
                    {machine.status === 'UNDER_INSPECTION' && (
                        <InspectionForm
                            form={inspectionForm}
                            setForm={setInspectionForm}
                            inventoryParts={inventoryParts || []}
                            onPartSelect={handlePartSelect}
                            onUpdatePartQuantity={updatePartQuantity}
                            onTogglePartPaid={togglePartPaid}
                            onStartRepair={handleStartRepair}
                            onRequestApproval={() => requestApprovalMutation.mutate({ ...inspectionForm, cost: totalPartsCost })}
                            onMarkTotalLoss={() => markTotalLossMutation.mutate({ notes: inspectionForm.notes })}
                            totalPartsCost={totalPartsCost}
                            isPending={startRepairMutation.isPending || requestApprovalMutation.isPending}
                        />
                    )}

                    {machine.status === 'REPAIRING' && (
                        <RepairFormUI
                            form={repairForm}
                            setForm={setRepairForm}
                            onMarkRepaired={() => markRepairedMutation.mutate(repairForm)}
                            isPending={markRepairedMutation.isPending}
                            estimatedCost={machine.estimatedCost}
                        />
                    )}

                    {machine.status === 'REPAIRED' && (
                        <ReturnFormUI
                            form={returnForm}
                            setForm={setReturnForm}
                            onReturn={() => returnMutation.mutate(returnForm)}
                            isPending={returnMutation.isPending}
                            branchName={machine.originBranch?.name}
                        />
                    )}

                    {!['UNDER_INSPECTION', 'REPAIRING', 'REPAIRED', 'TOTAL_LOSS'].includes(machine.status) && (
                        <Alert>
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription>
                                لا توجد إجراءات متاحة للحالة الحالية ({currentStatus.label})
                            </AlertDescription>
                        </Alert>
                    )}
                </TabsContent>

                <TabsContent value="approval" className="space-y-4">
                    <ApprovalStatusCard
                        approvalRequest={machine.approvalRequest}
                        machineStatus={machine.status}
                    />
                </TabsContent>

                <TabsContent value="history" className="space-y-4">
                    <ActivityLog logs={machine.history || machine.logs || []} />
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default MaintenanceMachineDetailPage;
