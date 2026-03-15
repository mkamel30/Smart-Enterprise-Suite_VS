"use client";

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '../components/ui/table';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../components/ui/select';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import {
    Wrench,
    Search,
    Filter,
    MoreVertical,
    Eye,
    UserPlus,
    ClipboardCheck,
    Play,
    Clock,
    CheckCircle,
    XCircle,
    RotateCcw,
    Package,
    RefreshCw,
    AlertTriangle,
    Building2,
    Users,
    Settings,
    ClipboardList,
    Truck,
    Send
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import toast from 'react-hot-toast';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '../components/ui/dialog';
import { cn } from '../lib/utils';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Checkbox } from '../components/ui/checkbox';

// Types
interface MaintenanceMachine {
    id: string;
    serialNumber: string;
    model: string;
    manufacturer: string;
    problemDescription: string;
    status: 'NEW' | 'UNDER_INSPECTION' | 'REPAIRING' | 'WAITING_APPROVAL' | 'REPAIRED' | 'TOTAL_LOSS' | 'RETURNED';
    assignedTechnician: {
        id: string;
        name: string;
    } | null;
    originBranch: {
        id: string;
        name: string;
        code: string;
    };
    customerName: string;
    receivedAt: string;
    estimatedCost: number | null;
    approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | null;
    daysAtCenter: number;
}

interface MaintenanceStats {
    totalMachines: number;
    underRepair: number;
    waitingApproval: number;
    repaired: number;
    totalLoss: number;
    underInspection: number;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    NEW: { label: 'جديد', color: 'bg-gray-100 text-gray-700 border-gray-200', icon: <Package size={14} /> },
    UNDER_INSPECTION: { label: 'تحت الفحص', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: <ClipboardCheck size={14} /> },
    REPAIRING: { label: 'قيد الإصلاح', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: <Wrench size={14} /> },
    WAITING_APPROVAL: { label: 'بانتظار الموافقة', color: 'bg-orange-100 text-orange-700 border-orange-200', icon: <Clock size={14} /> },
    REPAIRED: { label: 'تم الإصلاح', color: 'bg-green-100 text-green-700 border-green-200', icon: <CheckCircle size={14} /> },
    TOTAL_LOSS: { label: 'خسارة كلية', color: 'bg-red-100 text-red-700 border-red-200', icon: <XCircle size={14} /> },
    RETURNED: { label: 'تم الإرجاع', color: 'bg-purple-100 text-purple-700 border-purple-200', icon: <RotateCcw size={14} /> },
};

const approvalStatusConfig: Record<string, { label: string; color: string }> = {
    PENDING: { label: 'معلق', color: 'bg-orange-100 text-orange-700' },
    APPROVED: { label: 'تمت الموافقة', color: 'bg-green-100 text-green-700' },
    REJECTED: { label: 'مرفوض', color: 'bg-red-100 text-red-700' },
};

const MaintenanceCenter: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    // Filters
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [technicianFilter, setTechnicianFilter] = useState<string>('');
    const [branchFilter, setBranchFilter] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState<string>('');

    // Return Package Dialog State
    const [showReturnDialog, setShowReturnDialog] = useState(false);
    const [selectedMachines, setSelectedMachines] = useState<string[]>([]);
    const [returnNotes, setReturnNotes] = useState('');
    const [returnDriverName, setReturnDriverName] = useState('');
    const [returnDriverPhone, setReturnDriverPhone] = useState('');
    const [isCreatingReturn, setIsCreatingReturn] = useState(false);

    // Fetch machines
    const { data: machines, isLoading, refetch } = useQuery<MaintenanceMachine[]>({
        queryKey: ['maintenance-center-machines', statusFilter, technicianFilter, branchFilter],
        queryFn: async () => {
            const params: any = {};
            if (statusFilter) params.status = statusFilter;
            if (technicianFilter) params.technicianId = technicianFilter;
            if (branchFilter) params.branchId = branchFilter;
            if (searchQuery) params.search = searchQuery;
            return api.getMaintenanceCenterMachines(params);
        },
        refetchInterval: 30000, // Auto refresh every 30 seconds
    });

    // Fetch stats
    const { data: stats, isLoading: statsLoading } = useQuery<MaintenanceStats>({
        queryKey: ['maintenance-center-stats'],
        queryFn: () => api.getMaintenanceCenterStats(),
        refetchInterval: 30000,
    });

    // Fetch technicians for filter
    const { data: technicians } = useQuery({
        queryKey: ['technicians'],
        queryFn: () => api.getTechnicians(),
    });

    // Fetch branches for filter
    const { data: branches } = useQuery({
        queryKey: ['branches'],
        queryFn: () => api.getBranches(),
    });

    // Fetch machines ready for return
    const { data: machinesReadyForReturn, isLoading: loadingReturnMachines, refetch: refetchReturnMachines } = useQuery({
        queryKey: ['machines-ready-for-return'],
        queryFn: () => api.getMachinesReadyForReturn(),
        enabled: showReturnDialog, // Only fetch when dialog is open
    });

    // Filter machines by search query locally
    const filteredMachines = useMemo(() => {
        if (!machines) return [];
        if (!searchQuery) return machines;

        const query = searchQuery.toLowerCase();
        return machines.filter(machine =>
            machine.serialNumber.toLowerCase().includes(query) ||
            machine.model.toLowerCase().includes(query) ||
            machine.problemDescription.toLowerCase().includes(query) ||
            machine.customerName?.toLowerCase().includes(query) ||
            machine.originBranch?.name?.toLowerCase().includes(query)
        );
    }, [machines, searchQuery]);

    // Get available actions based on status
    const getAvailableActions = (machine: MaintenanceMachine) => {
        const actions = [];

        switch (machine.status) {
            case 'NEW':
                actions.push(
                    { label: 'تعيين فني', icon: <UserPlus size={16} />, action: 'assign' },
                    { label: 'بدء الفحص', icon: <ClipboardCheck size={16} />, action: 'inspect' }
                );
                break;
            case 'UNDER_INSPECTION':
                actions.push(
                    { label: 'بدء الإصلاح', icon: <Play size={16} />, action: 'start-repair' },
                    { label: 'طلب موافقة', icon: <Clock size={16} />, action: 'request-approval' },
                    { label: 'تعليم كخسارة', icon: <XCircle size={16} />, action: 'mark-total-loss' }
                );
                break;
            case 'REPAIRING':
                actions.push(
                    { label: 'إكمال الإصلاح', icon: <CheckCircle size={16} />, action: 'complete-repair' }
                );
                break;
            case 'WAITING_APPROVAL':
                actions.push(
                    { label: 'حالة الموافقة', icon: <Eye size={16} />, action: 'view-approval' }
                );
                break;
            case 'REPAIRED':
                actions.push(
                    { label: 'إرجاع للفرع', icon: <RotateCcw size={16} />, action: 'return-branch' }
                );
                break;
            case 'TOTAL_LOSS':
                actions.push(
                    { label: 'إنشاء إرجاع', icon: <Package size={16} />, action: 'create-return' }
                );
                break;
        }

        return actions;
    };

    // Handle action click
    const handleAction = (machineId: string, actionType: string) => {
        const routes: Record<string, string> = {
            'assign': `/maintenance-center/machine/${machineId}?action=assign`,
            'inspect': `/maintenance-center/machine/${machineId}?action=inspect`,
            'start-repair': `/maintenance-center/machine/${machineId}?action=start-repair`,
            'request-approval': `/maintenance-center/machine/${machineId}?action=request-approval`,
            'complete-repair': `/maintenance-center/machine/${machineId}?action=complete`,
            'view-approval': `/maintenance-center/machine/${machineId}?tab=approval`,
            'return-branch': `/maintenance-center/machine/${machineId}?action=return`,
            'mark-total-loss': `/maintenance-center/machine/${machineId}?action=total-loss`,
            'create-return': `/maintenance-center/machine/${machineId}?action=create-return`,
        };

        const route = routes[actionType] || `/maintenance-center/machine/${machineId}`;
        navigate(route);
    };

    // ==================== RETURN PACKAGE HANDLERS ====================

    const toggleMachineSelection = (machineId: string) => {
        setSelectedMachines(prev =>
            prev.includes(machineId)
                ? prev.filter(id => id !== machineId)
                : [...prev, machineId]
        );
    };

    const selectAllReturnMachines = () => {
        if (machinesReadyForReturn && machinesReadyForReturn.length > 0) {
            setSelectedMachines(machinesReadyForReturn.map((m: any) => m.id));
        }
    };

    const deselectAllReturnMachines = () => {
        setSelectedMachines([]);
    };

    const handleCreateReturnPackage = async () => {
        if (selectedMachines.length === 0) {
            toast.error('يرجى اختيار ماكينة واحدة على الأقل');
            return;
        }

        setIsCreatingReturn(true);
        try {
            const result = await api.createReturnPackage({
                machineIds: selectedMachines,
                notes: returnNotes,
                driverName: returnDriverName,
                driverPhone: returnDriverPhone
            });

            toast.success(`تم إنشاء ${result.data?.orders?.length || 0} إذن إرجاع بنجاح`);
            setShowReturnDialog(false);
            setSelectedMachines([]);
            setReturnNotes('');
            setReturnDriverName('');
            setReturnDriverPhone('');
            refetch();
            refetchReturnMachines();
        } catch (error: any) {
            toast.error(error.message || 'فشل في إنشاء إذن الإرجاع');
        } finally {
            setIsCreatingReturn(false);
        }
    };

    // Stats cards data
    const statsCards = [
        {
            title: 'إجمالي الماكينات',
            value: stats?.totalMachines || 0,
            icon: <Package className="w-5 h-5 text-blue-600" />,
            color: 'bg-blue-50 border-blue-200',
            textColor: 'text-blue-900'
        },
        {
            title: 'تحت الإصلاح',
            value: (stats?.underRepair || 0) + (stats?.underInspection || 0),
            icon: <Wrench className="w-5 h-5 text-yellow-600" />,
            color: 'bg-yellow-50 border-yellow-200',
            textColor: 'text-yellow-900'
        },
        {
            title: 'بانتظار الموافقة',
            value: stats?.waitingApproval || 0,
            icon: <Clock className="w-5 h-5 text-orange-600" />,
            color: 'bg-orange-50 border-orange-200',
            textColor: 'text-orange-900'
        },
        {
            title: 'تم الإصلاح',
            value: stats?.repaired || 0,
            icon: <CheckCircle className="w-5 h-5 text-green-600" />,
            color: 'bg-green-50 border-green-200',
            textColor: 'text-green-900'
        },
        {
            title: 'خسارة كلية',
            value: stats?.totalLoss || 0,
            icon: <XCircle className="w-5 h-5 text-red-600" />,
            color: 'bg-red-50 border-red-200',
            textColor: 'text-red-900'
        },
    ];

    return (
        <div className="p-6 space-y-6" dir="rtl">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
                        <Settings className="text-primary" />
                        مركز الصيانة
                    </h1>
                    <p className="text-muted-foreground text-sm">إدارة الماكينات في مركز الصيانة</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="default"
                        size="sm"
                        onClick={() => {
                            setShowReturnDialog(true);
                            refetchReturnMachines();
                        }}
                        className="gap-2"
                    >
                        <Send size={16} className="ml-2" />
                        إرجاع للفرع
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => refetch()}>
                        <RefreshCw size={16} className="ml-2" />
                        تحديث
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {statsCards.map((stat, index) => (
                    <Card key={index} className={`${stat.color} border`}>
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-bold text-muted-foreground">{stat.title}</p>
                                    <p className={`text-2xl font-black ${stat.textColor}`}>
                                        {statsLoading ? '-' : stat.value}
                                    </p>
                                </div>
                                <div className="p-2 bg-white/60 rounded-lg">
                                    {stat.icon}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row gap-4">
                        {/* Search */}
                        <div className="flex-1 relative">
                            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                            <Input
                                placeholder="البحث برقم السريال، الموديل، أو المشكلة..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pr-10"
                            />
                        </div>

                        {/* Status Filter */}
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[180px]">
                                <Filter size={16} className="ml-2" />
                                <SelectValue placeholder="حالة الماكينة" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="">كل الحالات</SelectItem>
                                <SelectItem value="NEW">جديد</SelectItem>
                                <SelectItem value="UNDER_INSPECTION">تحت الفحص</SelectItem>
                                <SelectItem value="REPAIRING">قيد الإصلاح</SelectItem>
                                <SelectItem value="WAITING_APPROVAL">بانتظار الموافقة</SelectItem>
                                <SelectItem value="REPAIRED">تم الإصلاح</SelectItem>
                                <SelectItem value="TOTAL_LOSS">خسارة كلية</SelectItem>
                            </SelectContent>
                        </Select>

                        {/* Technician Filter */}
                        <Select value={technicianFilter} onValueChange={setTechnicianFilter}>
                            <SelectTrigger className="w-[180px]">
                                <Users size={16} className="ml-2" />
                                <SelectValue placeholder="الفني" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="">كل الفنيين</SelectItem>
                                {Array.isArray(technicians) && technicians.map((tech: any) => (
                                    <SelectItem key={tech.id} value={tech.id}>
                                        {tech.displayName || tech.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {/* Branch Filter */}
                        <Select value={branchFilter} onValueChange={setBranchFilter}>
                            <SelectTrigger className="w-[180px]">
                                <Building2 size={16} className="ml-2" />
                                <SelectValue placeholder="الفرع الأصلي" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="">كل الفروع</SelectItem>
                                {Array.isArray(branches) && branches.map((branch: any) => (
                                    <SelectItem key={branch.id} value={branch.id}>
                                        {branch.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Machines Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <ClipboardList className="w-5 h-5" />
                        الماكينات في المركز
                        <Badge variant="secondary" className="mr-2">
                            {filteredMachines?.length || 0}
                        </Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="text-center py-12">
                            <RefreshCw className="animate-spin mx-auto mb-4" size={32} />
                            <p className="text-muted-foreground">جاري تحميل البيانات...</p>
                        </div>
                    ) : filteredMachines?.length === 0 ? (
                        <div className="text-center py-12">
                            <Package className="mx-auto mb-4 text-gray-300" size={48} />
                            <p className="text-muted-foreground">لا توجد ماكينات في المركز</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>السريال</TableHead>
                                        <TableHead>الموديل</TableHead>
                                        <TableHead>المشكلة/الشكوى</TableHead>
                                        <TableHead>الحالة</TableHead>
                                        <TableHead>الفني المسؤول</TableHead>
                                        <TableHead>الفرع الأصلي</TableHead>
                                        <TableHead>الأيام في المركز</TableHead>
                                        <TableHead>الإجراءات</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {Array.isArray(filteredMachines) && filteredMachines.map((machine) => {
                                        const status = statusConfig[machine.status];
                                        const actions = getAvailableActions(machine);

                                        return (
                                            <TableRow key={machine.id} className="hover:bg-muted/50">
                                                <TableCell>
                                                    <div className="font-mono font-bold">{machine.serialNumber}</div>
                                                    <div className="text-xs text-muted-foreground">{machine.manufacturer}</div>
                                                </TableCell>
                                                <TableCell>{machine.model}</TableCell>
                                                <TableCell>
                                                    <div className="max-w-xs truncate" title={machine.problemDescription}>
                                                        {machine.problemDescription || 'غير محدد'}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant="outline"
                                                        className={`${status.color} flex items-center gap-1`}
                                                    >
                                                        {status.icon}
                                                        {status.label}
                                                    </Badge>
                                                    {machine.approvalStatus && (
                                                        <div className="mt-1">
                                                            <Badge
                                                                variant="outline"
                                                                className={`${approvalStatusConfig[machine.approvalStatus].color} text-xs`}
                                                            >
                                                                {approvalStatusConfig[machine.approvalStatus].label}
                                                            </Badge>
                                                        </div>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {machine.assignedTechnician ? (
                                                        <div className="flex items-center gap-2">
                                                            <Users size={14} className="text-muted-foreground" />
                                                            <span>{machine.assignedTechnician.name}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground text-sm">غير معين</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <Building2 size={14} className="text-muted-foreground" />
                                                        <span>{machine.originBranch?.name || 'غير محدد'}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1">
                                                        <Clock size={14} className="text-muted-foreground" />
                                                        <span>{machine.daysAtCenter} يوم</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => navigate(`/maintenance-center/machine/${machine.id}`)}
                                                        >
                                                            <Eye size={16} className="ml-1" />
                                                            عرض
                                                        </Button>

                                                        {actions.length > 0 && (
                                                            <DropdownMenu modal={false}>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        className="cursor-pointer hover:bg-gray-100"
                                                                    >
                                                                        <MoreVertical size={16} />
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end" className="w-48">
                                                                    {Array.isArray(actions) && actions.map((action, idx) => (
                                                                        <DropdownMenuItem
                                                                            key={idx}
                                                                            onClick={() => handleAction(machine.id, action.action)}
                                                                            className="cursor-pointer hover:bg-gray-100 focus:bg-gray-100 py-2"
                                                                        >
                                                                            <span className="ml-2 flex-shrink-0">{action.icon}</span>
                                                                            <span>{action.label}</span>
                                                                        </DropdownMenuItem>
                                                                    ))}
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* ==================== RETURN PACKAGE DIALOG ==================== */}
            <Dialog open={showReturnDialog} onOpenChange={setShowReturnDialog}>
                <DialogContent className="p-0 border-0 [&>button]:hidden flex flex-col max-h-[90vh] h-auto overflow-hidden sm:max-w-xl rounded-2xl shadow-2xl bg-white" dir="rtl">
                    <DialogHeader className="bg-slate-50/50 p-4 md:p-5 border-b shrink-0 text-right">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-600 text-white rounded-lg">
                                <Truck size={16} />
                            </div>
                            <div>
                                <DialogTitle className="text-base font-black text-slate-900 leading-tight">إنشاء طرد إرجاع للفروع</DialogTitle>
                                <DialogDescription className="text-[10px] text-slate-400 font-bold mt-0.5 opacity-80">تجميع الماكينات الجاهزة وإرسالها في طرد واحد</DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-4 custom-scroll">
                        {/* Driver Info */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">اسم السائق الناقل</label>
                                <Input
                                    value={returnDriverName}
                                    onChange={(e) => setReturnDriverName(e.target.value)}
                                    className="h-9 text-xs font-bold border-slate-200 focus:border-indigo-500 rounded-lg"
                                    placeholder="اختياري..."
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">هاتف السائق</label>
                                <Input
                                    value={returnDriverPhone}
                                    onChange={(e) => setReturnDriverPhone(e.target.value)}
                                    className="h-9 text-xs font-bold border-slate-200 focus:border-indigo-500 rounded-lg"
                                    placeholder="اختياري..."
                                />
                            </div>
                        </div>

                        {/* Notes */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">ملاحظات التحويل</label>
                            <Textarea
                                value={returnNotes}
                                onChange={(e) => setReturnNotes(e.target.value)}
                                className="min-h-[60px] text-xs font-bold border-slate-200 focus:border-indigo-500 rounded-lg bg-slate-50/30 focus:bg-white transition-all"
                                placeholder="أي تفاصيل خاصة بالشحن أو الاستلام..."
                            />
                        </div>

                        {/* Machines Selection */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between px-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">اختيار الماكينات ({machinesReadyForReturn?.length || 0})</label>
                                <div className="flex gap-2">
                                    <button onClick={selectAllReturnMachines} className="text-[9px] font-black text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-2 py-1 rounded-md transition-all">تحديد الكل</button>
                                    <button onClick={deselectAllReturnMachines} className="text-[9px] font-black text-slate-500 hover:text-slate-600 bg-slate-100 px-2 py-1 rounded-md transition-all">إلغاء</button>
                                </div>
                            </div>

                            <div className="border border-slate-100 rounded-xl overflow-hidden bg-white shadow-sm">
                                {loadingReturnMachines ? (
                                    <div className="text-center py-6 flex flex-col items-center gap-2">
                                        <RefreshCw className="animate-spin text-indigo-200" size={24} />
                                        <p className="text-[10px] text-slate-400 font-bold">جاري تحميل الماكينات...</p>
                                    </div>
                                ) : machinesReadyForReturn?.length === 0 ? (
                                    <div className="text-center py-8 flex flex-col items-center gap-2">
                                        <Package className="text-slate-100" size={32} />
                                        <p className="text-[10px] text-slate-400 font-bold">لا توجد ماكينات جاهزة حالياً</p>
                                    </div>
                                ) : (
                                    <div className="max-h-48 overflow-y-auto custom-scroll">
                                        <Table>
                                            <TableHeader className="bg-slate-50/80">
                                                <TableRow className="border-b-slate-100">
                                                    <TableHead className="h-8 w-10 text-center"></TableHead>
                                                    <TableHead className="h-8 text-right font-black text-[9px] text-slate-400">السريال</TableHead>
                                                    <TableHead className="h-8 text-right font-black text-[9px] text-slate-400">الفرع</TableHead>
                                                    <TableHead className="h-8 text-center font-black text-[9px] text-slate-400">التكلفة</TableHead>
                                                    <TableHead className="h-8 text-center font-black text-[9px] text-slate-400">الحالة</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {Array.isArray(machinesReadyForReturn) && machinesReadyForReturn.map((machine: any) => (
                                                    <TableRow key={machine.id} className="border-b-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                                                        <TableCell className="p-2 text-center">
                                                            <Checkbox
                                                                checked={selectedMachines.includes(machine.id)}
                                                                onCheckedChange={() => toggleMachineSelection(machine.id)}
                                                                className="rounded-[4px]"
                                                            />
                                                        </TableCell>
                                                        <TableCell className="p-2">
                                                            <div className="font-mono text-[11px] font-black text-slate-700 leading-none">{machine.serialNumber}</div>
                                                            <div className="text-[8px] text-slate-400 mt-0.5">{machine.model}</div>
                                                        </TableCell>
                                                        <TableCell className="p-2 text-[10px] font-bold text-slate-600">
                                                            {machine.originBranchId || 'غير محدد'}
                                                        </TableCell>
                                                        <TableCell className="p-2 text-center text-[10px] font-black">
                                                            {machine.maintenanceCost > 0 ? (
                                                                <span className="text-indigo-600">{machine.maintenanceCost.toLocaleString()}</span>
                                                            ) : (
                                                                <span className="text-emerald-500">0</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="p-2 text-center">
                                                            <span className={cn(
                                                                "text-[8px] font-black px-1.5 py-0.5 rounded",
                                                                machine.status === 'TOTAL_LOSS' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
                                                            )}>
                                                                {machine.status === 'TOTAL_LOSS' ? 'فقدان' : 'تم'}
                                                            </span>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Summary Block */}
                        {selectedMachines.length > 0 && (
                            <div className="bg-indigo-600 p-3 rounded-xl shadow-lg shadow-indigo-100 flex items-center justify-between text-white">
                                <div className="flex items-center gap-4">
                                    <div>
                                        <p className="text-[8px] font-black opacity-60 uppercase mb-0.5">عدد الماكينات</p>
                                        <p className="text-base font-black leading-none">{selectedMachines.length}</p>
                                    </div>
                                    <div className="w-px h-8 bg-white/20"></div>
                                    <div>
                                        <p className="text-[8px] font-black opacity-60 uppercase mb-0.5">إجمالي التكلفة</p>
                                        <p className="text-base font-black leading-none">
                                            {(Array.isArray(machinesReadyForReturn) ? machinesReadyForReturn : [])
                                                .filter((m: any) => selectedMachines.includes(m.id))
                                                .reduce((sum: number, m: any) => sum + (m.maintenanceCost || 0), 0)
                                                .toLocaleString()} <span className="text-[10px] opacity-60">ج.م</span>
                                        </p>
                                    </div>
                                </div>
                                <div className="bg-white/10 p-1.5 rounded-lg border border-white/10">
                                    <Package size={16} />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-4 md:p-5 border-t bg-slate-50 flex items-center gap-2">
                        <button
                            onClick={() => setShowReturnDialog(false)}
                            className="h-10 px-4 border border-slate-200 text-slate-500 font-bold text-xs rounded-lg hover:bg-slate-100 transition-all font-bold"
                        >
                            إلغاء
                        </button>
                        <button
                            onClick={handleCreateReturnPackage}
                            disabled={selectedMachines.length === 0 || isCreatingReturn}
                            className="flex-1 h-10 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-black text-xs shadow-lg shadow-emerald-100 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isCreatingReturn ? <RefreshCw className="animate-spin" size={14} /> : <Send size={14} />}
                            {isCreatingReturn ? 'جاري الإنشاء...' : `تأكيد إنشاء وتحويل (${selectedMachines.length})`}
                        </button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default MaintenanceCenter;
