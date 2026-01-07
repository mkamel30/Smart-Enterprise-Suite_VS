import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
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
    Search,
    RefreshCw,
    Filter
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { CloseRequestModal } from '../components/CloseRequestModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import toast from 'react-hot-toast';

interface ServiceAssignment {
    id: string;
    machineId: string;
    serialNumber: string;
    technicianId: string;
    technicianName: string;
    status: string;
    currentTechnicianName?: string;
    currentTechnicianId?: string;
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
    machine: {
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
    RECEIVED_AT_CENTER: { label: 'تم الاستلام', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: <Package size={14} /> },
    ASSIGNED: { label: 'معين', color: 'bg-indigo-50 text-indigo-700 border-indigo-200', icon: <User size={14} /> },
    UNDER_INSPECTION: { label: 'تحت الفحص', color: 'bg-yellow-50 text-yellow-700 border-yellow-200', icon: <Search size={14} /> },
    IN_PROGRESS: { label: 'جاري العمل', color: 'bg-purple-50 text-purple-700 border-purple-200', icon: <Wrench size={14} /> },
    PENDING_APPROVAL: { label: 'بانتظار الموافقة', color: 'bg-orange-50 text-orange-700 border-orange-200', icon: <Clock size={14} /> },
    AWAITING_APPROVAL: { label: 'بانتظار الموافقة', color: 'bg-orange-50 text-orange-700 border-orange-200', icon: <Clock size={14} /> },
    APPROVED: { label: 'تمت الموافقة', color: 'bg-green-50 text-green-700 border-green-200', icon: <CheckCircle size={14} /> },
    REJECTED: { label: 'مرفوض', color: 'bg-red-50 text-red-700 border-red-200', icon: <AlertCircle size={14} /> },
    COMPLETED: { label: 'مكتمل', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: <CheckCircle size={14} /> },
    READY_FOR_RETURN: { label: 'جاهز للإرجاع', color: 'bg-teal-50 text-teal-700 border-teal-200', icon: <CheckCircle size={14} /> },
    RETURNED: { label: 'تم الإرجاع', color: 'bg-gray-50 text-gray-700 border-gray-200', icon: <Package size={14} /> },
};

export default function TechnicianDashboard() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [selectedAssignment, setSelectedAssignment] = useState<ServiceAssignment | null>(null);
    const [showPartsModal, setShowPartsModal] = useState(false);
    const [inspectionModal, setInspectionModal] = useState<{ isOpen: boolean; assignmentId: string | null }>({ isOpen: false, assignmentId: null });
    const [approvalModal, setApprovalModal] = useState<{ isOpen: boolean; assignmentId: string | null }>({ isOpen: false, assignmentId: null });

    // Form Data
    const [inspectionNotes, setInspectionNotes] = useState('');
    const [approvalData, setApprovalData] = useState({ cost: 0, parts: '', notes: '' });

    const [filterStatus, setFilterStatus] = useState<string>('');

    // Fetch assignments/machines based on role
    // If Center Manager -> Fetch ALL machines in workflow
    // If Technician -> Fetch ONLY assigned to me
    const isManager = user?.role === 'CENTER_MANAGER' || user?.role === 'SUPER_ADMIN';

    const { data: machines, isLoading } = useQuery<ServiceAssignment[]>({
        queryKey: ['tech-dashboard-machines', user?.branchId, filterStatus],
        queryFn: async () => {
            if (isManager) {
                // Fetch all from track-machines (it returns mapped warehouse machines)
                const params = new URLSearchParams();
                if (user?.branchId) params.append('branchId', user.branchId);
                // We want ALL machines in center, so we actually need a different endpoint?
                // Or we can use kanban endpoint but it returns different structure?
                // Let's use track-machines/summary logic but for list
                // actually simpler: Use the kanban endpoint! It gives everything.
                const res = await api.get<any[]>('/machine-workflow/kanban');
                return res.map(m => ({
                    ...m,
                    technicianName: m.currentTechnicianName || 'غير معين',
                    // Map other fields if needed
                    machine: { model: m.model, manufacturer: m.manufacturer }
                }));
            } else {
                // Technician: Use service-assignments
                const params = new URLSearchParams();
                if (filterStatus) params.append('status', filterStatus);
                const res = await fetch(`/api/service-assignments?${params}`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });
                return res.json();
            }
        },
        refetchInterval: 30000,
        enabled: !!user
    });

    const { data: spareParts } = useQuery<any[]>({
        queryKey: ['spare-parts-inventory'],
        queryFn: () => api.getInventory() as any,
        enabled: !!user
    });

    // --- Actions ---

    const startWorkMutation = useApiMutation({
        mutationFn: async (id: string) => {
            // "Start Work" -> Move to UNDER_INSPECTION
            // But we first need to transition status
            await api.post(`/machine-workflow/${id}/transition`, {
                targetStatus: 'UNDER_INSPECTION',
                payload: { notes: 'Started work via Dashboard' }
            });
        },
        successMessage: 'تم بدء الفحص',
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tech-dashboard-machines'] })
    });

    const submitInspectionMutation = useApiMutation({
        mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
            // Technically "Start Work" already moved it to Under Inspection?
            // Or maybe "Start Work" button IS the inspection trigger?
            // Let's assume Start Work opens modal -> Submit -> Moves to Under Inspection
            await api.post(`/machine-workflow/${id}/transition`, {
                targetStatus: 'UNDER_INSPECTION',
                payload: { notes }
            });
        },
        successMessage: 'تم بدء الفحص',
        onSuccess: () => {
            setInspectionModal({ isOpen: false, assignmentId: null });
            queryClient.invalidateQueries({ queryKey: ['tech-dashboard-machines'] });
        }
    });

    const submitApprovalMutation = useApiMutation({
        mutationFn: async ({ id, data }: { id: string; data: any }) => {
            await api.post(`/machine-workflow/${id}/transition`, {
                targetStatus: 'AWAITING_APPROVAL',
                payload: data
            });
        },
        successMessage: 'تم إرسال طلب الموافقة',
        onSuccess: () => {
            setApprovalModal({ isOpen: false, assignmentId: null });
            queryClient.invalidateQueries({ queryKey: ['tech-dashboard-machines'] });
        }
    });

    const completeRepairMutation = useApiMutation({
        mutationFn: async ({ id, data }: { id: string; data: any }) => {
            // This maps to "READY_FOR_RETURN" transition
            await api.post(`/machine-workflow/${id}/transition`, {
                targetStatus: 'READY_FOR_RETURN',
                payload: {
                    resolution: 'REPAIRED',
                    ...data
                }
            });
        },
        successMessage: 'تم إتمام الصيانة',
        onSuccess: () => {
            setShowPartsModal(false);
            setSelectedAssignment(null);
            queryClient.invalidateQueries({ queryKey: ['tech-dashboard-machines'] });
        }
    });

    // --- Handlers ---

    const handleStartWork = (machine: ServiceAssignment) => {
        // If unassigned (manager view), warn? No, button shouldn't show.
        setInspectionNotes('');
        setInspectionModal({ isOpen: true, assignmentId: machine.id });
    };

    const handleFinishInspection = (machine: ServiceAssignment) => {
        // Option 1: Request Approval (if cost)
        // Option 2: Direct Repair (if no cost)
        // For simplicity, let's open the Approval Modal which can also be "Direct Repair" if 0 cost?
        // Actually user wants "Close Request" style
        setApprovalData({ cost: 0, parts: '', notes: '' });
        setApprovalModal({ isOpen: true, assignmentId: machine.id });
    };

    const handleComplete = (machine: ServiceAssignment) => {
        setSelectedAssignment(machine);
        setShowPartsModal(true);
    };

    const handleCloseRequestSubmit = async (data: any) => {
        if (!selectedAssignment) return;

        // Use the transition logic
        // If cost > 0, we might need approval logic? 
        // But if we are in "In Progress", we assume approval is done OR not needed?
        // Wait, "Close Request" style implies we add parts AND close.
        // If approval is needed, the backend transition logic handles it?
        // The CloseRequestModal returns { usedParts, totalCost, actionTaken, receiptNumber }

        // If we add parts here that have cost, and we are NOT in approved state, we might need to go to pending approval?
        // Let's assume if the tech is completing, they are finishing up.

        completeRepairMutation.mutate({
            id: selectedAssignment.id,
            data
        });
    };

    return (
        <div className="space-y-6" dir="rtl">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
                        <Wrench className="text-primary" />
                        طلبات الصيانة
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        {isManager ? 'إدارة جميع الماكينات وطلبات الصيانة في المركز' : 'الماكينات المعينة لك للعمل عليها'}
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="border rounded-lg px-3 py-2 text-sm bg-background"
                    >
                        <option value="">كل الحالات</option>
                        <option value="ASSIGNED">مهام جديدة</option>
                        <option value="IN_PROGRESS">جاري العمل</option>
                        <option value="PENDING_APPROVAL">بانتظار الموافقة</option>
                        <option value="READY_FOR_RETURN">جاهز للإرجاع</option>
                    </select>
                </div>
            </div>

            {/* List */}
            <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
                {isLoading ? (
                    <div className="p-12 text-center text-muted-foreground font-medium">جاري التحميل...</div>
                ) : !machines?.length ? (
                    <div className="p-12 text-center text-muted-foreground font-medium">لا توجد مهام حالياً</div>
                ) : (
                    <div className="divide-y">
                        {machines.map((machine) => {
                            const status = statusConfig[machine.status] || statusConfig.ASSIGNED;
                            const isMyTask = isManager || machine.technicianId === user?.id || machine.currentTechnicianId === user?.id;

                            return (
                                <div key={machine.id} className="p-5 hover:bg-muted/30 transition-colors">
                                    <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                                        {/* Info */}
                                        <div className="flex-1 space-y-2">
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono font-bold text-lg bg-slate-100 px-2 rounded">{machine.serialNumber}</span>
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1.5 border ${status.color}`}>
                                                    {status.icon}
                                                    {status.label}
                                                </span>
                                            </div>
                                            <div className="text-sm text-muted-foreground flex items-center gap-4">
                                                <span>الموديل: <strong className="text-foreground">{machine.machine?.model || 'غير محدد'}</strong></span>
                                                <span className="w-px h-3 bg-slate-300"></span>
                                                <span>العميل: <strong className="text-foreground">{machine.customerName || 'مخزن الفرع'}</strong></span>
                                                {isManager && (
                                                    <>
                                                        <span className="w-px h-3 bg-slate-300"></span>
                                                        <span>المختص: <strong className="text-foreground">{machine.technicianName}</strong></span>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="flex items-center gap-2">

                                            {/* Step 1: Assigned -> Start Inspection */}
                                            {machine.status === 'ASSIGNED' && isMyTask && (
                                                <Button size="sm" onClick={() => handleStartWork(machine)} className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm font-bold">
                                                    <Play size={16} className="ml-2" />
                                                    بدء الفحص
                                                </Button>
                                            )}

                                            {/* Step 2: Under Inspection -> Request Approval or Move to Repair */}
                                            {machine.status === 'UNDER_INSPECTION' && isMyTask && (
                                                <Button size="sm" onClick={() => handleFinishInspection(machine)} className="bg-orange-600 hover:bg-orange-700 text-white shadow-sm font-bold">
                                                    <Clock size={16} className="ml-2" />
                                                    طلب موافقة / تكلفة
                                                </Button>
                                            )}

                                            {/* Step 3: Approved/In Progress -> Complete */}
                                            {['IN_PROGRESS', 'APPROVED', 'REJECTED'].includes(machine.status) && isMyTask && (
                                                <Button size="sm" onClick={() => handleComplete(machine)} className="bg-green-600 hover:bg-green-700 text-white shadow-sm font-bold">
                                                    <CheckCircle size={16} className="ml-2" />
                                                    إتمام الصيانة
                                                </Button>
                                            )}

                                            {/* Status Info Only */}
                                            {(machine.status === 'PENDING_APPROVAL' || machine.status === 'AWAITING_APPROVAL') && (
                                                <span className="text-xs font-bold text-orange-600 bg-orange-50 px-3 py-1.5 rounded-lg border border-orange-100">
                                                    بانتظار موافقة الفرع...
                                                </span>
                                            )}

                                            {(machine.status === 'READY_FOR_RETURN' || machine.status === 'COMPLETED') && (
                                                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
                                                    جاهز للإرجاع
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Inspection Modal */}
            <Dialog open={inspectionModal.isOpen} onOpenChange={(open) => !open && setInspectionModal({ isOpen: false, assignmentId: null })}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>بدء الفحص</DialogTitle>
                        <DialogDescription>ملاحظات أولية قبل البدء</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <Label>ملاحظات الفحص</Label>
                        <Textarea
                            value={inspectionNotes}
                            onChange={(e) => setInspectionNotes(e.target.value)}
                            placeholder="حالة الماكينة، العطل الظاهري..."
                            className="min-h-25"
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setInspectionModal({ isOpen: false, assignmentId: null })}>إلغاء</Button>
                        <Button onClick={() => submitInspectionMutation.mutate({ id: inspectionModal.assignmentId!, notes: inspectionNotes })}>
                            تأكيد وبدء العمل
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Approval Request Modal */}
            <Dialog open={approvalModal.isOpen} onOpenChange={(open) => !open && setApprovalModal({ isOpen: false, assignmentId: null })}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>تقرير الفحص / طلب الموافقة</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>التكلفة التقديرية (ج.م)</Label>
                                <Input
                                    type="number"
                                    value={approvalData.cost}
                                    onChange={(e) => setApprovalData({ ...approvalData, cost: parseFloat(e.target.value) })}
                                />
                                <p className="text-xs text-muted-foreground">اتركه 0 إذا كانت صيانة مجانية</p>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>قطع الغيار المطلوبة</Label>
                            <Input
                                value={approvalData.parts}
                                onChange={(e) => setApprovalData({ ...approvalData, parts: e.target.value })}
                                placeholder="شاشة، بطارية..."
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>ملاحظات الفني</Label>
                            <Textarea
                                value={approvalData.notes}
                                onChange={(e) => setApprovalData({ ...approvalData, notes: e.target.value })}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setApprovalModal({ isOpen: false, assignmentId: null })}>إلغاء</Button>
                        <Button onClick={() => submitApprovalMutation.mutate({ id: approvalModal.assignmentId!, data: approvalData })}>
                            إرسال للفرع
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>


            {/* Completion Modal (Reuse CloseRequestModal) */}
            {showPartsModal && selectedAssignment && (
                <CloseRequestModal
                    request={{
                        id: selectedAssignment.id,
                        customer: { client_name: selectedAssignment.customerName || 'المخزن' },
                        posMachine: {
                            serialNumber: selectedAssignment.serialNumber,
                            model: selectedAssignment.machine?.model
                        },
                        complaint: 'صيانة بالمركز'
                    }}
                    spareParts={spareParts || []}
                    onClose={() => {
                        setShowPartsModal(false);
                        setSelectedAssignment(null);
                    }}
                    onSubmit={handleCloseRequestSubmit}
                />
            )}
        </div>
    );
}
