"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useApiMutation } from '../hooks/useApiMutation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Alert, AlertDescription } from '../components/ui/alert';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../components/ui/select';
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
    Wrench,
    User,
    Building2,
    Clock,
    CheckCircle,
    XCircle,
    RotateCcw,
    Package,
    AlertTriangle,
    ClipboardCheck,
    Play,
    Eye,
    History,
    DollarSign,
    FileText,
    Truck,
    Save,
    Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import toast from 'react-hot-toast';

// Types
interface MaintenanceMachineDetail {
    id: string;
    serialNumber: string;
    model: string;
    manufacturer: string;
    status: 'NEW' | 'UNDER_INSPECTION' | 'REPAIRING' | 'WAITING_APPROVAL' | 'REPAIRED' | 'TOTAL_LOSS';
    problemDescription: string;
    customerComplaint: string;
    assignedTechnician: {
        id: string;
        name: string;
    } | null;
    originBranch: {
        id: string;
        name: string;
        code: string;
    };
    customer: {
        id: string;
        name: string;
        code: string;
    };
    receivedAt: string;
    estimatedCost: number | null;
    finalCost: number | null;
    approvalRequest: {
        id: string;
        status: 'PENDING' | 'APPROVED' | 'REJECTED';
        cost: number;
        reason: string;
        responseNotes: string | null;
        requestedAt: string;
        respondedAt: string | null;
    } | null;
    parts: Array<{
        id: string;
        partId: string;
        partName: string;
        quantity: number;
        cost: number;
    }>;
    repairVoucher: {
        number: string;
        createdAt: string;
    } | null;
    history: Array<{
        id: string;
        action: string;
        status: string;
        performedBy: string;
        performedAt: string;
        details: string | null;
    }>;
    daysAtCenter: number;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    NEW: { label: 'جديد', color: 'bg-gray-100 text-gray-700 border-gray-200', icon: <Package size={16} /> },
    UNDER_INSPECTION: { label: 'تحت الفحص', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: <ClipboardCheck size={16} /> },
    REPAIRING: { label: 'قيد الإصلاح', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: <Wrench size={16} /> },
    WAITING_APPROVAL: { label: 'بانتظار الموافقة', color: 'bg-orange-100 text-orange-700 border-orange-200', icon: <Clock size={16} /> },
    REPAIRED: { label: 'تم الإصلاح', color: 'bg-green-100 text-green-700 border-green-200', icon: <CheckCircle size={16} /> },
    TOTAL_LOSS: { label: 'خسارة كلية', color: 'bg-red-100 text-red-700 border-red-200', icon: <XCircle size={16} /> },
};

const approvalStatusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    PENDING: { label: 'معلق - بانتظار موافقة الفرع', color: 'bg-orange-100 text-orange-700 border-orange-200', icon: <Clock size={16} /> },
    APPROVED: { label: 'تمت الموافقة من الفرع', color: 'bg-green-100 text-green-700 border-green-200', icon: <CheckCircle size={16} /> },
    REJECTED: { label: 'مرفوض من الفرع', color: 'bg-red-100 text-red-700 border-red-200', icon: <XCircle size={16} /> },
};

const MaintenanceMachineDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { user } = useAuth();
    const queryClient = useQueryClient();
    
    const action = searchParams.get('action');
    const tabParam = searchParams.get('tab');
    
    // Determine initial tab based on action or tab param
    const getInitialTab = () => {
        if (tabParam) return tabParam;
        if (action) {
            // Actions that show the actions tab
            if (['assign', 'inspect', 'start-repair', 'request-approval', 'complete', 'return', 'total-loss', 'create-return'].includes(action)) {
                return 'actions';
            }
        }
        return 'details';
    };
    
    const [activeTab, setActiveTab] = useState(getInitialTab());

    // Fetch machine details
    const { data: machine, isLoading, refetch } = useQuery<MaintenanceMachineDetail>({
        queryKey: ['maintenance-machine-detail', id],
        queryFn: () => api.getMaintenanceCenterMachine(id!),
        enabled: !!id,
    });

    // Fetch technicians
    const { data: technicians } = useQuery({
        queryKey: ['technicians'],
        queryFn: () => api.getTechnicians(),
    });

    // Fetch inventory parts
    const { data: inventoryParts } = useQuery({
        queryKey: ['inventory'],
        queryFn: () => api.getInventory(),
    });

    // Form states for inspection
    const [inspectionForm, setInspectionForm] = useState({
        problemDescription: '',
        estimatedCost: '',
        selectedParts: [] as Array<{ partId: string; quantity: number; partName: string; cost: number }>,
        notes: ''
    });

    // Form states for repair completion
    const [repairForm, setRepairForm] = useState({
        finalCost: '',
        voucherNumber: '',
        notes: ''
    });

    // Form states for total loss
    const [totalLossForm, setTotalLossForm] = useState({
        reason: '',
        notes: ''
    });

    // Form states for return
    const [returnForm, setReturnForm] = useState({
        returnNotes: '',
        waybillNumber: ''
    });

    // Mutations
    const assignTechnicianMutation = useApiMutation({
        mutationFn: (data: { technicianId: string }) => 
            api.assignTechnicianToMachine(id!, data),
        successMessage: 'تم تعيين الفني بنجاح',
        invalidateKeys: [['maintenance-machine-detail', id], ['maintenance-center-machines']]
    });

    const inspectMutation = useApiMutation({
        mutationFn: (data: any) => api.inspectMachine(id!, data),
        successMessage: 'تم حفظ تقرير الفحص',
        invalidateKeys: [['maintenance-machine-detail', id], ['maintenance-center-machines']]
    });

    const startRepairMutation = useApiMutation({
        mutationFn: (data: any) => api.startRepair(id!, data),
        successMessage: 'تم بدء عملية الإصلاح',
        invalidateKeys: [['maintenance-machine-detail', id], ['maintenance-center-machines']]
    });

    const requestApprovalMutation = useApiMutation({
        mutationFn: (data: any) => api.requestRepairApproval(id!, data),
        successMessage: 'تم إرسال طلب الموافقة',
        invalidateKeys: [['maintenance-machine-detail', id], ['maintenance-center-machines'], ['maintenance-center-pending-approvals']]
    });

    const markRepairedMutation = useApiMutation({
        mutationFn: (data: any) => api.markMachineRepaired(id!, data),
        successMessage: 'تم تعليم الماكينة كمُصلحة',
        invalidateKeys: [['maintenance-machine-detail', id], ['maintenance-center-machines']]
    });

    const markTotalLossMutation = useApiMutation({
        mutationFn: (data: any) => api.markMachineTotalLoss(id!, data),
        successMessage: 'تم تعليم الماكينة كخسارة كلية',
        invalidateKeys: [['maintenance-machine-detail', id], ['maintenance-center-machines']]
    });

    const returnMutation = useApiMutation({
        mutationFn: (data: any) => api.returnMachineToBranch(id!, data),
        successMessage: 'تم إرجاع الماكينة للفرع',
        invalidateKeys: [['maintenance-machine-detail', id], ['maintenance-center-machines']],
        onSuccess: () => {
            setTimeout(() => navigate('/maintenance-center'), 1500);
        }
    });

    // Initialize forms when machine data loads
    useEffect(() => {
        if (machine) {
            setInspectionForm(prev => ({
                ...prev,
                problemDescription: machine.problemDescription || machine.customerComplaint || ''
            }));
        }
    }, [machine]);



    // Handle part selection
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
                    quantity: 1, 
                    partName: part.part?.name || part.name,
                    cost: part.part?.defaultCost || 0
                }]
            };
        });
    };

    // Update part quantity
    const updatePartQuantity = (partId: string, quantity: number) => {
        setInspectionForm(prev => ({
            ...prev,
            selectedParts: prev.selectedParts.map(p => 
                p.partId === partId ? { ...p, quantity: Math.max(1, quantity) } : p
            )
        }));
    };

    // Calculate total parts cost
    const totalPartsCost = inspectionForm.selectedParts.reduce((sum, p) => sum + (p.cost * p.quantity), 0);

    // Handle form submissions
    const handleAssignTechnician = (technicianId: string) => {
        const technician = technicians?.find((t: any) => t.id === technicianId);
        assignTechnicianMutation.mutate({ 
            technicianId,
            technicianName: technician?.displayName || technician?.name 
        });
    };

    const handleInspect = () => {
        inspectMutation.mutate({
            problemDescription: inspectionForm.problemDescription,
            estimatedCost: parseFloat(inspectionForm.estimatedCost) || 0,
            requiredParts: inspectionForm.selectedParts.map(p => ({ 
                partId: p.partId, 
                quantity: p.quantity 
            })),
            notes: inspectionForm.notes
        });
    };

    const handleStartRepair = (type: 'FREE' | 'PAID') => {
        startRepairMutation.mutate({
            repairType: type,
            problemDescription: inspectionForm.problemDescription,
            estimatedCost: parseFloat(inspectionForm.estimatedCost) || 0,
            requiredParts: inspectionForm.selectedParts.map(p => ({ 
                partId: p.partId, 
                quantity: p.quantity 
            })),
            notes: inspectionForm.notes
        });
    };

    const handleRequestApproval = () => {
        requestApprovalMutation.mutate({
            cost: parseFloat(inspectionForm.estimatedCost) || 0,
            parts: inspectionForm.selectedParts,
            reason: inspectionForm.problemDescription,
            notes: inspectionForm.notes
        });
    };

    const handleMarkRepaired = () => {
        markRepairedMutation.mutate({
            finalCost: parseFloat(repairForm.finalCost) || machine?.finalCost || 0,
            voucherNumber: repairForm.voucherNumber,
            notes: repairForm.notes
        });
    };

    const handleMarkTotalLoss = () => {
        markTotalLossMutation.mutate({
            reason: totalLossForm.reason,
            notes: totalLossForm.notes
        });
    };

    const handleReturn = () => {
        returnMutation.mutate({
            returnNotes: returnForm.returnNotes,
            waybillNumber: returnForm.waybillNumber
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

    const status = statusConfig[machine.status];

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
                            <Badge variant="outline" className={`${status.color} flex items-center gap-1`}>
                                {status.icon}
                                {status.label}
                            </Badge>
                        </div>
                        <p className="text-muted-foreground text-sm">رقم السريال: {machine.serialNumber}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => refetch()}>
                        <Clock className="ml-2" size={16} />
                        {machine.daysAtCenter} يوم في المركز
                    </Button>
                </div>
            </div>

            {/* Machine Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                            <Package size={16} />
                            <span className="text-sm">الموديل</span>
                        </div>
                        <p className="font-bold">{machine.model}</p>
                        <p className="text-xs text-muted-foreground">{machine.manufacturer}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                            <Building2 size={16} />
                            <span className="text-sm">الفرع الأصلي</span>
                        </div>
                        <p className="font-bold">{machine.originBranch?.name}</p>
                        <p className="text-xs text-muted-foreground">{machine.originBranch?.code}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                            <User size={16} />
                            <span className="text-sm">العميل</span>
                        </div>
                        <p className="font-bold">{machine.customer?.name}</p>
                        <p className="text-xs text-muted-foreground">{machine.customer?.code}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                            <Wrench size={16} />
                            <span className="text-sm">الفني المسؤول</span>
                        </div>
                        <p className="font-bold">{machine.assignedTechnician?.name || 'غير معين'}</p>
                        {machine.status === 'NEW' && (
                            <Select onValueChange={handleAssignTechnician}>
                                <SelectTrigger className="mt-2 h-8 text-xs">
                                    <SelectValue placeholder="تعيين فني..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {technicians?.map((tech: any) => (
                                        <SelectItem key={tech.id} value={tech.id}>
                                            {tech.displayName || tech.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Main Content Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList className="grid w-full grid-cols-4 lg:w-[400px]">
                    <TabsTrigger value="details">التفاصيل</TabsTrigger>
                    <TabsTrigger value="actions">الإجراءات</TabsTrigger>
                    <TabsTrigger value="approval">الموافقة</TabsTrigger>
                    <TabsTrigger value="history">السجل</TabsTrigger>
                </TabsList>

                {/* Details Tab */}
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

                    {/* Parts Used */}
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
                                        {machine.parts.map((part) => (
                                            <TableRow key={part.id}>
                                                <TableCell>{part.partName}</TableCell>
                                                <TableCell>{part.quantity}</TableCell>
                                                <TableCell>{part.cost} ج.م</TableCell>
                                                <TableCell>{part.cost * part.quantity} ج.م</TableCell>
                                            </TableRow>
                                        ))}
                                        <TableRow>
                                            <TableCell colSpan={3} className="font-bold">إجمالي قطع الغيار</TableCell>
                                            <TableCell className="font-bold">
                                                {machine.parts.reduce((sum, p) => sum + (p.cost * p.quantity), 0)} ج.م
                                            </TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    )}

                    {/* Cost Summary */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <DollarSign size={18} />
                                التكاليف
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-muted rounded-lg">
                                    <p className="text-sm text-muted-foreground">التكلفة المقدرة</p>
                                    <p className="text-2xl font-bold">{machine.estimatedCost || 0} ج.م</p>
                                </div>
                                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                                    <p className="text-sm text-green-600">التكلفة النهائية</p>
                                    <p className="text-2xl font-bold text-green-700">{machine.finalCost || 0} ج.م</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Actions Tab - Contextual based on status */}
                <TabsContent value="actions" className="space-y-4">
                    {/* UNDER INSPECTION Actions */}
                    {machine.status === 'UNDER_INSPECTION' && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <ClipboardCheck size={18} />
                                    نموذج الفحص والتقييم
                                </CardTitle>
                                <CardDescription>
                                    قم بتوثيق نتائج الفحص وتقدير التكلفة. اختر الإجراء المناسب - الموافقة يدوية بناءً على تقدير الفني وليس التكلفة
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <Label>وصف المشكلة التفصيلي</Label>
                                    <Textarea
                                        value={inspectionForm.problemDescription}
                                        onChange={(e) => setInspectionForm(prev => ({ ...prev, problemDescription: e.target.value }))}
                                        placeholder="وصف تفصيلي للمشكلة المكتشفة..."
                                        className="mt-1"
                                        rows={3}
                                    />
                                </div>

                                <div>
                                    <Label>التكلفة المقدرة (ج.م)</Label>
                                    <Input
                                        type="number"
                                        value={inspectionForm.estimatedCost}
                                        onChange={(e) => setInspectionForm(prev => ({ ...prev, estimatedCost: e.target.value }))}
                                        placeholder="0.00"
                                        className="mt-1"
                                    />

                                </div>

                                <div>
                                    <Label>قطع الغيار المطلوبة</Label>
                                    <div className="mt-2 border rounded-lg p-4 space-y-2">
                                        <Select onValueChange={handlePartSelect}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="اختر قطع الغيار..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {inventoryParts?.map((part: any) => (
                                                    <SelectItem key={part.partId} value={part.partId}>
                                                        {part.part?.name || part.name} (متوفر: {part.quantity})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>

                                        {inspectionForm.selectedParts.length > 0 && (
                                            <div className="mt-4 space-y-2">
                                                {inspectionForm.selectedParts.map((part) => (
                                                    <div key={part.partId} className="flex items-center justify-between bg-muted p-2 rounded">
                                                        <span>{part.partName}</span>
                                                        <div className="flex items-center gap-2">
                                                            <Input
                                                                type="number"
                                                                value={part.quantity}
                                                                onChange={(e) => updatePartQuantity(part.partId, parseInt(e.target.value))}
                                                                className="w-20 h-8"
                                                                min={1}
                                                            />
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => handlePartSelect(part.partId)}
                                                            >
                                                                <XCircle size={16} className="text-red-500" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))}
                                                <div className="pt-2 border-t">
                                                    <p className="font-bold">إجمالي قطع الغيار: {totalPartsCost} ج.م</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <Label>ملاحظات إضافية</Label>
                                    <Textarea
                                        value={inspectionForm.notes}
                                        onChange={(e) => setInspectionForm(prev => ({ ...prev, notes: e.target.value }))}
                                        placeholder="أي ملاحظات إضافية..."
                                        className="mt-1"
                                        rows={2}
                                    />
                                </div>
                            </CardContent>
                            <CardFooter className="flex flex-wrap gap-2">
                                <Button 
                                    onClick={() => handleStartRepair('FREE')}
                                    disabled={startRepairMutation.isPending || requestApprovalMutation.isPending || markTotalLossMutation.isPending}
                                    variant="outline"
                                >
                                    <CheckCircle size={16} className="ml-2" />
                                    إصلاح مجاني
                                </Button>
                                <Button 
                                    onClick={() => handleStartRepair('PAID')}
                                    disabled={startRepairMutation.isPending || requestApprovalMutation.isPending || markTotalLossMutation.isPending}
                                >
                                    <Play size={16} className="ml-2" />
                                    بدء إصلاح مدفوع
                                </Button>
                                <Button 
                                    onClick={handleRequestApproval}
                                    disabled={startRepairMutation.isPending || requestApprovalMutation.isPending || markTotalLossMutation.isPending}
                                    className="bg-orange-600 hover:bg-orange-700"
                                >
                                    <Clock size={16} className="ml-2" />
                                    إرسال طلب موافقة
                                </Button>
                                <Button 
                                    variant="destructive"
                                    onClick={() => setActiveTab('total-loss')}
                                    disabled={startRepairMutation.isPending || requestApprovalMutation.isPending || markTotalLossMutation.isPending}
                                >
                                    <XCircle size={16} className="ml-2" />
                                    تعليم كخسارة كلية
                                </Button>
                            </CardFooter>
                        </Card>
                    )}

                    {/* REPAIRING Actions */}
                    {machine.status === 'REPAIRING' && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Wrench size={18} />
                                    إكمال الإصلاح
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <Label>التكلفة النهائية (ج.م)</Label>
                                    <Input
                                        type="number"
                                        value={repairForm.finalCost}
                                        onChange={(e) => setRepairForm(prev => ({ ...prev, finalCost: e.target.value }))}
                                        placeholder={machine.estimatedCost?.toString() || '0.00'}
                                        className="mt-1"
                                    />
                                </div>
                                <div>
                                    <Label>رقم إيصال الإصلاح</Label>
                                    <Input
                                        value={repairForm.voucherNumber}
                                        onChange={(e) => setRepairForm(prev => ({ ...prev, voucherNumber: e.target.value }))}
                                        placeholder="رقم الإيصال..."
                                        className="mt-1"
                                    />
                                </div>
                                <div>
                                    <Label>ملاحظات</Label>
                                    <Textarea
                                        value={repairForm.notes}
                                        onChange={(e) => setRepairForm(prev => ({ ...prev, notes: e.target.value }))}
                                        placeholder="ملاحظات عن عملية الإصلاح..."
                                        className="mt-1"
                                        rows={3}
                                    />
                                </div>
                            </CardContent>
                            <CardFooter>
                                <Button 
                                    onClick={handleMarkRepaired}
                                    disabled={markRepairedMutation.isPending}
                                    className="bg-green-600 hover:bg-green-700"
                                >
                                    <CheckCircle size={16} className="ml-2" />
                                    إكمال الإصلاح
                                </Button>
                            </CardFooter>
                        </Card>
                    )}

                    {/* REPAIRED Actions */}
                    {machine.status === 'REPAIRED' && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Truck size={18} />
                                    إرجاع الماكينة للفرع
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <Alert className="bg-green-50 border-green-200">
                                    <CheckCircle className="h-4 w-4 text-green-600" />
                                    <AlertDescription className="text-green-700">
                                        الماكينة جاهزة للإرجاع إلى {machine.originBranch?.name}
                                    </AlertDescription>
                                </Alert>
                                <div>
                                    <Label>رقم بوليصة الشحن (اختياري)</Label>
                                    <Input
                                        value={returnForm.waybillNumber}
                                        onChange={(e) => setReturnForm(prev => ({ ...prev, waybillNumber: e.target.value }))}
                                        placeholder="رقم البوليصة..."
                                        className="mt-1"
                                    />
                                </div>
                                <div>
                                    <Label>ملاحظات الإرجاع</Label>
                                    <Textarea
                                        value={returnForm.returnNotes}
                                        onChange={(e) => setReturnForm(prev => ({ ...prev, returnNotes: e.target.value }))}
                                        placeholder="ملاحظات حول حالة الماكينة عند الإرجاع..."
                                        className="mt-1"
                                        rows={3}
                                    />
                                </div>
                            </CardContent>
                            <CardFooter>
                                <Button 
                                    onClick={handleReturn}
                                    disabled={returnMutation.isPending}
                                    className="bg-blue-600 hover:bg-blue-700"
                                >
                                    <RotateCcw size={16} className="ml-2" />
                                    إرجاع للفرع
                                </Button>
                            </CardFooter>
                        </Card>
                    )}

                    {/* TOTAL_LOSS Actions */}
                    {machine.status === 'TOTAL_LOSS' && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <XCircle size={18} />
                                    إنشاء إرجاع للخسارة الكلية
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <Alert className="bg-red-50 border-red-200">
                                    <AlertTriangle className="h-4 w-4 text-red-600" />
                                    <AlertDescription className="text-red-700">
                                        تم تعليم هذه الماكينة كخسارة كلية. سيتم إرجاعها للفرع في الشحنات الجماعية الدورية
                                    </AlertDescription>
                                </Alert>
                                <div>
                                    <Label>سبب الخسارة</Label>
                                    <p className="mt-1 p-3 bg-muted rounded-lg">{machine.problemDescription || 'غير محدد'}</p>
                                </div>
                            </CardContent>
                            <CardFooter>
                                <Button 
                                    variant="outline"
                                    onClick={() => navigate('/maintenance-center')}
                                >
                                    العودة للقائمة
                                </Button>
                            </CardFooter>
                        </Card>
                    )}

                    {/* Default message for other statuses */}
                    {!['UNDER_INSPECTION', 'REPAIRING', 'REPAIRED', 'TOTAL_LOSS'].includes(machine.status) && (
                        <Alert>
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription>
                                لا توجد إجراءات متاحة للحالة الحالية ({status.label})
                            </AlertDescription>
                        </Alert>
                    )}
                </TabsContent>

                {/* Approval Tab */}
                <TabsContent value="approval" className="space-y-4">
                    {machine.approvalRequest ? (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Clock size={18} />
                                    حالة طلب الموافقة
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                                    <div>
                                        <p className="text-sm text-muted-foreground">حالة الموافقة</p>
                                        <Badge 
                                            variant="outline" 
                                            className={`${approvalStatusConfig[machine.approvalRequest.status].color} mt-1`}
                                        >
                                            {approvalStatusConfig[machine.approvalRequest.status].icon}
                                            {approvalStatusConfig[machine.approvalRequest.status].label}
                                        </Badge>
                                    </div>
                                    <div className="text-left">
                                        <p className="text-sm text-muted-foreground">التكلفة المطلوبة</p>
                                        <p className="text-2xl font-bold">{machine.approvalRequest.cost} ج.م</p>
                                    </div>
                                </div>

                                <div>
                                    <Label>سبب الطلب</Label>
                                    <p className="mt-1 p-3 bg-muted rounded-lg">{machine.approvalRequest.reason}</p>
                                </div>

                                <div>
                                    <Label>تاريخ الطلب</Label>
                                    <p className="mt-1">
                                        {format(new Date(machine.approvalRequest.requestedAt), 'PPP', { locale: ar })}
                                    </p>
                                </div>

                                {machine.approvalRequest.respondedAt && (
                                    <>
                                        <div>
                                            <Label>تاريخ الرد</Label>
                                            <p className="mt-1">
                                                {format(new Date(machine.approvalRequest.respondedAt), 'PPP', { locale: ar })}
                                            </p>
                                        </div>
                                        {machine.approvalRequest.responseNotes && (
                                            <div>
                                                <Label>ملاحظات الرد</Label>
                                                <p className="mt-1 p-3 bg-muted rounded-lg">
                                                    {machine.approvalRequest.responseNotes}
                                                </p>
                                            </div>
                                        )}
                                    </>
                                )}

                                {machine.approvalRequest.status === 'APPROVED' && machine.status === 'WAITING_APPROVAL' && (
                                    <Alert className="bg-green-50 border-green-200">
                                        <CheckCircle className="h-4 w-4 text-green-600" />
                                        <AlertDescription className="text-green-700">
                                            تمت الموافقة! يمكنك الآن بدء عملية الإصلاح
                                        </AlertDescription>
                                    </Alert>
                                )}

                                {machine.approvalRequest.status === 'REJECTED' && (
                                    <Alert className="bg-red-50 border-red-200">
                                        <XCircle className="h-4 w-4 text-red-600" />
                                        <AlertDescription className="text-red-700">
                                            تم رفض الطلب. يمكنك إعادة الفحص أو تعليم الماكينة كخسارة كلية
                                        </AlertDescription>
                                    </Alert>
                                )}
                            </CardContent>
                        </Card>
                    ) : (
                        <Alert>
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription>
                                لا يوجد طلب موافقة مسجل لهذه الماكينة
                            </AlertDescription>
                        </Alert>
                    )}
                </TabsContent>

                {/* History Tab */}
                <TabsContent value="history" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <History size={18} />
                                سجل تغييرات الحالة
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {machine.history && machine.history.length > 0 ? (
                                <div className="space-y-4">
                                    {machine.history.map((entry, index) => (
                                        <div key={entry.id} className="flex gap-4 pb-4 border-b last:border-0">
                                            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                                <History size={16} className="text-primary" />
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center justify-between">
                                                    <p className="font-bold">{entry.action}</p>
                                                    <Badge variant="outline" className={statusConfig[entry.status]?.color || ''}>
                                                        {statusConfig[entry.status]?.label || entry.status}
                                                    </Badge>
                                                </div>
                                                <p className="text-sm text-muted-foreground mt-1">
                                                    بواسطة: {entry.performedBy}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {format(new Date(entry.performedAt), 'PPpp', { locale: ar })}
                                                </p>
                                                {entry.details && (
                                                    <p className="mt-2 p-2 bg-muted rounded text-sm">
                                                        {entry.details}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-center text-muted-foreground py-8">
                                    لا يوجد سجل تغييرات
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default MaintenanceMachineDetailPage;
