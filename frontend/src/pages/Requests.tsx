import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useState, useEffect } from 'react';
import type { MaintenanceRequest, Technician } from '../lib/types';
import { useLocation } from 'react-router-dom';
import { Plus, Trash2, UserCheck, Eye, Printer, CheckCircle, Filter, DollarSign, Search, FileDown, Calendar, Clock, CheckCheck } from 'lucide-react';
import { FaHistory } from 'react-icons/fa';
import AuditLogModal from '../components/AuditLogModal';
import { CloseRequestModal } from '../components/CloseRequestModal';
import { openPrintReport } from '../components/PrintReport';
import { CreateRequestModal } from '../components/CreateRequestModal';
import { useApiMutation } from '../hooks/useApiMutation';
import { useAuth } from '../context/AuthContext';
import { SendToCenterModal } from '../components/SendToCenterModal';
import { RequestApprovalModal } from '../components/RequestApprovalModal';
import ConfirmDialog from '../components/ConfirmDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { translateStatus } from '../lib/translations';
import PageHeader from '../components/PageHeader';

export default function Requests() {
    const location = useLocation();
    const { user } = useAuth();
    const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
    const [requestToDelete, setRequestToDelete] = useState<string | null>(null);
    const [showDetails, setShowDetails] = useState(false);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [showAssignDialog, setShowAssignDialog] = useState(false);
    const [showCloseDialog, setShowCloseDialog] = useState(false);
    const [showSendToCenterDialog, setShowSendToCenterDialog] = useState(false);
    const [showApprovalDialog, setShowApprovalDialog] = useState(false);
    const [prefilledData, setPrefilledData] = useState<any>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    // Admin Filter State
    const [filterBranchId, setFilterBranchId] = useState('');
    const [activeTab, setActiveTab] = useState<'open' | 'closed'>('open');
    const isAdmin = !user?.branchId;

    // Check if navigated from customers page with create request intent
    useEffect(() => {
        const state = location.state as any;
        if (state?.createRequest) {
            setPrefilledData({
                customerId: state.customerId,
                machineId: state.machineId,
                customerName: state.customerName,
                machineSerial: state.machineSerial,
                customer: state.customer,
                machine: state.machine
            });
            setShowCreateForm(true);
            // Clear the state to prevent re-opening on refresh
            window.history.replaceState({}, document.title);
        }
    }, [location]);
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Form states


    const queryClient = useQueryClient();
    const [selectedTechnician, setSelectedTechnician] = useState('');

    const { data: requests, isLoading } = useQuery<MaintenanceRequest[]>({
        queryKey: ['requests', filterBranchId, debouncedSearch],
        queryFn: () => api.getRequests({ branchId: filterBranchId, search: debouncedSearch })
    });

    const { data: stats } = useQuery({
        queryKey: ['requests-stats', filterBranchId],
        queryFn: () => api.getRequestStats(filterBranchId),
        refetchInterval: 1000 * 60 // Refresh stats every minute
    });

    // Fetch branches for filter if admin
    const { data: branches } = useQuery({
        queryKey: ['branches'],
        queryFn: () => api.getActiveBranches(),
        enabled: isAdmin,
        staleTime: 1000 * 60 * 60
    });

    // Derive selected request from list to ensure reactivity
    const selectedRequest = requests?.find(r => r.id === selectedRequestId) || null;



    const { data: technicians } = useQuery<Technician[]>({
        queryKey: ['technicians'],
        queryFn: () => api.getTechnicians(),
        enabled: !!user
    });

    const { data: spareParts } = useQuery<any[]>({
        queryKey: ['spare-parts-inventory'],
        queryFn: () => (api.getInventory() as any),
        enabled: !!user
    });

    const createMutation = useApiMutation({
        mutationFn: (data: any) => api.createRequest(data),
        successMessage: 'تم إنشاء طلب الصيانة بنجاح',
        errorMessage: 'فشل إنشاء الطلب',
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['requests'] });
            setShowCreateForm(false);
        }
    });

    const assignMutation = useApiMutation({
        mutationFn: ({ id, technicianId }: { id: string; technicianId: string }) =>
            api.assignTechnician(id, technicianId),
        successMessage: 'تم تعيين الفني بنجاح',
        errorMessage: 'فشل تعيين الفني',
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['requests'] });
            setShowAssignDialog(false);
            setSelectedTechnician('');
        }
    });

    const closeMutation = useApiMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => api.closeRequest(id, data),
        successMessage: 'تم إغلاق الطلب بنجاح',
        errorMessage: 'فشل إغلاق الطلب',
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['requests'] });
            setShowCloseDialog(false);
        }
    });

    const deleteMutation = useApiMutation({
        mutationFn: (id: string) => api.deleteRequest(id),
        successMessage: 'تم حذف الطلب',
        errorMessage: 'فشل حذف الطلب',
        onSuccess: async (_data, id) => {
            await queryClient.invalidateQueries({ queryKey: ['requests'] });
            // Close details if deleted request was selected
            if (selectedRequestId === id) {
                setShowDetails(false);
                setSelectedRequestId(null);
            }
        }
    });

    const handleDelete = (id: string) => {
        setRequestToDelete(id);
    };


    const handleAssignSubmit = () => {
        if (selectedRequest && selectedTechnician) {
            assignMutation.mutate({ id: selectedRequest.id, technicianId: selectedTechnician });
        }
    };

    const handleCloseSubmit = (closeData: any) => {
        if (selectedRequest) {
            closeMutation.mutate({ id: selectedRequest.id, data: closeData });
        }
    };

    const handlePrint = async (request: any) => {
        // Parse used parts from request
        let usedParts: any[] = [];
        let totalCost = 0;
        try {
            const parsed = typeof request.usedParts === 'string'
                ? JSON.parse(request.usedParts || '{}')
                : request.usedParts || {};

            if (parsed.parts) {
                usedParts = parsed.parts;
                totalCost = parsed.totalCost || 0;
            } else if (Array.isArray(parsed)) {
                usedParts = parsed;
            }
        } catch (e) { }

        // Fetch monthly repair count for this machine
        let monthlyRepairCount = 1;
        if (request.posMachine?.serialNumber) {
            try {
                // If closed, check count for the month it was closed.
                // If open, check count for current month.
                const checkDate = request.status === 'Closed' && request.closingTimestamp
                    ? request.closingTimestamp
                    : new Date().toISOString();

                const res = await api.getMonthlyRepairCount(request.posMachine.serialNumber, checkDate);

                // If request is already closed, the count includes it (because we filter by <= month of closing).
                // If request is open/in-progress, we add 1 to include the current one being processed/printed.
                const baseCount = res.count || 0;
                monthlyRepairCount = request.status === 'Closed' ? baseCount : baseCount + 1;

                // Ensure at least 1 (should be rare if logic is correct, but safe fallback)
                if (monthlyRepairCount < 1) monthlyRepairCount = 1;
            } catch (e) { }
        }

        openPrintReport(request, usedParts, totalCost, monthlyRepairCount);
    };

    const getStatusBadge = (status: string) => {
        const colors: Record<string, string> = {
            'Open': 'bg-[#F5C451]/20 text-[#F5C451] border-2 border-[#F5C451]/30',
            'Pending': 'bg-orange-500/20 text-orange-600 border-2 border-orange-500/30',
            'In Progress': 'bg-[#6CE4F0]/20 text-primary border-2 border-[#6CE4F0]/50',
            'Closed': 'bg-[#80C646]/20 text-[#80C646] border-2 border-[#80C646]/30',
        };
        return colors[status] || 'bg-slate-100 text-slate-800 border-2 border-slate-200';
    };

    const getStatusLabel = (status: string) => {
        return translateStatus(status);
    };

    const handleExport = async () => {
        try {
            await api.exportRequests(filterBranchId, debouncedSearch);
        } catch (error) {
            console.error('Export failed:', error);
        }
    };

    // Note: Removed early return on isLoading to prevent search input from losing focus


    const filterElement = (
        <div className="flex flex-wrap items-center gap-4">
            {isAdmin && (
                <div className="relative flex items-center gap-2 bg-white rounded-xl border-2 border-primary/10 px-4 py-2 shadow-sm hover:shadow-md transition-shadow">
                    <Filter size={16} className="text-primary/60" />
                    <select
                        value={filterBranchId}
                        onChange={(e) => setFilterBranchId(e.target.value)}
                        className="bg-transparent outline-none text-sm text-slate-700 font-bold min-w-[120px]">
                        <option value="">كل الفروع</option>
                        {(branches as any[])?.map((branch: any) => (
                            <option key={branch.id} value={branch.id}>{branch.name}</option>
                        ))}
                    </select>
                </div>
            )}
            <div className="relative group">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={18} />
                <input
                    type="text"
                    placeholder="بحث بـ (العميل، السيريال، الشكوى)..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-white border-2 border-primary/10 rounded-xl pr-10 pl-4 py-2.5 outline-none focus:border-primary/30 focus:shadow-lg focus:shadow-primary/5 transition-all w-full md:w-[300px] text-sm font-bold"
                />
            </div>
        </div>
    );

    const actionElements = (
        <div className="flex flex-wrap items-center gap-3">
            <button
                onClick={handleExport}
                className="flex items-center gap-2 bg-white text-primary border-2 border-primary/10 px-5 py-2.5 rounded-xl hover:bg-slate-50 transition-all font-bold text-sm shadow-sm"
            >
                <FileDown size={18} />
                تصدير
            </button>
            <button
                onClick={() => setShowCreateForm(true)}
                className="flex items-center gap-2 bg-gradient-to-r from-primary to-primary/90 text-white px-6 py-2.5 rounded-xl hover:shadow-lg hover:shadow-primary/20 transition-all font-black text-sm active:scale-95 shadow-md"
            >
                <Plus size={20} strokeWidth={3} />
                طلب جديد
            </button>
        </div>
    );

    return (
        <div className="px-4 lg:px-8 pt-4 pb-8 bg-gradient-to-br from-slate-50 to-blue-50/30 min-h-screen" dir="rtl">
            <PageHeader
                title="طلبات الصيانة"
                subtitle="إدارة طلبات الصيانة، متابعة الحالة، وإصدار التقارير"
                filter={filterElement}
                actions={actionElements}
            />

            {/* Quick Report Bar */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {['day', 'week', 'month'].map((period) => {
                    const periodStats = stats?.[period] || { open: 0, inProgress: 0, closed: 0, total: 0 };
                    const periodLabel = period === 'day' ? 'اليوم' : period === 'week' ? 'هذا الأسبوع' : 'هذا الشهر';
                    const Icon = period === 'day' ? Clock : period === 'week' ? Calendar : CheckCheck;

                    return (
                        <div key={period} className="bg-white rounded-2xl p-4 border-2 border-primary/10 shadow-sm flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`p-3 rounded-xl ${period === 'day' ? 'bg-amber-50 text-amber-600' : period === 'week' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>
                                    <Icon size={24} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-slate-500">{periodLabel}</h3>
                                    <p className="text-xl font-black text-primary">{periodStats.total}</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <div className="text-center">
                                    <div className="text-[10px] font-black text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full mb-1">معلق</div>
                                    <span className="font-bold text-slate-700">{periodStats.open}</span>
                                </div>
                                <div className="text-center px-2 border-x border-slate-100">
                                    <div className="text-[10px] font-black text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full mb-1">جاري</div>
                                    <span className="font-bold text-slate-700">{periodStats.inProgress}</span>
                                </div>
                                <div className="text-center">
                                    <div className="text-[10px] font-black text-green-500 bg-green-50 px-2 py-0.5 rounded-full mb-1">منتهي</div>
                                    <span className="font-bold text-slate-700">{periodStats.closed}</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Tabs for Open/Closed */}
            <div className="flex gap-2 mb-6">
                <button
                    onClick={() => setActiveTab('open')}
                    className={`px-6 py-3 rounded-xl font-black transition-all flex items-center gap-2 ${activeTab === 'open' ? 'bg-gradient-to-r from-primary to-primary/90 text-white shadow-lg' : 'bg-white border-2 border-primary/10 text-primary hover:bg-primary/5'}`}
                >
                    <Clock size={18} />
                    الطلبات المفتوحة
                    <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === 'open' ? 'bg-white/20' : 'bg-primary/10'}`}>
                        {requests?.filter((r: any) => r.status !== 'Closed').length || 0}
                    </span>
                </button>
                <button
                    onClick={() => setActiveTab('closed')}
                    className={`px-6 py-3 rounded-xl font-black transition-all flex items-center gap-2 ${activeTab === 'closed' ? 'bg-gradient-to-r from-green-600 to-green-700 text-white shadow-lg' : 'bg-white border-2 border-green-200 text-green-700 hover:bg-green-50'}`}
                >
                    <CheckCircle size={18} />
                    الطلبات المغلقة
                    <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === 'closed' ? 'bg-white/20' : 'bg-green-100'}`}>
                        {requests?.filter((r: any) => r.status === 'Closed').length || 0}
                    </span>
                </button>
            </div>

            <div className="bg-white rounded-2xl border-2 border-primary/10 shadow-xl shadow-primary/5 overflow-hidden">
                <div className="p-4 border-b border-primary/10 bg-gradient-to-r from-primary/5 to-transparent">
                    <p className="text-primary font-black">
                        {activeTab === 'open' ? 'الطلبات المفتوحة' : 'الطلبات المغلقة'}: {requests?.filter((r: any) => activeTab === 'open' ? r.status !== 'Closed' : r.status === 'Closed').length || 0}
                    </p>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full whitespace-nowrap">
                        <thead className="bg-gradient-to-r from-primary to-primary/90 text-white">
                            <tr>
                                <th className="text-center p-4 font-black">العميل / الكود</th>
                                <th className="text-center p-4 font-black">الماكينة</th>
                                <th className="text-center p-4 font-black">الشكوى</th>
                                <th className="text-center p-4 font-black">الحالة</th>
                                {isAdmin && !filterBranchId && <th className="text-center p-4 font-black">الفرع</th>}
                                <th className="text-center p-4 font-black">الفني</th>
                                <th className="text-center p-4 font-black">الإجراءات</th>
                            </tr>
                        </thead>
                        <tbody>
                            {requests?.filter((r: any) => activeTab === 'open' ? r.status !== 'Closed' : r.status === 'Closed').map((request: any) => (
                                <tr key={request.id} className="border-t border-slate-100 hover:bg-primary/5 transition-colors">
                                    <td className="p-4 text-center">
                                        <div className="flex flex-col items-center">
                                            <span className="font-bold text-sm text-primary">{request.customer?.client_name || '-'}</span>
                                            <span className="text-[10px] text-slate-400 font-mono mt-0.5">{request.customer?.bkcode || '-'}</span>
                                        </div>
                                    </td>
                                    <td className="p-4 font-mono font-medium text-primary text-center">{request.posMachine?.serialNumber || '-'}</td>
                                    <td className="p-4 max-w-xs truncate text-center">{request.complaint || '-'}</td>
                                    <td className="p-4 text-center">
                                        <span className={`px-3 py-1.5 rounded-xl text-sm font-black ${getStatusBadge(request.status)}`}>
                                            {getStatusLabel(request.status)}
                                        </span>
                                    </td>
                                    {isAdmin && !filterBranchId && (
                                        <td className="p-4 text-sm text-slate-500 text-center">
                                            {request.branch?.name || 'غير محدد'}
                                        </td>
                                    )}

                                    <td className="p-4 text-center">{request.technician || '-'}</td>
                                    <td className="p-4 text-center">
                                        <div className="flex gap-1 justify-center">
                                            <button
                                                onClick={() => { setSelectedRequestId(request.id); setShowDetails(true); }}
                                                className="p-2 text-[#6CE4F0] hover:bg-[#6CE4F0]/10 rounded-lg transition-all"
                                                title="عرض التفاصيل"
                                            >
                                                <Eye size={18} />
                                            </button>
                                            {(request.status === 'Open' || request.status === 'Pending') && (
                                                <button
                                                    onClick={() => { setSelectedRequestId(request.id); setShowAssignDialog(true); }}
                                                    className="p-2 text-[#7E5BAB] hover:bg-[#7E5BAB]/10 rounded-lg transition-all"
                                                    title="تعيين فني"
                                                >
                                                    <UserCheck size={18} />
                                                </button>
                                            )}
                                            {request.status === 'In Progress' && (
                                                <button
                                                    onClick={() => { setSelectedRequestId(request.id); setShowCloseDialog(true); }}
                                                    className="p-2 text-[#80C646] hover:bg-[#80C646]/10 rounded-lg transition-all"
                                                    title="إغلاق الطلب"
                                                >
                                                    <CheckCircle size={18} />
                                                </button>
                                            )}
                                            {request.status === 'In Progress' && !request.approvalId && user?.branchType === 'MAINTENANCE_CENTER' && (
                                                <button
                                                    onClick={() => { setSelectedRequestId(request.id); setShowApprovalDialog(true); }}
                                                    className="p-2 text-[#E86B3A] hover:bg-[#E86B3A]/10 rounded-lg transition-all"
                                                    title="طلب موافقة"
                                                >
                                                    <DollarSign size={18} />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handlePrint(request)}
                                                className="p-2 text-[#80C646] hover:bg-[#80C646]/10 rounded-lg transition-all"
                                                title="طباعة"
                                            >
                                                <Printer size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(request.id)}
                                                className="p-2 text-[#C85C8E] hover:bg-[#C85C8E]/10 rounded-lg transition-all"
                                                title="حذف"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {isLoading && (
                                <tr>
                                    <td colSpan={isAdmin ? 8 : 7} className="p-8 text-center text-slate-500">
                                        <div className="flex items-center justify-center gap-2">
                                            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                                            جاري التحميل...
                                        </div>
                                    </td>
                                </tr>
                            )}
                            {!isLoading && (!requests || requests.length === 0) && (
                                <tr>
                                    <td colSpan={isAdmin ? 8 : 7} className="p-8 text-center text-slate-500">
                                        لا توجد طلبات صيانة
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create Request Modal */}
            {showCreateForm && (
                <CreateRequestModal
                    onClose={() => {
                        setShowCreateForm(false);
                        setPrefilledData(null);
                    }}
                    onSubmit={(data) => createMutation.mutate(data)}
                    prefilled={prefilledData}
                />
            )}

            {/* Assign Technician Modal */}
            <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
                <DialogContent className="p-0 border-0 flex flex-col max-h-[85vh] w-full max-w-md overflow-hidden" dir="rtl">
                    <DialogHeader className="bg-slate-50 p-6 pb-4 border-b shrink-0 text-right sm:text-right">
                        <DialogTitle>تعيين فني</DialogTitle>
                        <DialogDescription className="text-sm text-slate-500">
                            {selectedRequest && <>طلب: {selectedRequest.customer?.client_name}</>}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto p-6 space-y-4 min-h-[200px]">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">اختر الفني</label>
                            <select
                                value={selectedTechnician}
                                onChange={(e) => setSelectedTechnician(e.target.value)}
                                className="w-full border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/20"
                            >
                                <option value="">اختر فني...</option>
                                {technicians?.map((t: Technician) => {
                                    const roleName = {
                                        'Technician': 'فني',
                                        'CustomerService': 'خدمة عملاء',
                                        'Admin': 'مدير',
                                        'Supervisor': 'مشرف'
                                    }[t.role || ''] || t.role;
                                    return (
                                        <option key={t.id} value={t.id}>{t.displayName} ({roleName})</option>
                                    );
                                })}
                            </select>
                        </div>
                    </div>

                    <DialogFooter className="p-6 border-t bg-slate-50/50 shrink-0 gap-2">
                        <button
                            onClick={() => setShowAssignDialog(false)}
                            className="flex-1 border border-slate-200 py-2.5 rounded-xl hover:bg-slate-50 font-medium transition-colors"
                        >
                            إلغاء
                        </button>
                        <button
                            onClick={handleAssignSubmit}
                            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2.5 rounded-xl font-bold shadow-lg shadow-purple-200 transition-all"
                            disabled={!selectedTechnician}
                        >
                            تعيين الفني
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Close Request Modal - Already Component */}
            {showCloseDialog && selectedRequest && (
                <CloseRequestModal
                    request={selectedRequest}
                    spareParts={(spareParts || []) as any[]}
                    onClose={() => setShowCloseDialog(false)}
                    onSubmit={handleCloseSubmit}
                />
            )}

            {/* Details Modal */}
            <Dialog open={showDetails} onOpenChange={setShowDetails}>
                <DialogContent className="p-0 border-0 flex flex-col max-h-[90vh] h-auto overflow-hidden sm:max-w-lg">
                    {selectedRequest && (() => {
                        // Parse usedParts logic moved inside content
                        let partsData: { parts: any[], totalCost: number } = { parts: [], totalCost: 0 };
                        try {
                            const parsed = typeof selectedRequest.usedParts === 'string'
                                ? JSON.parse(selectedRequest.usedParts || '{}')
                                : selectedRequest.usedParts || {};
                            if (parsed.parts) partsData = parsed;
                            else if (Array.isArray(parsed)) partsData = { parts: parsed, totalCost: 0 };
                        } catch (e) { }

                        return (
                            <RequestDetailsModalContent
                                request={selectedRequest}
                                partsData={partsData}
                                onClose={() => setShowDetails(false)}
                            />
                        );
                    })()}
                </DialogContent>
            </Dialog>
            {/* Send To Center Modal */}
            {showSendToCenterDialog && selectedRequest && (
                <SendToCenterModal
                    request={selectedRequest}
                    onClose={() => setShowSendToCenterDialog(false)}
                    onSuccess={() => {
                        queryClient.invalidateQueries({ queryKey: ['requests'] });
                    }}
                />
            )}

            {/* Request Approval Modal */}
            {showApprovalDialog && selectedRequest && (
                <RequestApprovalModal
                    request={selectedRequest}
                    onClose={() => setShowApprovalDialog(false)}
                    onSuccess={() => {
                        queryClient.invalidateQueries({ queryKey: ['requests'] });
                    }}
                />
            )}
            {/* ... other modals ... */}
            {/* Note: Other modals are likely here but hidden in the view. I will append the ConfirmDialog at the very end of the return */}

            <ConfirmDialog
                isOpen={!!requestToDelete}
                title="حذف طلب الصيانة"
                message="هل أنت متأكد من حذف هذا الطلب؟ لا يمكن التراجع عن هذا الإجراء."
                confirmText="نعم، حذف"
                cancelText="إلغاء"
                onConfirm={() => {
                    if (requestToDelete) {
                        deleteMutation.mutate(requestToDelete);
                        setRequestToDelete(null);
                    }
                }}
                onCancel={() => setRequestToDelete(null)}
                type="danger"
            />
        </div>
    );
}

// Extracted for cleaner state management
function RequestDetailsModalContent({ request, partsData, onClose }: { request: any, partsData: any, onClose: () => void }) {
    const [showHistory, setShowHistory] = useState(false);

    return (
        <>
            <AuditLogModal
                isOpen={showHistory}
                onClose={() => setShowHistory(false)}
                entityType="REQUEST"
                entityId={request.id}
                title={`طلب صيانة ${request.customer?.client_name}`}
            />

            <DialogHeader className="bg-slate-50 p-6 pb-4 border-b shrink-0 flex flex-row items-center justify-between">
                <DialogTitle>تفاصيل الطلب</DialogTitle>
                <button
                    onClick={() => setShowHistory(true)}
                    className="text-xs bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-full hover:bg-indigo-200 transition-colors flex items-center gap-1 mr-auto"
                >
                    <FaHistory size={12} />
                    سجل الحركة
                </button>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scroll">
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-2">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">العميل</p>
                            <p className="font-bold text-slate-800">{request.customer?.client_name}</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">الماكينة</p>
                            <p className="font-mono">{request.posMachine?.serialNumber}</p>
                        </div>
                    </div>
                </div>

                <div className="space-y-3">
                    <div>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">الشكوى</p>
                        <p className="text-sm bg-red-50 text-red-700 p-3 rounded-lg border border-red-100">{request.complaint}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">الحالة</p>
                            <p className="text-sm font-medium">{request.status}</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">الفرع</p>
                            <p className="text-sm font-medium">{request.branch?.name || 'غير محدد'}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">الفني</p>
                            <p className="text-sm font-medium">{request.technician || 'غير معين'}</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">التاريخ</p>
                            <p className="text-sm font-medium">{new Date(request.createdAt).toLocaleDateString('ar-EG')}</p>
                        </div>
                    </div>

                    <div>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">الإجراء المتخذ</p>
                        <p className="text-sm bg-slate-50 p-3 rounded-lg border border-slate-100">{request.actionTaken || '-'}</p>
                    </div>

                    {/* Used Parts */}
                    {partsData.parts.length > 0 && (
                        <div className="border-t border-dashed pt-4 mt-2">
                            <p className="font-bold mb-2 flex justify-between items-center text-sm">
                                <span>قطع الغيار المستخدمة</span>
                                {partsData.totalCost > 0 && (
                                    <span className="text-green-600 bg-green-50 px-2 py-0.5 rounded text-xs">
                                        {partsData.totalCost} ج.م
                                    </span>
                                )}
                            </p>
                            <div className="bg-slate-50 rounded-lg p-2 space-y-2 border border-slate-100">
                                {partsData.parts.map((part: any, i: number) => (
                                    <div key={i} className="flex justify-between items-center text-sm border-b last:border-0 border-slate-100 pb-1 last:pb-0">
                                        <div className="flex items-center gap-2">
                                            <span className="w-5 h-5 bg-slate-200 rounded-full flex items-center justify-center text-[10px] font-bold">{part.quantity}</span>
                                            <span className="text-slate-700">{part.name}</span>
                                        </div>
                                        <span className={part.isPaid ? 'text-slate-600 font-medium' : 'text-green-600 font-medium text-xs'}>
                                            {part.isPaid ? `${part.cost * part.quantity} ج.م` : 'مجاني/ضمان'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                            {request.receiptNumber && (
                                <p className="text-blue-600 font-medium text-xs mt-2 text-center bg-blue-50 p-1.5 rounded-lg">
                                    رقم الإيصال: {request.receiptNumber}
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <DialogFooter className="p-6 border-t bg-slate-50/50 shrink-0">
                <button
                    onClick={onClose}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-xl font-bold shadow-lg shadow-slate-200 transition-all"
                >
                    إغلاق
                </button>
            </DialogFooter>
        </>
    );
}
