"use client";

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import * as XLSX from 'xlsx';
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
    Eye,
    Clock,
    CheckCircle,
    AlertCircle,
    User,
    Wrench,
    Package,
    RefreshCw,
    Download,
    Building2,
    Calendar,
    MapPin,
    ArrowRight,
    Loader2
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { ar } from 'date-fns/locale';
import toast from 'react-hot-toast';

// Types
interface BranchTrackedMachine {
    id: string;
    serialNumber: string;
    model: string;
    manufacturer: string;
    centerName: string;
    centerId: string;
    status: 'NEW' | 'UNDER_INSPECTION' | 'REPAIRING' | 'WAITING_APPROVAL' | 'REPAIRED' | 'TOTAL_LOSS' | 'IN_RETURN_TRANSIT' | 'RETURNED';
    problem: string;
    customerName: string;
    customerCode: string;
    assignedAt: string;
    daysAtCenter: number;
    lastUpdate: string;
    lastUpdateAction: string;
    estimatedCompletion?: string;
    technicianName?: string;
    approvalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
    progress?: number;
}

interface TrackingSummary {
    total: number;
    underInspection: number;
    inRepair: number;
    waitingApproval: number;
    completed: number;
    inReturnTransit: number;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode; description: string }> = {
    NEW: {
        label: 'تم الاستلام',
        color: 'bg-gray-100 text-gray-700 border-gray-200',
        icon: <Package size={16} />,
        description: 'تم استلام الماكينة في المركز'
    },
    UNDER_INSPECTION: {
        label: 'تحت الفحص',
        color: 'bg-yellow-100 text-yellow-700 border-yellow-200',
        icon: <Clock size={16} />,
        description: 'يتم فحص الماكينة وتحديد المشكلة'
    },
    REPAIRING: {
        label: 'قيد الإصلاح',
        color: 'bg-blue-100 text-blue-700 border-blue-200',
        icon: <Wrench size={16} />,
        description: 'جاري إصلاح الماكينة'
    },
    WAITING_APPROVAL: {
        label: 'بانتظار الموافقة',
        color: 'bg-orange-100 text-orange-700 border-orange-200',
        icon: <AlertCircle size={16} />,
        description: 'في انتظار موافقتك على التكلفة'
    },
    REPAIRED: {
        label: 'تم الإصلاح',
        color: 'bg-green-100 text-green-700 border-green-200',
        icon: <CheckCircle size={16} />,
        description: 'اكتمل الإصلاح وجاهز للإرجاع'
    },
    TOTAL_LOSS: {
        label: 'خسارة كلية',
        color: 'bg-red-100 text-red-700 border-red-200',
        icon: <AlertCircle size={16} />,
        description: 'لا يمكن إصلاح الماكينة'
    },
    IN_RETURN_TRANSIT: {
        label: 'في طريق العودة',
        color: 'bg-purple-100 text-purple-700 border-purple-200',
        icon: <ArrowRight size={16} />,
        description: 'الماكينة في طريقها للفرع'
    },
    RETURNED: {
        label: 'تم الإرجاع',
        color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        icon: <CheckCircle size={16} />,
        description: 'تم إرجاع الماكينة للفرع'
    },
    READY_FOR_RETURN: {
        label: 'جاهز للإرجاع',
        color: 'bg-teal-100 text-teal-700 border-teal-200',
        icon: <ArrowRight size={16} />,
        description: 'تم إصلاح الماكينة وجاهز للإرجاع'
    },
};

const approvalStatusConfig: Record<string, { label: string; color: string }> = {
    PENDING: { label: 'معلق', color: 'bg-orange-100 text-orange-700' },
    APPROVED: { label: 'تمت الموافقة', color: 'bg-green-100 text-green-700' },
    REJECTED: { label: 'مرفوض', color: 'bg-red-100 text-red-700' },
};

export default function TrackMachines() {
    const { user, activeBranchId } = useAuth();
    const navigate = useNavigate();
    const [filterStatus, setFilterStatus] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [selectedMachine, setSelectedMachine] = useState<BranchTrackedMachine | null>(null);

    // Fetch tracked machines for branch
    const { data: machinesResponse, isLoading, refetch } = useQuery<{
        success: boolean;
        count: number;
        data: BranchTrackedMachine[];
    }>({
        queryKey: ['track-machines', activeBranchId, user?.branchId, filterStatus],
        queryFn: async () => {
            const branchId = activeBranchId || user?.branchId;
            if (!branchId) return { success: true, count: 0, data: [] };
            return api.getBranchMachinesAtCenter(branchId);
        },
        enabled: !!(activeBranchId || user?.branchId),
        refetchInterval: 30000, // Auto refresh every 30 seconds
    });

    // Extract machines array from response
    const machines = machinesResponse?.data || [];

    // Fetch summary
    const { data: summary, isLoading: summaryLoading } = useQuery<TrackingSummary>({
        queryKey: ['track-machines-summary', activeBranchId, user?.branchId],
        queryFn: async () => {
            const branchId = activeBranchId || user?.branchId;
            if (!branchId) return null;
            const res = await api.getBranchMachinesSummary(branchId);
            return res?.data || res;
        },
        enabled: !!(activeBranchId || user?.branchId),
    });

    // Filter machines locally
    const filteredMachines = useMemo(() => {
        if (!machines) return [];
        let filtered = machines;

        if (filterStatus) {
            filtered = filtered.filter(m => m.status === filterStatus);
        }

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(m =>
                m.serialNumber.toLowerCase().includes(query) ||
                m.model.toLowerCase().includes(query) ||
                m.problem.toLowerCase().includes(query) ||
                m.customerName?.toLowerCase().includes(query) ||
                m.centerName?.toLowerCase().includes(query)
            );
        }

        return filtered;
    }, [machines, filterStatus, searchQuery]);

    // Handle export
    const handleExport = () => {
        if (!machines) return;

        const data = machines.map(m => ({
            'السريال': m.serialNumber,
            'الموديل': m.model,
            'المركز': m.centerName,
            'الحالة': statusConfig[m.status]?.label || m.status,
            'المشكلة': m.problem,
            'العميل': m.customerName,
            'الكود': m.customerCode || '',
            'الفني': m.technicianName || '',
            'الأيام في المركز': m.daysAtCenter,
            'آخر تحديث': format(new Date(m.lastUpdate), 'yyyy-MM-dd HH:mm'),
        }));

        // Create Excel workbook
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(data, {
            header: ['السريال', 'الموديل', 'المركز', 'الحالة', 'المشكلة', 'العميل', 'الكود', 'الفني', 'الأيام في المركز', 'آخر تحديث']
        });

        // Set column widths for better readability
        ws['!cols'] = [
            { wch: 15 }, // السريال
            { wch: 12 }, // الموديل
            { wch: 20 }, // المركز
            { wch: 15 }, // الحالة
            { wch: 30 }, // المشكلة
            { wch: 25 }, // العميل
            { wch: 12 }, // الكود
            { wch: 15 }, // الفني
            { wch: 18 }, // الأيام في المركز
            { wch: 18 }, // آخر تحديث
        ];

        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(wb, ws, 'الماكينات في مراكز الصيانة');

        // Generate Excel file
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

        // Download
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `machines_tracking_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
        link.click();

        toast.success('تم تصدير البيانات بنجاح');
    };

    // Stats cards
    const statsCards = [
        {
            title: 'إجمالي الماكينات',
            value: summary?.total || machines?.length || 0,
            icon: <Package className="w-5 h-5 text-blue-600" />,
            color: 'bg-blue-50 border-blue-200',
            textColor: 'text-blue-900'
        },
        {
            title: 'تحت الفحص',
            value: summary?.underInspection || 0,
            icon: <Clock className="w-5 h-5 text-yellow-600" />,
            color: 'bg-yellow-50 border-yellow-200',
            textColor: 'text-yellow-900'
        },
        {
            title: 'قيد الإصلاح',
            value: summary?.inRepair || 0,
            icon: <Wrench className="w-5 h-5 text-blue-600" />,
            color: 'bg-blue-50 border-blue-200',
            textColor: 'text-blue-900'
        },
        {
            title: 'بانتظار الموافقة',
            value: summary?.waitingApproval || 0,
            icon: <AlertCircle className="w-5 h-5 text-orange-600" />,
            color: 'bg-orange-50 border-orange-200',
            textColor: 'text-orange-900'
        },
        {
            title: 'تم الإصلاح',
            value: summary?.completed || 0,
            icon: <CheckCircle className="w-5 h-5 text-green-600" />,
            color: 'bg-green-50 border-green-200',
            textColor: 'text-green-900'
        },
    ];

    return (
        <div className="p-6 space-y-6" dir="rtl">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
                        <MapPin className="text-primary" />
                        متابعة الماكينات
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        تتبع حالة ماكينات فرعك في مراكز الصيانة
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleExport}>
                        <Download size={16} className="ml-2" />
                        تصدير
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
                                        {isLoading ? '-' : stat.value}
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
                        <div className="flex-1 relative">
                            <Package className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                            <Input
                                placeholder="البحث برقم السريال، الموديل، أو المشكلة..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pr-10"
                            />
                        </div>

                        <Select value={filterStatus || 'ALL'} onValueChange={(value) => setFilterStatus(value === 'ALL' ? '' : value)}>
                            <SelectTrigger className="w-[200px]">
                                <Clock size={16} className="ml-2" />
                                <SelectValue placeholder="فلترة حسب الحالة" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">كل الحالات</SelectItem>
                                <SelectItem value="NEW">تم الاستلام</SelectItem>
                                <SelectItem value="UNDER_INSPECTION">تحت الفحص</SelectItem>
                                <SelectItem value="REPAIRING">قيد الإصلاح</SelectItem>
                                <SelectItem value="WAITING_APPROVAL">بانتظار الموافقة</SelectItem>
                                <SelectItem value="REPAIRED">تم الإصلاح</SelectItem>
                                <SelectItem value="TOTAL_LOSS">خسارة كلية</SelectItem>
                                <SelectItem value="IN_RETURN_TRANSIT">في طريق العودة</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Machines Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Building2 className="w-5 h-5" />
                        الماكينات في مراكز الصيانة
                        <Badge variant="secondary" className="mr-2">
                            {filteredMachines?.length || 0}
                        </Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="text-center py-12">
                            <Loader2 className="animate-spin mx-auto mb-4" size={32} />
                            <p className="text-muted-foreground">جاري تحميل البيانات...</p>
                        </div>
                    ) : filteredMachines?.length === 0 ? (
                        <div className="text-center py-12">
                            <Package className="mx-auto mb-4 text-gray-300" size={48} />
                            <p className="text-muted-foreground">لا توجد ماكينات في مراكز الصيانة</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>السريال</TableHead>
                                        <TableHead>المركز</TableHead>
                                        <TableHead>الحالة</TableHead>
                                        <TableHead>المشكلة</TableHead>
                                        <TableHead>الأيام في المركز</TableHead>
                                        <TableHead>آخر تحديث</TableHead>
                                        <TableHead>التفاصيل</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredMachines.map((machine) => {
                                        const status = statusConfig[machine.status] || {
                                            label: machine.status,
                                            color: 'bg-gray-100 text-gray-700 border-gray-200',
                                            icon: <Package size={16} />
                                        };
                                        const needsApproval = machine.status === 'WAITING_APPROVAL' && machine.approvalStatus === 'PENDING';

                                        return (
                                            <TableRow
                                                key={machine.id}
                                                className={`hover:bg-muted/50 cursor-pointer ${needsApproval ? 'bg-orange-50/50' : ''}`}
                                                onClick={() => setSelectedMachine(machine)}
                                            >
                                                <TableCell>
                                                    <div className="font-mono font-bold">{machine.serialNumber}</div>
                                                    <div className="text-xs text-muted-foreground">{machine.model}</div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <Building2 size={14} className="text-muted-foreground" />
                                                        <span>{machine.centerName}</span>
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
                                                    <div className="max-w-xs truncate" title={machine.problem}>
                                                        {machine.problem || 'غير محدد'}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1">
                                                        <Calendar size={14} className="text-muted-foreground" />
                                                        <span className={machine.daysAtCenter > 7 ? 'text-orange-600 font-bold' : ''}>
                                                            {machine.daysAtCenter} يوم
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="text-sm">
                                                        {format(new Date(machine.lastUpdate), 'yyyy-MM-dd', { locale: ar })}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {machine.lastUpdateAction}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Button variant="ghost" size="sm">
                                                        <Eye size={16} className="ml-1" />
                                                        عرض
                                                    </Button>
                                                    {needsApproval && (
                                                        <Button
                                                            variant="destructive"
                                                            size="sm"
                                                            className="mr-2"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                navigate('/maintenance-approvals');
                                                            }}
                                                        >
                                                            <AlertCircle size={16} className="ml-1" />
                                                            موافقة مطلوبة
                                                        </Button>
                                                    )}
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

            {/* Machine Detail Modal */}
            {selectedMachine && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle className="flex items-center gap-2">
                                    <Package className="w-5 h-5" />
                                    تفاصيل الماكينة
                                </CardTitle>
                                <Button variant="ghost" size="sm" onClick={() => setSelectedMachine(null)}>
                                    إغلاق
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 bg-muted rounded-lg">
                                    <p className="text-sm text-muted-foreground">رقم السريال</p>
                                    <p className="font-mono font-bold">{selectedMachine.serialNumber}</p>
                                </div>
                                <div className="p-3 bg-muted rounded-lg">
                                    <p className="text-sm text-muted-foreground">الموديل</p>
                                    <p className="font-bold">{selectedMachine.model}</p>
                                </div>
                            </div>

                            <div className="p-4 bg-muted rounded-lg">
                                <p className="text-sm text-muted-foreground mb-2">الحالة الحالية</p>
                                <Badge
                                    variant="outline"
                                    className={`${statusConfig[selectedMachine.status].color} text-base px-3 py-1`}
                                >
                                    {statusConfig[selectedMachine.status].icon}
                                    {statusConfig[selectedMachine.status].label}
                                </Badge>
                                <p className="mt-2 text-sm text-muted-foreground">
                                    {statusConfig[selectedMachine.status].description}
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm text-muted-foreground">مركز الصيانة</p>
                                    <p className="font-bold flex items-center gap-2">
                                        <Building2 size={16} />
                                        {selectedMachine.centerName}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">الفني المسؤول</p>
                                    <p className="font-bold flex items-center gap-2">
                                        <User size={16} />
                                        {selectedMachine.technicianName || 'غير معين'}
                                    </p>
                                </div>
                            </div>

                            <div>
                                <p className="text-sm text-muted-foreground">وصف المشكلة</p>
                                <p className="p-3 bg-muted rounded-lg mt-1">{selectedMachine.problem || 'غير محدد'}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm text-muted-foreground">تاريخ الإرسال</p>
                                    <p className="flex items-center gap-2">
                                        <Calendar size={16} className="text-muted-foreground" />
                                        {format(new Date(selectedMachine.assignedAt), 'PPP', { locale: ar })}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">المدة في المركز</p>
                                    <p className="flex items-center gap-2">
                                        <Clock size={16} className="text-muted-foreground" />
                                        {selectedMachine.daysAtCenter} يوم
                                    </p>
                                </div>
                            </div>

                            {selectedMachine.estimatedCompletion && (
                                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                                    <p className="text-sm text-green-700 font-bold">تاريخ الانتهاء المتوقع</p>
                                    <p className="text-green-600">
                                        {format(new Date(selectedMachine.estimatedCompletion), 'PPP', { locale: ar })}
                                    </p>
                                </div>
                            )}

                            <div>
                                <p className="text-sm text-muted-foreground">آخر تحديث</p>
                                <p className="text-sm">
                                    {selectedMachine.lastUpdateAction} - {format(new Date(selectedMachine.lastUpdate), 'PPpp', { locale: ar })}
                                </p>
                            </div>
                        </CardContent>
                        <CardFooter className="flex justify-between">
                            <Button variant="outline" onClick={() => setSelectedMachine(null)}>
                                إغلاق
                            </Button>
                            {selectedMachine.status === 'WAITING_APPROVAL' && selectedMachine.approvalStatus === 'PENDING' && (
                                <Button
                                    onClick={() => {
                                        setSelectedMachine(null);
                                        navigate('/maintenance-approvals');
                                    }}
                                    className="bg-orange-600 hover:bg-orange-700"
                                >
                                    <AlertCircle size={16} className="ml-2" />
                                    الذهاب للموافقات
                                </Button>
                            )}
                        </CardFooter>
                    </Card>
                </div>
            )}
        </div>
    );
}
