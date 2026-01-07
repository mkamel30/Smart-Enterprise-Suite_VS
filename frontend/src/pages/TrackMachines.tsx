import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
    Eye,
    Clock,
    CheckCircle,
    AlertCircle,
    User,
    Wrench,
    Package,
    RefreshCw
} from 'lucide-react';

interface TrackedMachine {
    id: string;
    serialNumber: string;
    status: string;
    technicianName: string;
    customerName?: string;
    totalCost: number;
    assignedAt: string;
    startedAt?: string;
    completedAt?: string;
    rejectionFlag: boolean;
    machine?: {
        model?: string;
        manufacturer?: string;
    };
    logs?: Array<{
        action: string;
        details?: string;
        performedBy: string;
        performedAt: string;
    }>;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    ASSIGNED: { label: 'تم التعيين', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: <User size={16} /> },
    IN_PROGRESS: { label: 'جاري العمل', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: <Wrench size={16} /> },
    PENDING_APPROVAL: { label: 'بانتظار موافقتك', color: 'bg-orange-100 text-orange-700 border-orange-200', icon: <Clock size={16} /> },
    APPROVED: { label: 'تمت الموافقة', color: 'bg-green-100 text-green-700 border-green-200', icon: <CheckCircle size={16} /> },
    REJECTED: { label: 'مرفوض', color: 'bg-red-100 text-red-700 border-red-200', icon: <AlertCircle size={16} /> },
    COMPLETED: { label: 'مكتملة', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: <CheckCircle size={16} /> },
    IN_RETURN_TRANSIT: { label: 'في طريق العودة', color: 'bg-purple-100 text-purple-700 border-purple-200', icon: <Package size={16} /> },
    RETURNED: { label: 'تم الإرجاع', color: 'bg-gray-100 text-gray-700 border-gray-200', icon: <Package size={16} /> },
};

export default function TrackMachines() {
    const { user } = useAuth();
    const [filterStatus, setFilterStatus] = useState<string>('');

    // Fetch tracked machines (machines sent from this branch to center)
    const { data: machines, isLoading, refetch } = useQuery<TrackedMachine[]>({
        queryKey: ['track-machines', user?.branchId, filterStatus],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (user?.branchId) params.append('branchId', user.branchId);
            if (filterStatus) params.append('status', filterStatus);
            const res = await fetch(`/api/track-machines?${params}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            return res.json();
        },
        refetchInterval: 30000
    });

    // Fetch summary
    const { data: summary } = useQuery({
        queryKey: ['track-machines-summary', user?.branchId],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (user?.branchId) params.append('branchId', user.branchId);
            const res = await fetch(`/api/track-machines/summary?${params}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            return res.json();
        }
    });

    return (
        <div className="space-y-6" dir="rtl">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
                        <Eye className="text-primary" />
                        متابعة الماكينات
                    </h1>
                    <p className="text-muted-foreground text-sm">تتبع حالة ماكيناتك في مركز الصيانة</p>
                </div>

                <div className="flex items-center gap-2">
                    {/* Filter */}
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="border rounded-lg px-3 py-2 text-sm bg-background"
                    >
                        <option value="">كل الحالات</option>
                        <option value="ASSIGNED">تم التعيين</option>
                        <option value="IN_PROGRESS">جاري العمل</option>
                        <option value="PENDING_APPROVAL">بانتظار الموافقة</option>
                        <option value="COMPLETED">مكتملة</option>
                    </select>

                    <button
                        onClick={() => refetch()}
                        className="p-2 border rounded-lg hover:bg-muted transition-colors"
                        title="تحديث"
                    >
                        <RefreshCw size={18} />
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            {summary && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div className="bg-card rounded-xl border p-4 text-center">
                        <div className="text-2xl font-black text-primary">{summary.total || 0}</div>
                        <div className="text-xs text-muted-foreground font-bold">إجمالي</div>
                    </div>
                    <div className="bg-yellow-50 rounded-xl border border-yellow-100 p-4 text-center">
                        <div className="text-2xl font-black text-yellow-700">{summary.inProgress || 0}</div>
                        <div className="text-xs text-yellow-600 font-bold">جاري العمل</div>
                    </div>
                    <div className="bg-orange-50 rounded-xl border border-orange-100 p-4 text-center">
                        <div className="text-2xl font-black text-orange-700">{summary.pendingApproval || 0}</div>
                        <div className="text-xs text-orange-600 font-bold">بانتظار موافقتك</div>
                    </div>
                    <div className="bg-green-50 rounded-xl border border-green-100 p-4 text-center">
                        <div className="text-2xl font-black text-green-700">{summary.completed || 0}</div>
                        <div className="text-xs text-green-600 font-bold">مكتملة</div>
                    </div>
                    <div className="bg-blue-50 rounded-xl border border-blue-100 p-4 text-center">
                        <div className="text-2xl font-black text-blue-700">{summary.assigned || 0}</div>
                        <div className="text-xs text-blue-600 font-bold">معينة</div>
                    </div>
                </div>
            )}

            {/* Machines List */}
            <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
                {isLoading ? (
                    <div className="p-8 text-center text-muted-foreground">
                        <RefreshCw className="animate-spin mx-auto mb-2" size={24} />
                        جاري التحميل...
                    </div>
                ) : !machines?.length ? (
                    <div className="p-8 text-center text-muted-foreground">
                        <Package size={48} className="mx-auto mb-2 opacity-30" />
                        لا توجد ماكينات في مركز الصيانة
                    </div>
                ) : (
                    <div className="divide-y">
                        {machines.map((machine) => {
                            const status = statusConfig[machine.status] || statusConfig.ASSIGNED;
                            const needsAction = machine.status === 'PENDING_APPROVAL';

                            return (
                                <div
                                    key={machine.id}
                                    className={`p-4 transition-colors ${needsAction ? 'bg-orange-50/50 hover:bg-orange-50' : 'hover:bg-muted/50'}`}
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        {/* Machine Info */}
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="font-mono font-bold text-lg">{machine.serialNumber}</span>
                                                <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 border ${status.color}`}>
                                                    {status.icon}
                                                    {status.label}
                                                </span>
                                                {machine.rejectionFlag && (
                                                    <span className="px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">
                                                        موافقة سابقة مرفوضة
                                                    </span>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-muted-foreground">
                                                <div>
                                                    <span className="text-xs">العميل</span>
                                                    <div className="font-bold text-foreground">{machine.customerName || 'غير محدد'}</div>
                                                </div>
                                                <div>
                                                    <span className="text-xs">الموديل</span>
                                                    <div className="font-bold text-foreground">{machine.machine?.model || 'غير محدد'}</div>
                                                </div>
                                                <div>
                                                    <span className="text-xs">المختص</span>
                                                    <div className="font-bold text-foreground">{machine.technicianName}</div>
                                                </div>
                                                <div>
                                                    <span className="text-xs">تاريخ التعيين</span>
                                                    <div className="font-bold text-foreground">
                                                        {new Date(machine.assignedAt).toLocaleDateString('ar-EG')}
                                                    </div>
                                                </div>
                                            </div>

                                            {machine.totalCost > 0 && (
                                                <div className="mt-2 inline-block bg-green-50 text-green-700 px-3 py-1 rounded-lg text-sm font-bold border border-green-100">
                                                    التكلفة المتوقعة: {machine.totalCost} ج.م
                                                </div>
                                            )}
                                        </div>

                                        {/* Action Hint */}
                                        {needsAction && (
                                            <a
                                                href="/maintenance-approvals"
                                                className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-orange-700 transition-colors flex items-center gap-2"
                                            >
                                                <Clock size={16} />
                                                بانتظار موافقتك
                                            </a>
                                        )}
                                    </div>

                                    {/* Timeline/Logs */}
                                    {machine.logs && machine.logs.length > 0 && (
                                        <div className="mt-3 pt-3 border-t border-dashed">
                                            <div className="text-xs font-bold text-muted-foreground mb-2">سجل الأحداث:</div>
                                            <div className="flex flex-wrap gap-2">
                                                {machine.logs.slice(0, 4).map((log, i) => (
                                                    <div
                                                        key={i}
                                                        className="bg-muted/50 px-2 py-1 rounded text-xs"
                                                        title={log.details || log.action}
                                                    >
                                                        <span className="font-bold">{log.action}</span>
                                                        <span className="text-muted-foreground"> - {log.performedBy}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
