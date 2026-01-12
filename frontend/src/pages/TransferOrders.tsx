import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useSearchParams } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import { FileText, Plus, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { exportTransferOrders } from '../utils/exportUtils';

// Import modular components
import { TransferOrdersStats } from '../components/transfers/TransferOrdersStats';
import { TransferOrdersFilters } from '../components/transfers/TransferOrdersFilters';
import { TransferOrdersTable } from '../components/transfers/TransferOrdersTable';
import { CreateTransferOrderForm } from '../components/transfers/CreateTransferOrderForm';
import { ViewTransferOrderModal } from '../components/transfers/ViewTransferOrderModal';

export default function TransferOrders() {
    const { user } = useAuth();
    const { preferences } = useSettings();
    const queryClient = useQueryClient();
    const [searchParams, setSearchParams] = useSearchParams();

    const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterType, setFilterType] = useState('');
    const [filterBranch, setFilterBranch] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterDirection, setFilterDirection] = useState<'all' | 'sent' | 'received'>('all');
    const [viewingOrder, setViewingOrder] = useState<any>(null);
    const [highlightedOrderId, setHighlightedOrderId] = useState<string | null>(null);

    // Queries
    const { data: branches } = useQuery({
        queryKey: ['branches-active'],
        queryFn: () => api.getActiveBranches(),
        enabled: !!user
    });

    const { data: orders, isLoading } = useQuery({
        queryKey: ['transfer-orders', filterStatus, filterType, filterBranch, searchTerm],
        queryFn: () => api.getTransferOrders({
            status: filterStatus || undefined,
            type: filterType || undefined,
            branchId: filterBranch || undefined,
            q: searchTerm || undefined
        }),
        enabled: !!user
    });

    const { data: stats } = useQuery({
        queryKey: ['transfer-orders-stats'],
        queryFn: () => api.getTransferOrderStats(),
        enabled: !!user
    });

    // Auto-view order from notification
    useEffect(() => {
        const orderId = searchParams.get('orderId');
        if (orderId && orders) {
            const order = orders.find((o: any) => o.id === orderId);
            if (order) {
                setViewingOrder(order);
                setActiveTab('list');
                // Highlight if enabled in preferences
                if (preferences?.highlightEffect) {
                    setHighlightedOrderId(orderId);
                    setTimeout(() => setHighlightedOrderId(null), 3000);
                }
                // Remove the query parameter
                searchParams.delete('orderId');
                setSearchParams(searchParams);
            }
        }
    }, [orders, searchParams, setSearchParams, preferences]);

    // Mutations
    const createMutation = useMutation({
        mutationFn: (data: any) => api.createTransferOrder(data),
        onSuccess: () => {
            toast.success('تم إنشاء الإذن بنجاح');
            queryClient.invalidateQueries({ queryKey: ['transfer-orders'] });
            queryClient.invalidateQueries({ queryKey: ['transfer-orders-stats'] });
            setActiveTab('list');
        },
        onError: (error: any) => {
            toast.error(error.message || 'فشل في إنشاء الإذن');
        }
    });

    const importMutation = useMutation({
        mutationFn: (formData: FormData) => api.importTransferOrder(formData),
        onSuccess: (data) => {
            toast.success(`تم إنشاء الإذن بنجاح - ${data.imported} صنف`);
            queryClient.invalidateQueries({ queryKey: ['transfer-orders'] });
            queryClient.invalidateQueries({ queryKey: ['transfer-orders-stats'] });
            setActiveTab('list');
        },
        onError: (error: any) => {
            toast.error(error.message || 'فشل في استيراد الإذن');
        }
    });

    const receiveMutation = useMutation({
        mutationFn: (data: { id: string, items?: string[] }) => api.receiveTransferOrder(data.id, { receivedItems: data.items }),
        onSuccess: () => {
            toast.success('تم تأكيد الاستلام بنجاح');
            queryClient.invalidateQueries({ queryKey: ['transfer-orders'] });
            queryClient.invalidateQueries({ queryKey: ['transfer-orders-stats'] });
            setViewingOrder(null);
        },
        onError: (error: any) => {
            toast.error(error.message || 'فشل في تأكيد الاستلام');
        }
    });

    const rejectMutation = useMutation({
        mutationFn: (data: { id: string, reason: string }) => api.rejectTransferOrder(data.id, { rejectionReason: data.reason }),
        onSuccess: () => {
            toast.success('تم رفض الإذن بنجاح');
            queryClient.invalidateQueries({ queryKey: ['transfer-orders'] });
            queryClient.invalidateQueries({ queryKey: ['transfer-orders-stats'] });
            setViewingOrder(null);
        },
        onError: (error: any) => {
            toast.error(error.message || 'فشل في رفض الإذن');
        }
    });

    const cancelMutation = useMutation({
        mutationFn: (id: string) => api.cancelTransferOrder(id),
        onSuccess: () => {
            toast.success('تم إلغاء الإذن بنجاح');
            queryClient.invalidateQueries({ queryKey: ['transfer-orders'] });
            queryClient.invalidateQueries({ queryKey: ['transfer-orders-stats'] });
            setViewingOrder(null);
        },
        onError: (error: any) => {
            toast.error(error.message || 'فشل في إلغاء الإذن');
        }
    });

    const filteredOrders = orders?.filter((order: any) => {
        // First apply direction filter
        if (filterDirection === 'sent' && order.fromBranchId !== user?.branchId) return false;
        if (filterDirection === 'received' && order.toBranchId !== user?.branchId) return false;

        if (!searchTerm) return true;
        const searchLower = searchTerm.toLowerCase();

        return (
            order.orderNumber.toLowerCase().includes(searchLower) ||
            order.fromBranch?.name?.toLowerCase().includes(searchLower) ||
            order.toBranch?.name?.toLowerCase().includes(searchLower) ||
            order.items?.some((item: any) => item.serialNumber?.toLowerCase().includes(searchLower))
        );
    });

    return (
        <div className="px-4 sm:px-8 pt-4 pb-8 animate-fade-in" dir="rtl">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <h1 className="text-3xl font-black text-foreground flex items-center gap-3">
                    <div className="p-2 bg-blue-500/10 rounded-2xl">
                        <FileText className="text-blue-600" size={28} />
                    </div>
                    أذونات الصرف
                </h1>

                <TransferOrdersStats stats={stats} />
                <button
                    onClick={exportTransferOrders}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                >
                    <Download size={18} />
                    تصدير Excel
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-3 mb-8 bg-muted/50 p-1.5 rounded-[1.25rem] w-fit">
                <button
                    onClick={() => setActiveTab('list')}
                    className={`px-6 py-2.5 rounded-2xl font-black text-sm transition-all ${activeTab === 'list'
                        ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                        }`}
                >
                    قائمة الأذونات
                </button>
                <button
                    onClick={() => setActiveTab('create')}
                    className={`px-6 py-2.5 rounded-2xl font-black text-sm flex items-center gap-2 transition-all ${activeTab === 'create'
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                        }`}
                >
                    <Plus size={18} />
                    إنشاء إذن جديد
                </button>
            </div>

            {/* Content Area */}
            <div className="space-y-6">
                {activeTab === 'list' ? (
                    <div className="bg-card rounded-[2rem] border border-border overflow-hidden shadow-2xl">
                        {/* Direction Toggle */}
                        <div className="flex border-b bg-slate-50/50 p-2 gap-2">
                            {[
                                { id: 'all', label: 'كل الأذونات' },
                                { id: 'sent', label: 'الأذونات الصادرة (من الفرع)' },
                                { id: 'received', label: 'الأذونات الواردة (إلى الفرع)' }
                            ].map((dir) => (
                                <button
                                    key={dir.id}
                                    onClick={() => setFilterDirection(dir.id as any)}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${filterDirection === dir.id
                                        ? 'bg-white text-primary shadow-sm ring-1 ring-border'
                                        : 'text-muted-foreground hover:bg-white/50'
                                        }`}
                                >
                                    {dir.label}
                                </button>
                            ))}
                        </div>

                        <TransferOrdersFilters
                            searchTerm={searchTerm}
                            onSearchChange={setSearchTerm}
                            filterStatus={filterStatus}
                            onStatusChange={setFilterStatus}
                            filterType={filterType}
                            onTypeChange={setFilterType}
                            filterBranch={filterBranch}
                            onBranchChange={setFilterBranch}
                            branches={branches}
                            userBranchId={user?.branchId}
                        />
                        <div className="overflow-x-auto">
                            <TransferOrdersTable
                                isLoading={isLoading}
                                orders={filteredOrders}
                                onViewOrder={setViewingOrder}
                                userBranchId={user?.branchId}
                            />
                        </div>
                    </div>
                ) : (
                    <CreateTransferOrderForm
                        branches={branches}
                        user={user}
                        onCreate={createMutation.mutate}
                        onImport={importMutation.mutate}
                        isPending={createMutation.isPending || importMutation.isPending}
                    />
                )}
            </div>

            {/* Detail Modal */}
            <ViewTransferOrderModal
                order={viewingOrder}
                onClose={() => setViewingOrder(null)}
                onReceive={(id, items) => receiveMutation.mutate({ id, items })}
                onReject={(id, reason) => rejectMutation.mutate({ id, reason })}
                onCancel={(id) => cancelMutation.mutate(id)}
                isProcessing={receiveMutation.isPending || rejectMutation.isPending || cancelMutation.isPending}
                highlightedOrderId={highlightedOrderId}
            />
        </div>
    );
}
