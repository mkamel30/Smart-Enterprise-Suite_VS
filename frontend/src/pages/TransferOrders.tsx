import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useSearchParams } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import { FileText, Plus, Download, ClipboardList, Send, Inbox } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { exportTransferOrders } from '../utils/exportUtils';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

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
                if (preferences?.highlightEffect) {
                    setHighlightedOrderId(orderId);
                    setTimeout(() => setHighlightedOrderId(null), 3000);
                }
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
            toast.success(`تم إنشاء الإذن بنجاح - ${data?.imported} صنف`);
            queryClient.invalidateQueries({ queryKey: ['transfer-orders'] });
            queryClient.invalidateQueries({ queryKey: ['transfer-orders-stats'] });
            setActiveTab('list');
        },
        onError: (error: any) => {
            toast.error(error.message || 'فشل في استيراد الإذن');
        }
    });

    const receiveMutation = useMutation({
        mutationFn: (data: { id: string, items?: string[] }) => api.receiveTransferOrder(data?.id, { receivedItems: data?.items }),
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
        mutationFn: (data: { id: string, reason: string }) => api.rejectTransferOrder(data?.id, { rejectionReason: data?.reason }),
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
        const isGlobal = user?.role === 'SUPER_ADMIN' || user?.role === 'MANAGEMENT' || user?.role === 'ADMIN_AFFAIRS';
        if (filterBranch && order.fromBranchId !== filterBranch && order.toBranchId !== filterBranch) return false;
        const effectiveBranchId = filterBranch || user?.branchId;
        if (filterDirection === 'sent' && order.fromBranchId !== effectiveBranchId) return false;
        if (filterDirection === 'received' && order.toBranchId !== effectiveBranchId) return false;
        if (!isGlobal && !filterBranch && order.fromBranchId !== user?.branchId && order.toBranchId !== user?.branchId) return false;
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
        <div className="px-8 pt-4 pb-8 space-y-8 max-w-[1600px] mx-auto bg-gradient-to-br from-slate-50 to-blue-50/30 min-h-screen" dir="rtl">
            {/* Header section */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                >
                    <h1 className="text-3xl lg:text-4xl font-black text-[#0A2472] tracking-tight">
                        أذونات الصرف والتحويل
                    </h1>
                    <p className="text-slate-500 mt-2 font-medium">متابعة ورقابة حركة المخزون بين الفروع</p>
                </motion.div>

                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                    <button
                        onClick={exportTransferOrders}
                        className="flex items-center gap-2 px-6 py-3.5 bg-emerald-600/10 text-emerald-700 rounded-2xl font-black hover:bg-emerald-600 hover:text-white transition-all border border-emerald-200/50 shadow-sm"
                    >
                        <Download size={18} />
                        تصدير البيانات
                    </button>

                    <button
                        onClick={() => setActiveTab(activeTab === 'list' ? 'create' : 'list')}
                        className={cn(
                            "flex items-center gap-2 px-6 py-3.5 rounded-2xl font-black transition-all shadow-lg active:scale-95",
                            activeTab === 'list'
                                ? "bg-indigo-600 text-white shadow-indigo-200 hover:bg-indigo-700"
                                : "bg-slate-800 text-white shadow-slate-200 hover:bg-slate-900"
                        )}
                    >
                        {activeTab === 'list' ? (
                            <>
                                <Plus size={20} />
                                إنشاء إذن جديد
                            </>
                        ) : (
                            <>
                                <ClipboardList size={20} />
                                عرض الأذونات
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Stats Overview */}
            <TransferOrdersStats stats={stats} />

            <AnimatePresence mode="wait">
                {activeTab === 'list' ? (
                    <motion.div
                        key="list"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="bg-white/40 backdrop-blur-xl border border-slate-200 rounded-[32px] p-8 shadow-sm overflow-hidden"
                    >
                        {/* Direction Toggle Pills */}
                        <div className="flex gap-2 mb-8 bg-slate-100/50 p-1.5 rounded-2xl w-fit">
                            {[
                                { id: 'all', label: 'الكل', icon: <ClipboardList size={16} /> },
                                { id: 'sent', label: 'صادر', icon: <Send size={16} /> },
                                { id: 'received', label: 'وارد', icon: <Inbox size={16} /> }
                            ].map((dir) => (
                                <button
                                    key={dir.id}
                                    onClick={() => setFilterDirection(dir.id as any)}
                                    className={cn(
                                        "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black transition-all",
                                        filterDirection === dir.id
                                            ? "bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200"
                                            : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
                                    )}
                                >
                                    {dir.icon}
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
                            userRole={user?.role}
                        />

                        <div className="mt-8">
                            <TransferOrdersTable
                                isLoading={isLoading}
                                orders={filteredOrders}
                                onViewOrder={setViewingOrder}
                                userBranchId={user?.branchId}
                            />
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="create"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                    >
                        <CreateTransferOrderForm
                            branches={branches}
                            user={user}
                            onCreate={createMutation.mutate}
                            onImport={importMutation.mutate}
                            isPending={createMutation.isPending || importMutation.isPending}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

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
