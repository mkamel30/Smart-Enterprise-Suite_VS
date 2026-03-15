"use client";

import React, { useState, useMemo, useEffect } from 'react';
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
    Loader2,
    X,
    TrendingUp
} from 'lucide-react';
import { motion } from 'framer-motion';
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

    // ESC key handler for modals
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setSelectedMachine(null);
            }
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, []);

    // Fetch tracked machines for branch
    const { data: machinesResponse, isLoading, refetch } = useQuery<BranchTrackedMachine[]>({
        queryKey: ['track-machines', activeBranchId, user?.branchId, filterStatus],
        queryFn: async () => {
            const branchId = activeBranchId || user?.branchId;
            if (!branchId) return [];
            return api.getBranchMachinesAtCenter(branchId);
        },
        enabled: !!(activeBranchId || user?.branchId),
        refetchInterval: 30000, // Auto refresh every 30 seconds
    });

    // Extract machines array from response
    const machines = Array.isArray(machinesResponse) ? machinesResponse : [];

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
            icon: <Package size={22} />,
            color: 'text-blue-600',
            bgColor: 'bg-blue-50',
            subtitle: 'جميع الماكينات بالمراكز'
        },
        {
            title: 'تحت الفحص',
            value: summary?.underInspection || 0,
            icon: <Clock size={22} />,
            color: 'text-yellow-600',
            bgColor: 'bg-yellow-50',
            subtitle: 'فحص فني أولى'
        },
        {
            title: 'قيد الإصلاح',
            value: summary?.inRepair || 0,
            icon: <Wrench size={22} />,
            color: 'text-indigo-600',
            bgColor: 'bg-indigo-50',
            subtitle: 'عمليات صيانة جارية'
        },
        {
            title: 'بانتظار الموافقة',
            value: summary?.waitingApproval || 0,
            icon: <AlertCircle size={22} />,
            color: 'text-orange-600',
            bgColor: 'bg-orange-50',
            subtitle: 'فحص التكلفة والقطع'
        },
        {
            title: 'تم الإصلاح',
            value: summary?.completed || 0,
            icon: <CheckCircle size={22} />,
            color: 'text-emerald-600',
            bgColor: 'bg-emerald-50',
            subtitle: 'جاهزة للتسليم'
        },
    ];

    return (
        <div className="px-8 pt-6 pb-20 bg-slate-50/50 min-h-screen" dir="rtl">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-white rounded-[1.5rem] shadow-xl shadow-blue-500/10 flex items-center justify-center text-blue-600 border border-blue-50">
                        <MapPin size={32} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">متابعة الماكينات بالمراكز</h1>
                        <p className="text-slate-400 font-bold text-sm mt-1 uppercase tracking-widest flex items-center gap-2">
                            <TrendingUp size={14} className="text-emerald-500" />
                            تتبع العمليات والاعتمادات في الوقت الفعلي
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleExport}
                        className="px-6 py-3.5 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 hover:shadow-lg transition-all flex items-center gap-2"
                    >
                        <Download size={18} />
                        تصدير التقرير
                    </button>
                    <button
                        onClick={() => refetch()}
                        className="px-6 py-3.5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 shadow-xl shadow-slate-900/20 transition-all flex items-center gap-2"
                    >
                        <RefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
                        تحديث البيانات
                    </button>
                </div>
            </div>

            {/* Premium Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-10">
                {statsCards.map((stat, index) => (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        key={index}
                        className="bg-white p-6 rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col gap-4 group hover:-translate-y-1 transition-all duration-300"
                    >
                        <div className={`w-12 h-12 ${stat.bgColor} ${stat.color} rounded-2xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform`}>
                            {stat.icon}
                        </div>
                        <div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-black text-slate-900 font-mono tracking-tighter">
                                    {isLoading ? '-' : stat.value}
                                </span>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">وحدة</span>
                            </div>
                            <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mt-1">{stat.title}</h4>
                            <p className="text-[10px] font-bold text-slate-400 mt-2 border-t pt-2 border-slate-50">{stat.subtitle}</p>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Filters & Actions Area */}
            <div className="bg-white/50 backdrop-blur-md rounded-[2.5rem] p-4 border border-white shadow-xl shadow-slate-200/30 mb-8 flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-1 group w-full">
                    <Package size={20} className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                    <input
                        type="text"
                        placeholder="البحث برقم السريال، الموديل، أو المشكلة..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white border border-slate-100 rounded-[1.5rem] py-4 pr-14 pl-6 text-sm font-bold text-slate-700 focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-200 transition-all shadow-sm"
                    />
                </div>

                <div className="flex gap-4 w-full md:w-auto">
                    <select
                        value={filterStatus || 'ALL'}
                        onChange={(e) => setFilterStatus(e.target.value === 'ALL' ? '' : e.target.value)}
                        className="bg-white border border-slate-100 rounded-[1.5rem] py-4 px-8 text-sm font-black text-slate-600 focus:outline-none focus:ring-4 focus:ring-blue-500/5 transition-all shadow-sm cursor-pointer min-w-[220px]"
                    >
                        <option value="ALL">كل الحالات التشغيلية</option>
                        {Object.entries(statusConfig).map(([key, value]) => (
                            <option key={key} value={key}>{value.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Premium Table Container */}
            <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto custom-scroll">
                    <table className="w-full text-right border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">البيانات الفنية</th>
                                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">موقع الصيانة</th>
                                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">الحالة التشغيلية</th>
                                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">مدة الانتظار</th>
                                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">الإجراءات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={5} className="p-20 text-center">
                                        <div className="flex flex-col items-center gap-4">
                                            <div className="w-12 h-12 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin" />
                                            <p className="text-sm font-black text-slate-400 uppercase tracking-widest">جاري سحب البيانات من السيرفر...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredMachines?.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-20 text-center">
                                        <div className="flex flex-col items-center gap-4 opacity-30">
                                            <Package size={64} strokeWidth={1} />
                                            <p className="text-sm font-black uppercase tracking-widest">لا توجد سجلات مطابقة</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredMachines.map((machine) => {
                                    const status = statusConfig[machine.status] || {
                                        label: machine.status,
                                        color: 'bg-gray-100 text-gray-700',
                                        icon: <Package size={16} />
                                    };
                                    const needsApproval = machine.status === 'WAITING_APPROVAL' && machine.approvalStatus === 'PENDING';

                                    return (
                                        <tr
                                            key={machine.id}
                                            className={`group hover:bg-slate-50/50 transition-colors cursor-pointer ${needsApproval ? 'bg-orange-50/30' : ''}`}
                                            onClick={() => setSelectedMachine(machine)}
                                        >
                                            <td className="p-6">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-slate-900 group-hover:text-white transition-all shadow-inner">
                                                        <Package size={20} strokeWidth={2.5} />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-black text-slate-900 tracking-tight font-mono">{machine.serialNumber}</span>
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{machine.model}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-6 text-sm font-bold text-slate-600">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400"><Building2 size={16} /></div>
                                                    {machine.centerName}
                                                </div>
                                            </td>
                                            <td className="p-6">
                                                <div className="flex flex-col gap-2">
                                                    <span className={`px-4 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-widest w-fit shadow-sm border ${status.color}`}>
                                                        {status.label}
                                                    </span>
                                                    {machine.approvalStatus && (
                                                        <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest w-fit border ${approvalStatusConfig[machine.approvalStatus].color}`}>
                                                            {approvalStatusConfig[machine.approvalStatus].label}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-6">
                                                <div className="flex flex-col">
                                                    <div className="flex items-baseline gap-1">
                                                        <span className={`text-lg font-black font-mono ${machine.daysAtCenter > 7 ? 'text-orange-600 underline decoration-2 decoration-orange-200 underline-offset-4' : 'text-slate-900'}`}>{machine.daysAtCenter}</span>
                                                        <span className="text-[10px] font-bold text-slate-400">أيـام</span>
                                                    </div>
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-tight mt-1">منذ تاريخ التعيين</span>
                                                </div>
                                            </td>
                                            <td className="p-6">
                                                <div className="flex gap-2 justify-center">
                                                    <button className="w-10 h-10 bg-white border border-slate-100 text-slate-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 rounded-xl transition-all flex items-center justify-center shadow-sm">
                                                        <Eye size={18} strokeWidth={2.5} />
                                                    </button>
                                                    {needsApproval && (
                                                        <button
                                                            className="px-4 h-10 bg-orange-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-orange-500/20 hover:bg-orange-700 transition-all flex items-center gap-2"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                navigate('/maintenance-approvals');
                                                            }}
                                                        >
                                                            <AlertCircle size={14} />
                                                            موافقة معلقة
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Machine Detail Modal */}
            {selectedMachine && (
                <div className="modal-overlay" onClick={() => setSelectedMachine(null)}>
                    <div className="modal-container md:max-w-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-header-content">
                                <Package className="modal-icon text-primary" size={24} />
                                <h2 className="modal-title">تفاصيل الماكينة</h2>
                            </div>
                            <button type="button" className="modal-close" onClick={() => setSelectedMachine(null)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl shadow-sm">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">رقم السريال</p>
                                    <p className="font-mono font-bold text-slate-900">{selectedMachine.serialNumber}</p>
                                </div>
                                <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl shadow-sm">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">الموديل</p>
                                    <p className="font-bold text-slate-900">{selectedMachine.model}</p>
                                </div>
                            </div>

                            <div className="p-5 bg-gradient-to-br from-slate-50 to-blue-50/30 border-2 border-primary/5 rounded-2xl">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">الحالة الحالية</p>
                                <div className="flex items-center gap-3">
                                    <Badge
                                        variant="outline"
                                        className={`${statusConfig[selectedMachine.status].color} text-base px-4 py-2 rounded-xl flex items-center gap-2 shadow-sm border-2`}
                                    >
                                        {statusConfig[selectedMachine.status].icon}
                                        {statusConfig[selectedMachine.status].label}
                                    </Badge>
                                </div>
                                <p className="mt-3 text-sm font-bold text-slate-600 leading-relaxed pr-2">
                                    {statusConfig[selectedMachine.status].description}
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div className="flex items-start gap-3">
                                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                                            <Building2 size={18} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">مركز الصيانة</p>
                                            <p className="font-bold text-slate-800">{selectedMachine.centerName}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                                            <User size={18} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">الفني المسؤول</p>
                                            <p className="font-bold text-slate-800">{selectedMachine.technicianName || 'غير معين'}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-4 border-r pr-6 border-slate-100">
                                    <div className="flex items-start gap-3">
                                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                            <Calendar size={18} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">تاريخ الإرسال</p>
                                            <p className="font-bold text-slate-800">{format(new Date(selectedMachine.assignedAt), 'PPP', { locale: ar })}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
                                            <Clock size={18} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">المدة في المركز</p>
                                            <p className="font-bold text-slate-800">{selectedMachine.daysAtCenter} يوم</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="modal-form-field">
                                <label className="modal-form-label">وصف المشكلة</label>
                                <div className="p-4 bg-red-50/30 border border-red-100 rounded-xl text-red-900 font-bold text-sm leading-relaxed">
                                    {selectedMachine.problem || 'غير محدد'}
                                </div>
                            </div>

                            {selectedMachine.estimatedCompletion && (
                                <div className="p-4 bg-emerald-50 border-2 border-emerald-100 rounded-2xl flex items-center gap-4">
                                    <div className="p-3 bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-200">
                                        <Calendar size={24} />
                                    </div>
                                    <div>
                                        <p className="text-xs font-black text-emerald-800 mb-0.5">تاريخ الانتهاء المتوقع</p>
                                        <p className="text-lg font-black text-emerald-600">
                                            {format(new Date(selectedMachine.estimatedCompletion), 'PPP', { locale: ar })}
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="pt-4 border-t border-slate-100">
                                <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 bg-slate-50 py-2 px-4 rounded-full w-fit">
                                    <RefreshCw size={12} className="animate-spin-slow" />
                                    آخر تحديث: {selectedMachine.lastUpdateAction} - {format(new Date(selectedMachine.lastUpdate), 'PPpp', { locale: ar })}
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button
                                onClick={() => setSelectedMachine(null)}
                                className="smart-btn-secondary"
                            >
                                إغلاق النافذة
                            </button>
                            {selectedMachine.status === 'WAITING_APPROVAL' && selectedMachine.approvalStatus === 'PENDING' && (
                                <button
                                    onClick={() => {
                                        setSelectedMachine(null);
                                        navigate('/maintenance-approvals');
                                    }}
                                    className="smart-btn-primary bg-orange-600 hover:bg-orange-700 shadow-orange-200"
                                >
                                    <AlertCircle size={18} />
                                    الذهاب لصفحة الموافقات
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
