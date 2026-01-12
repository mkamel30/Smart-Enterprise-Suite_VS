"use client";
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApiMutation } from '../hooks/useApiMutation';
import {
    CheckCircle,
    XCircle,
    Clock,
    Package,
    AlertTriangle
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { translateStatus } from '../lib/translations';

interface ApprovalRequest {
    id: string;
    assignmentId: string;
    machineSerial: string;
    customerId: string;
    customerName: string;
    requestedParts: string;
    totalRequestedCost: number;
    status: string;
    rejectionReason?: string;
    respondedBy?: string;
    respondedAt?: string;
    centerBranchId: string;
    targetBranchId: string;
    createdAt: string;
}

export default function MaintenanceApprovals() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null);
    const [showRejectDialog, setShowRejectDialog] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('PENDING');

    // Fetch approval requests for this branch
    const { data: requests, isLoading } = useQuery<ApprovalRequest[]>({
        queryKey: ['maintenance-approvals', user?.branchId, filterStatus],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (user?.branchId) params.append('branchId', user.branchId);
            if (filterStatus) params.append('status', filterStatus);
            const res = await fetch(`/api/maintenance-approvals?${params}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            return res.json();
        },
        refetchInterval: 30000
    });

    // Approve mutation
    const approveMutation = useApiMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/maintenance-approvals/${id}/approve`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                }
            });
            if (!res.ok) throw new Error('Failed to approve');
            return res.json();
        },
        successMessage: 'تمت الموافقة بنجاح',
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['maintenance-approvals'] });
            setSelectedRequest(null);
        }
    });

    // Reject mutation
    const rejectMutation = useApiMutation({
        mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
            const res = await fetch(`/api/maintenance-approvals/${id}/reject`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ rejectionReason: reason })
            });
            if (!res.ok) throw new Error('Failed to reject');
            return res.json();
        },
        successMessage: 'تم الرفض',
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['maintenance-approvals'] });
            setSelectedRequest(null);
            setShowRejectDialog(false);
            setRejectionReason('');
        }
    });

    const handleApprove = (request: ApprovalRequest) => {
        approveMutation.mutate(request.id);
    };

    const handleReject = () => {
        if (selectedRequest) {
            rejectMutation.mutate({ id: selectedRequest.id, reason: rejectionReason });
        }
    };

    const openRejectDialog = (request: ApprovalRequest) => {
        setSelectedRequest(request);
        setShowRejectDialog(true);
    };

    const getParts = (partsJson: string) => {
        try {
            return JSON.parse(partsJson);
        } catch {
            return [];
        }
    };

    return (
        <div className="space-y-6" dir="rtl">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-foreground">موافقات الصيانة</h1>
                    <p className="text-muted-foreground text-sm">مراجعة طلبات الموافقة من مركز الصيانة</p>
                </div>

                {/* Filter */}
                <div className="flex items-center gap-2">
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="border rounded-lg px-3 py-2 text-sm bg-background"
                    >
                        <option value="">كل الطلبات</option>
                        <option value="PENDING">{translateStatus('PENDING')}</option>
                        <option value="APPROVED">{translateStatus('APPROVED')}</option>
                        <option value="REJECTED">{translateStatus('REJECTED')}</option>
                    </select>
                </div>
            </div>

            {/* Pending Count */}
            {requests && requests.filter(r => r.status === 'PENDING').length > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center gap-3">
                    <AlertTriangle className="text-orange-600" size={24} />
                    <div>
                        <div className="font-bold text-orange-800">
                            لديك {requests.filter(r => r.status === 'PENDING').length} طلب بانتظار الموافقة
                        </div>
                        <div className="text-sm text-orange-600">يرجى مراجعة الطلبات واتخاذ القرار</div>
                    </div>
                </div>
            )}

            {/* Requests List */}
            <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
                {isLoading ? (
                    <div className="p-8 text-center text-muted-foreground">جاري التحميل...</div>
                ) : !requests?.length ? (
                    <div className="p-8 text-center text-muted-foreground">
                        <Package size={48} className="mx-auto mb-2 opacity-30" />
                        لا توجد طلبات موافقة
                    </div>
                ) : (
                    <div className="divide-y">
                        {requests.map((request) => {
                            const parts = getParts(request.requestedParts);
                            const isPending = request.status === 'PENDING';

                            return (
                                <div key={request.id} className={`p-4 ${isPending ? 'bg-orange-50/50' : ''}`}>
                                    <div className="flex items-start justify-between gap-4">
                                        {/* Request Info */}
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="font-mono font-bold text-lg">{request.machineSerial}</span>
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${request.status === 'PENDING' ? 'bg-orange-100 text-orange-700' :
                                                    request.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                                                        'bg-red-100 text-red-700'
                                                    }`}>
                                                    {translateStatus(request.status)}
                                                </span>
                                            </div>

                                            <div className="text-sm text-muted-foreground mb-2">
                                                <div>العميل: <span className="font-bold text-foreground">{request.customerName || 'غير محدد'}</span></div>
                                                <div>تاريخ الطلب: {new Date(request.createdAt).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })}</div>
                                            </div>

                                            {/* Parts List */}
                                            <div className="bg-white rounded-lg border p-3 mt-2">
                                                <div className="text-xs font-bold text-muted-foreground mb-2">القطع المطلوبة:</div>
                                                <div className="space-y-1">
                                                    {parts.map((part: any, i: number) => (
                                                        <div key={i} className="flex justify-between text-sm">
                                                            <span>{part.name} × {part.quantity}</span>
                                                            <span className="font-bold">{part.cost * part.quantity} ج.م</span>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="mt-2 pt-2 border-t flex justify-between font-bold">
                                                    <span>الإجمالي:</span>
                                                    <span className="text-green-700">{request.totalRequestedCost} ج.م</span>
                                                </div>
                                            </div>

                                            {request.rejectionReason && (
                                                <div className="mt-2 text-sm text-red-600">
                                                    <span className="font-bold">سبب الرفض:</span> {request.rejectionReason}
                                                </div>
                                            )}
                                        </div>

                                        {/* Actions */}
                                        {isPending && (
                                            <div className="flex flex-col gap-2">
                                                <Button
                                                    size="sm"
                                                    onClick={() => handleApprove(request)}
                                                    className="bg-green-600 hover:bg-green-700"
                                                    disabled={approveMutation.isPending}
                                                >
                                                    <CheckCircle size={14} className="ml-1" />
                                                    موافقة
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="destructive"
                                                    onClick={() => openRejectDialog(request)}
                                                    disabled={rejectMutation.isPending}
                                                >
                                                    <XCircle size={14} className="ml-1" />
                                                    رفض
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Reject Dialog */}
            <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
                <DialogContent dir="rtl">
                    <DialogHeader>
                        <DialogTitle>رفض طلب الموافقة</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <label className="block text-sm font-bold mb-2">سبب الرفض (اختياري)</label>
                        <textarea
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            className="w-full border rounded-lg p-3 text-sm bg-background"
                            rows={3}
                            placeholder="أدخل سبب الرفض..."
                        />
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
                            إلغاء
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleReject}
                            disabled={rejectMutation.isPending}
                        >
                            تأكيد الرفض
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
