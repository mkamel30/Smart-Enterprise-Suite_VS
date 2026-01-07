import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApiMutation } from '../hooks/useApiMutation';
import {
    User,
    Play,
    CheckCircle,
    Clock,
    AlertCircle,
    Package,
    Wrench,
    Send
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { CloseRequestModal } from '../components/CloseRequestModal';

interface ServiceAssignment {
    id: string;
    machineId: string;
    serialNumber: string;
    technicianId: string;
    technicianName: string;
    status: string;
    usedParts?: string;
    totalCost: number;
    approvalStatus?: string;
    rejectionFlag: boolean;
    actionTaken?: string;
    resolution?: string;
    assignedAt: string;
    startedAt?: string;
    completedAt?: string;
    customerId?: string;
    customerName?: string;
    branchId: string;
    originBranchId: string;
    machine?: {
        model?: string;
        manufacturer?: string;
    };
    logs?: Array<{
        id: string;
        action: string;
        details?: string;
        performedBy: string;
        performedAt: string;
    }>;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    ASSIGNED: { label: 'معين', color: 'bg-blue-100 text-blue-700', icon: <User size={14} /> },
    IN_PROGRESS: { label: 'جاري العمل', color: 'bg-yellow-100 text-yellow-700', icon: <Wrench size={14} /> },
    PENDING_APPROVAL: { label: 'بانتظار الموافقة', color: 'bg-orange-100 text-orange-700', icon: <Clock size={14} /> },
    APPROVED: { label: 'تمت الموافقة', color: 'bg-green-100 text-green-700', icon: <CheckCircle size={14} /> },
    REJECTED: { label: 'مرفوض', color: 'bg-red-100 text-red-700', icon: <AlertCircle size={14} /> },
    COMPLETED: { label: 'مكتمل', color: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle size={14} /> },
    RETURNED: { label: 'تم الإرجاع', color: 'bg-gray-100 text-gray-700', icon: <Package size={14} /> },
};

export default function Assignments() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [selectedAssignment, setSelectedAssignment] = useState<ServiceAssignment | null>(null);
    const [showPartsModal, setShowPartsModal] = useState(false);
    const [filterStatus, setFilterStatus] = useState<string>('');

    // Fetch assignments for this center
    const { data: assignments, isLoading } = useQuery<ServiceAssignment[]>({
        queryKey: ['service-assignments', user?.branchId, filterStatus],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (user?.branchId) params.append('branchId', user.branchId);
            if (filterStatus) params.append('status', filterStatus);
            const res = await fetch(`/api/service-assignments?${params}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            return res.json();
        },
        refetchInterval: 30000
    });

    // Fetch spare parts for the modal
    const { data: spareParts } = useQuery<any[]>({
        queryKey: ['spare-parts-inventory'],
        queryFn: () => api.getInventory() as any,
        enabled: !!user
    });

    // Start work mutation
    const startMutation = useApiMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/service-assignments/${id}/start`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                }
            });
            if (!res.ok) throw new Error('Failed to start');
            return res.json();
        },
        successMessage: 'تم بدء العمل',
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['service-assignments'] });
        }
    });

    // Complete assignment mutation
    const completeMutation = useApiMutation({
        mutationFn: async ({ id, actionTaken, resolution }: { id: string; actionTaken: string; resolution: string }) => {
            const res = await fetch(`/api/service-assignments/${id}/complete`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ actionTaken, resolution })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to complete');
            }
            return res.json();
        },
        successMessage: 'تم إكمال الصيانة',
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['service-assignments'] });
            setSelectedAssignment(null);
            setShowPartsModal(false);
        }
    });

    const handleStartWork = (assignment: ServiceAssignment) => {
        startMutation.mutate(assignment.id);
    };

    const handleOpenParts = (assignment: ServiceAssignment) => {
        setSelectedAssignment(assignment);
        setShowPartsModal(true);
    };

    const handleCloseRequest = async (data: any) => {
        if (!selectedAssignment) return;

        // First update parts if any
        if (data.usedParts?.length > 0) {
            const paidParts = data.usedParts.filter((p: any) => p.isPaid && p.cost > 0);
            const totalCost = paidParts.reduce((sum: number, p: any) => sum + (p.cost * p.quantity), 0);

            // Update parts
            await fetch(`/api/service-assignments/${selectedAssignment.id}/update-parts`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ usedParts: data.usedParts, totalCost })
            });

            // If there are paid parts, request approval
            if (totalCost > 0) {
                await fetch(`/api/service-assignments/${selectedAssignment.id}/request-approval`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        requestedParts: paidParts,
                        totalRequestedCost: totalCost
                    })
                });

                queryClient.invalidateQueries({ queryKey: ['service-assignments'] });
                setShowPartsModal(false);
                setSelectedAssignment(null);
                return;
            }
        }

        // Complete directly if no paid parts
        completeMutation.mutate({
            id: selectedAssignment.id,
            actionTaken: data.actionTaken || '',
            resolution: 'REPAIRED'
        });
    };

    return (
        <div className="space-y-6" dir="rtl">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-foreground">التعيينات</h1>
                    <p className="text-muted-foreground text-sm">إدارة الماكينات المعينة للصيانة</p>
                </div>

                {/* Filter */}
                <div className="flex items-center gap-2">
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="border rounded-lg px-3 py-2 text-sm bg-background"
                    >
                        <option value="">كل الحالات</option>
                        <option value="ASSIGNED">معين</option>
                        <option value="IN_PROGRESS">جاري العمل</option>
                        <option value="PENDING_APPROVAL">بانتظار الموافقة</option>
                        <option value="APPROVED">تمت الموافقة</option>
                        <option value="REJECTED">مرفوض</option>
                        <option value="COMPLETED">مكتمل</option>
                    </select>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'معين', count: assignments?.filter(a => a.status === 'ASSIGNED').length || 0, color: 'blue' },
                    { label: 'جاري العمل', count: assignments?.filter(a => a.status === 'IN_PROGRESS').length || 0, color: 'yellow' },
                    { label: 'بانتظار الموافقة', count: assignments?.filter(a => a.status === 'PENDING_APPROVAL').length || 0, color: 'orange' },
                    { label: 'مكتمل', count: assignments?.filter(a => a.status === 'COMPLETED').length || 0, color: 'green' },
                ].map((stat, i) => (
                    <div key={i} className={`bg-${stat.color}-50 border border-${stat.color}-100 rounded-xl p-4`}>
                        <div className={`text-2xl font-black text-${stat.color}-700`}>{stat.count}</div>
                        <div className={`text-xs font-bold text-${stat.color}-600`}>{stat.label}</div>
                    </div>
                ))}
            </div>

            {/* Assignments List */}
            <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
                {isLoading ? (
                    <div className="p-8 text-center text-muted-foreground">جاري التحميل...</div>
                ) : !assignments?.length ? (
                    <div className="p-8 text-center text-muted-foreground">لا توجد تعيينات</div>
                ) : (
                    <div className="divide-y">
                        {assignments.map((assignment) => {
                            const status = statusConfig[assignment.status] || statusConfig.ASSIGNED;
                            return (
                                <div key={assignment.id} className="p-4 hover:bg-muted/50 transition-colors">
                                    <div className="flex items-start justify-between gap-4">
                                        {/* Machine Info */}
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-mono font-bold text-lg">{assignment.serialNumber}</span>
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 ${status.color}`}>
                                                    {status.icon}
                                                    {status.label}
                                                </span>
                                                {assignment.rejectionFlag && (
                                                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
                                                        موافقة مرفوضة
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-sm text-muted-foreground space-y-0.5">
                                                <div>العميل: <span className="font-bold text-foreground">{assignment.customerName || 'غير محدد'}</span></div>
                                                <div>الموديل: <span className="font-bold text-foreground">{assignment.machine?.model || 'غير محدد'}</span></div>
                                                <div>المختص: <span className="font-bold text-foreground">{assignment.technicianName}</span></div>
                                            </div>
                                            {assignment.totalCost > 0 && (
                                                <div className="mt-2 text-sm">
                                                    <span className="font-bold text-green-700">التكلفة: {assignment.totalCost} ج.م</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Actions */}
                                        <div className="flex flex-col gap-2">
                                            {assignment.status === 'ASSIGNED' && (
                                                <Button
                                                    size="sm"
                                                    onClick={() => handleStartWork(assignment)}
                                                    className="bg-blue-600 hover:bg-blue-700"
                                                >
                                                    <Play size={14} className="ml-1" />
                                                    بدء العمل
                                                </Button>
                                            )}

                                            {(assignment.status === 'IN_PROGRESS' || assignment.status === 'APPROVED' || assignment.status === 'REJECTED') && (
                                                <Button
                                                    size="sm"
                                                    onClick={() => handleOpenParts(assignment)}
                                                    className="bg-green-600 hover:bg-green-700"
                                                >
                                                    <Wrench size={14} className="ml-1" />
                                                    إضافة قطع / إتمام
                                                </Button>
                                            )}

                                            {assignment.status === 'PENDING_APPROVAL' && (
                                                <div className="text-xs text-orange-600 font-bold text-center">
                                                    <Clock size={14} className="inline ml-1" />
                                                    بانتظار رد الفرع
                                                </div>
                                            )}

                                            {assignment.status === 'COMPLETED' && (
                                                <div className="text-xs text-green-600 font-bold text-center">
                                                    <CheckCircle size={14} className="inline ml-1" />
                                                    مكتملة
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Recent Logs */}
                                    {assignment.logs && assignment.logs.length > 0 && (
                                        <div className="mt-3 pt-3 border-t border-dashed">
                                            <div className="text-xs text-muted-foreground">
                                                <span className="font-bold">آخر نشاط:</span>{' '}
                                                {assignment.logs[0].details} - {assignment.logs[0].performedBy}{' '}
                                                ({new Date(assignment.logs[0].performedAt).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })})
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Parts Modal - Using existing CloseRequestModal */}
            {showPartsModal && selectedAssignment && (
                <CloseRequestModal
                    request={{
                        id: selectedAssignment.id,
                        customer: { client_name: selectedAssignment.customerName },
                        posMachine: {
                            serialNumber: selectedAssignment.serialNumber,
                            model: selectedAssignment.machine?.model
                        },
                        complaint: 'صيانة مركز'
                    }}
                    spareParts={spareParts || []}
                    onClose={() => {
                        setShowPartsModal(false);
                        setSelectedAssignment(null);
                    }}
                    onSubmit={handleCloseRequest}
                />
            )}
        </div>
    );
}
