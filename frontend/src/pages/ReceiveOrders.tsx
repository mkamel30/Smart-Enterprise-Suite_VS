import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useSearchParams } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import {
    Package, CheckCircle, XCircle, Clock,
    Smartphone, Monitor, AlertCircle, Eye, X,
    FileText, Check, MessageSquare, ArrowLeft, ArrowRight, TrendingDown, ClipboardList, Users
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import PageHeader from '../components/PageHeader';
import { cn } from '../lib/utils';

const ORDER_TYPES: Record<string, { label: string; icon: any; color: string }> = {
    'SIM': { label: 'شرائح', icon: Smartphone, color: 'purple' },
    'MACHINE': { label: 'ماكينات', icon: Monitor, color: 'green' },
    'MAINTENANCE': { label: 'صيانة (ماكينات)', icon: Monitor, color: 'blue' },
    'SPARE_PART': { label: 'قطع غيار', icon: Package, color: 'orange' }
};

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
    'PENDING': { label: 'معلق', color: 'yellow', icon: Clock },
    'RECEIVED': { label: 'مستلم', color: 'green', icon: CheckCircle },
    'COMPLETED': { label: 'مستلم', color: 'green', icon: CheckCircle },
    'PARTIAL': { label: 'جزئي', color: 'blue', icon: AlertCircle },
    'REJECTED': { label: 'مرفوض', color: 'red', icon: XCircle },
    'CANCELLED': { label: 'ملغي', color: 'slate', icon: XCircle }
};

export default function ReceiveOrders() {
    const { user } = useAuth();
    const { preferences } = useSettings();
    const queryClient = useQueryClient();
    const [searchParams, setSearchParams] = useSearchParams();

    const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
    const [selectedOrder, setSelectedOrder] = useState<any>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [highlightedOrderId, setHighlightedOrderId] = useState<string | null>(null);

    // Queries
    const { data: pendingOrders, isLoading: loadingPending } = useQuery({
        queryKey: ['pending-orders'],
        queryFn: () => api.getPendingTransferOrders()
    });

    const { data: allOrders, isLoading: loadingAll } = useQuery({
        queryKey: ['all-orders'],
        queryFn: () => api.getTransferOrders()
    });

    useEffect(() => {
        const orderId = searchParams.get('orderId');
        if (orderId && pendingOrders) {
            const order = pendingOrders.find((o: any) => o.id === orderId);
            if (order) {
                setSelectedOrder(order);
                setHighlightedOrderId(orderId);
                // Optionally clear the search param
                const newParams = new URLSearchParams(searchParams);
                newParams.delete('orderId');
                setSearchParams(newParams);
            }
        }
    }, [pendingOrders, searchParams, setSearchParams, preferences]);

    // ESC key handler for modals
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (showRejectModal) {
                    setShowRejectModal(false);
                    setRejectReason('');
                } else if (selectedOrder) {
                    setSelectedOrder(null);
                }
            }
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [showRejectModal, selectedOrder]);

    // Mutations
    const receiveMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) =>
            api.receiveTransferOrder(id, data),
        onSuccess: () => {
            toast.success('تم تأكيد الاستلام وإضافة الأصناف للمخزن');
            queryClient.invalidateQueries({ queryKey: ['pending-orders'] });
            queryClient.invalidateQueries({ queryKey: ['all-orders'] });
            queryClient.invalidateQueries({ queryKey: ['warehouse-sims'] });
            queryClient.invalidateQueries({ queryKey: ['warehouse-machines'] });
            setSelectedOrder(null);
        },
        onError: (error: any) => {
            toast.error(error.message || 'فشل في تأكيد الاستلام');
        }
    });

    const rejectMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) =>
            api.rejectTransferOrder(id, data),
        onSuccess: () => {
            toast.success('تم رفض الإذن');
            queryClient.invalidateQueries({ queryKey: ['pending-orders'] });
            queryClient.invalidateQueries({ queryKey: ['all-orders'] });
            setSelectedOrder(null);
            setShowRejectModal(false);
            setRejectReason('');
        },
        onError: (error: any) => {
            toast.error(error.message || 'فشل في رفض الإذن');
        }
    });

    const cancelMutation = useMutation({
        mutationFn: (id: string) => api.cancelTransferOrder(id),
        onSuccess: () => {
            toast.success('تم إلغاء الإذن بنجاح');
            queryClient.invalidateQueries({ queryKey: ['pending-orders'] });
            queryClient.invalidateQueries({ queryKey: ['all-orders'] });
            setSelectedOrder(null);
        },
        onError: (error: any) => {
            toast.error(error.message || 'فشل في إلغاء الإذن');
        }
    });

    const handleReceive = (order: any) => {
        receiveMutation.mutate({
            id: order.id,
            data: {
                receivedBy: user?.id,
                receivedByName: user?.displayName
            }
        });
    };

    const handleReject = () => {
        if (!selectedOrder) return;

        rejectMutation.mutate({
            id: selectedOrder.id,
            data: {
                rejectionReason: rejectReason,
                receivedBy: user?.id,
                receivedByName: user?.displayName
            }
        });
    };

    const openRejectModal = (order: any) => {
        setSelectedOrder(order);
        setRejectReason('');
        setShowRejectModal(true);
    };

    const historyOrders = (Array.isArray(allOrders) ? allOrders : []).filter((o: any) => o.status !== 'PENDING') || [];

    const actionElements = (
        <div className="flex items-center gap-3">
            {Array.isArray(pendingOrders) && pendingOrders.length > 0 && (
                <div className="bg-amber-50 text-amber-600 border border-amber-100 px-5 py-2.5 rounded-2xl flex items-center gap-3 shadow-sm">
                    <div className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                    <span className="text-[10px] font-black uppercase tracking-widest">{pendingOrders.length} أذون معلقة</span>
                </div>
            )}
        </div>
    );

    return (
        <div className="px-8 pt-6 pb-20 bg-slate-50/50 min-h-screen" dir="rtl">
            <PageHeader
                title="استلام وإدارة التحويلات"
                subtitle="متابعة أذونات استلام الماكينات والشرائح وقطع الغيار"
                actions={actionElements}
                icon={<Package size={28} className="text-green-600" />}
            />

            {/* Premium Tab Navigation */}
            <div className="flex gap-2 p-1.5 bg-slate-100/50 backdrop-blur-md rounded-[2rem] w-fit mb-10 border border-slate-200/50 shadow-sm">
                {[
                    { id: 'pending', label: 'الأذونات المعلقة', icon: Clock },
                    { id: 'history', label: 'سجل التحويلات', icon: ClipboardList }
                ].map(tab => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={cn(
                                "relative px-8 py-3.5 rounded-[1.5rem] flex items-center gap-3 transition-all duration-500 overflow-hidden group",
                                isActive
                                    ? "bg-slate-900 text-white shadow-2xl shadow-slate-900/30"
                                    : "text-slate-500 hover:bg-white hover:text-slate-900 hover:shadow-lg hover:shadow-slate-200/50"
                            )}
                        >
                            <Icon size={18} className={cn("transition-transform duration-500", isActive ? "scale-110" : "group-hover:scale-110")} strokeWidth={isActive ? 3 : 2} />
                            <span className="text-sm font-black tracking-tight">{tab.label}</span>
                            {isActive && tab.id === 'pending' && Array.isArray(pendingOrders) && pendingOrders.length > 0 && (
                                <span className="bg-white text-slate-900 px-2 py-0.5 rounded-lg text-[10px] font-black">{pendingOrders.length}</span>
                            )}
                            {isActive && (
                                <motion.div
                                    layoutId="tab-glow-recv"
                                    className="absolute -right-2 -bottom-2 w-12 h-12 bg-white/10 rounded-full blur-xl"
                                />
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Pending Tab Content */}
            {activeTab === 'pending' && (
                <div className="space-y-6">
                    {loadingPending ? (
                        <div className="p-20 text-center flex flex-col items-center gap-4">
                            <div className="w-12 h-12 border-4 border-slate-100 border-t-slate-900 rounded-full animate-spin" />
                            <span className="text-sm font-bold text-slate-400">جاري تحميل الأذونات المعلقة...</span>
                        </div>
                    ) : (Array.isArray(pendingOrders) ? pendingOrders : []).length === 0 ? (
                        <div className="p-20 text-center flex flex-col items-center gap-4 bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 opacity-50">
                            <CheckCircle size={64} className="text-emerald-500" />
                            <div>
                                <h3 className="text-xl font-black text-slate-900">لا توجد أذونات معلقة</h3>
                                <p className="text-sm font-bold text-slate-400 mt-1 uppercase tracking-widest">كل العمليات مكتملة ومنتظمة</p>
                            </div>
                        </div>
                    ) : (
                        <div className="grid gap-6">
                            {(Array.isArray(pendingOrders) ? pendingOrders : []).map((order: any, idx: number) => {
                                const orderType = ORDER_TYPES[order.type] || ORDER_TYPES.MACHINE;
                                const TypeIcon = orderType.icon;

                                return (
                                    <motion.div
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: idx * 0.05 }}
                                        key={order.id}
                                        className="bg-white rounded-[2.5rem] border border-slate-100 p-8 hover:shadow-2xl hover:shadow-slate-200/50 transition-all group"
                                    >
                                        <div className="flex justify-between items-center">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-4 mb-4">
                                                    <span className="text-sm font-black text-slate-900 font-mono italic tracking-tighter bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100 group-hover:bg-slate-900 group-hover:text-white transition-all">
                                                        #{order.orderNumber}
                                                    </span>
                                                    <span className={cn(
                                                        "px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2",
                                                        orderType.color === 'purple' ? "bg-purple-50 text-purple-700 border border-purple-100" :
                                                            orderType.color === 'green' ? "bg-emerald-50 text-emerald-700 border border-emerald-100" :
                                                                orderType.color === 'blue' ? "bg-blue-50 text-blue-700 border border-blue-100" :
                                                                    "bg-orange-50 text-orange-700 border border-orange-100"
                                                    )}>
                                                        <TypeIcon size={14} strokeWidth={3} />
                                                        {orderType.label}
                                                    </span>
                                                    <span className="bg-slate-50 text-slate-400 border border-slate-100 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest">
                                                        {order.items?.length} وحدات
                                                    </span>
                                                </div>

                                                <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
                                                    <div className="flex flex-col">
                                                        <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1 leading-none">مرسل بواسطة</span>
                                                        <span className="text-sm font-black text-slate-900">{order.createdByName}</span>
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1 leading-none">تاريخ الإذن</span>
                                                        <span className="text-sm font-black text-slate-900">{new Date(order.createdAt).toLocaleDateString('ar-EG')}</span>
                                                        <span className="text-[10px] font-bold text-slate-400 font-mono mt-0.5">{new Date(order.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                                                    </div>
                                                    {order.notes && (
                                                        <div className="col-span-2 md:col-span-1 bg-amber-50/50 p-4 rounded-2xl border border-amber-100/50 flex items-start gap-3">
                                                            <MessageSquare size={16} className="text-amber-500 mt-0.5" />
                                                            <p className="text-[11px] font-bold text-amber-900 leading-relaxed italic">{order.notes}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3 pr-8">
                                                <button
                                                    onClick={() => setSelectedOrder(order)}
                                                    className="w-12 h-12 bg-white border border-slate-100 text-slate-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 rounded-2xl transition-all flex items-center justify-center shadow-sm"
                                                    title="عرض التفاصيل"
                                                >
                                                    <Eye size={20} strokeWidth={2.5} />
                                                </button>
                                                {(() => {
                                                    const isReceiver = order.toBranchId === user?.branchId;
                                                    const isSender = order.fromBranchId === user?.branchId;

                                                    if (isReceiver) {
                                                        return (
                                                            <>
                                                                <button
                                                                    onClick={() => openRejectModal(order)}
                                                                    className="w-12 h-12 bg-white border border-slate-100 text-slate-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 rounded-2xl transition-all flex items-center justify-center shadow-sm"
                                                                    title="رفض الاستلام"
                                                                >
                                                                    <XCircle size={20} strokeWidth={2.5} />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleReceive(order)}
                                                                    disabled={receiveMutation.isPending}
                                                                    className="h-12 px-8 bg-slate-900 text-white text-xs font-black rounded-2xl hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10 active:scale-95 flex items-center gap-3 disabled:opacity-50"
                                                                >
                                                                    <CheckCircle size={18} strokeWidth={3} />
                                                                    تأكيد الاستلام
                                                                </button>
                                                            </>
                                                        );
                                                    } else if (isSender) {
                                                        return (
                                                            <button
                                                                onClick={() => cancelMutation.mutate(order.id)}
                                                                disabled={cancelMutation.isPending}
                                                                className="h-12 px-8 bg-orange-600 text-white text-xs font-black rounded-2xl hover:bg-orange-700 transition-all shadow-xl shadow-orange-600/10 active:scale-95 flex items-center gap-3 disabled:opacity-50"
                                                            >
                                                                <XCircle size={18} strokeWidth={3} />
                                                                إلغاء الإذن
                                                            </button>
                                                        );
                                                    }
                                                    return null;
                                                })()}
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* History Tab Content */}
            {activeTab === 'history' && (
                <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                    {loadingAll ? (
                        <div className="p-20 text-center flex flex-col items-center gap-4">
                            <div className="w-12 h-12 border-4 border-slate-100 border-t-slate-900 rounded-full animate-spin" />
                            <span className="text-sm font-bold text-slate-400">جاري استدعاء سجل التحويلات...</span>
                        </div>
                    ) : historyOrders.length === 0 ? (
                        <div className="p-20 text-center flex flex-col items-center gap-4 opacity-30">
                            <ClipboardList size={64} />
                            <span className="text-xl font-black">لا توجد عمليات سابقة مسجلة</span>
                        </div>
                    ) : (
                        <div className="overflow-x-auto custom-scroll">
                            <table className="w-full text-right border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/50 border-b border-slate-100">
                                        <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">رقم الإذن</th>
                                        <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">نوع الشحنة</th>
                                        <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">المحتوى</th>
                                        <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">الحالة</th>
                                        <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">تاريخ الاستلام</th>
                                        <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">المستلم</th>
                                        <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">التفاصيل</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {(Array.isArray(historyOrders) ? historyOrders : []).map((order: any) => {
                                        const status = STATUS_MAP[order.status];
                                        const orderType = ORDER_TYPES[order.type];
                                        const StatusIcon = status?.icon || Clock;

                                        return (
                                            <tr key={order.id} className="group hover:bg-slate-50/50 transition-colors">
                                                <td className="p-6">
                                                    <span className="text-sm font-black text-slate-900 font-mono italic tracking-tighter">#{order.orderNumber}</span>
                                                </td>
                                                <td className="p-6">
                                                    <span className={cn(
                                                        "px-4 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border",
                                                        orderType?.color === 'purple' ? "bg-purple-50 text-purple-700 border-purple-100" :
                                                            orderType?.color === 'green' ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                                                                orderType?.color === 'blue' ? "bg-blue-50 text-blue-700 border-blue-100" :
                                                                    "bg-orange-50 text-orange-700 border-orange-100"
                                                    )}>
                                                        {orderType?.label}
                                                    </span>
                                                </td>
                                                <td className="p-6">
                                                    <span className="text-sm font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-lg">{order.items?.length} وحدات</span>
                                                </td>
                                                <td className="p-6">
                                                    <div className="flex justify-center">
                                                        <div className={cn(
                                                            "px-4 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border flex items-center gap-2",
                                                            status?.color === 'yellow' ? "bg-yellow-50 text-yellow-700 border-yellow-100" :
                                                                status?.color === 'green' ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                                                                    status?.color === 'blue' ? "bg-blue-50 text-blue-700 border-blue-100" :
                                                                        status?.color === 'slate' ? "bg-slate-50 text-slate-700 border-slate-100" :
                                                                            "bg-red-50 text-red-700 border-red-100"
                                                        )}>
                                                            <StatusIcon size={14} strokeWidth={3} />
                                                            {status?.label}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-6 flex flex-col">
                                                    <span className="text-sm font-black text-slate-900">{order.receivedAt ? new Date(order.receivedAt).toLocaleDateString('ar-EG') : '-'}</span>
                                                    <span className="text-[10px] font-bold text-slate-400 font-mono">{order.receivedAt ? new Date(order.receivedAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                                                </td>
                                                <td className="p-6">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400"><Users size={16} /></div>
                                                        <span className="text-sm font-bold text-slate-700">{order.receivedByName || '-'}</span>
                                                    </div>
                                                </td>
                                                <td className="p-6 text-center">
                                                    <button
                                                        onClick={() => setSelectedOrder(order)}
                                                        className="w-10 h-10 bg-white border border-slate-100 text-slate-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 rounded-xl transition-all flex items-center justify-center shadow-sm mx-auto"
                                                    >
                                                        <Eye size={18} strokeWidth={2.5} />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* View Order Modal */}
            {selectedOrder && !showRejectModal && (
                <div className="modal-overlay" onClick={() => setSelectedOrder(null)}>
                    <div
                        className={`modal-container modal-lg ${highlightedOrderId === selectedOrder.id ? 'ring-4 ring-primary ring-opacity-50' : ''}`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="modal-header">
                            <div className="modal-header-content">
                                <FileText className="modal-icon text-blue-600" size={24} />
                                <h2 className="modal-title">{selectedOrder.orderNumber}</h2>
                            </div>
                            <button type="button" className="modal-close" onClick={() => setSelectedOrder(null)}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className="modal-body">
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6 grid grid-cols-2 gap-4">
                                <div>
                                    <span className="text-xs text-slate-500 block mb-1">تاريخ الإذن</span>
                                    <span className="text-sm font-bold">{new Date(selectedOrder.createdAt).toLocaleString('ar-EG')}</span>
                                </div>
                                <div>
                                    <span className="text-xs text-slate-500 block mb-1">بواسطة</span>
                                    <span className="text-sm font-bold">{selectedOrder.createdByName}</span>
                                </div>
                            </div>

                            <div className="flex justify-between items-center mb-3">
                                <h3 className="font-bold text-primary flex items-center gap-2">
                                    <Package size={18} />
                                    الأصناف ({selectedOrder.items?.length})
                                </h3>
                            </div>

                            <div className="border rounded-xl overflow-hidden">
                                <div className="max-h-[300px] overflow-auto">
                                    <table className="w-full text-right text-sm">
                                        <thead className="bg-slate-50 sticky top-0 border-b">
                                            <tr>
                                                <th className="px-4 py-2 border-l">السيريال</th>
                                                <th className="px-4 py-2 border-l">
                                                    {selectedOrder.type === 'SIM' ? 'النوع' : 'الموديل'}
                                                </th>
                                                <th className="px-4 py-2 border-l">المصنع</th>
                                                {['MAINTENANCE', 'SEND_TO_CENTER'].includes(selectedOrder.type) && (
                                                    <th className="px-4 py-2">المشكلة</th>
                                                )}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {selectedOrder.items?.map((item: any) => (
                                                <tr key={item.id} className="hover:bg-slate-50">
                                                    <td className="px-4 py-2 font-mono font-bold text-primary">{item.serialNumber}</td>
                                                    <td className="px-4 py-2">
                                                        {(selectedOrder.type === 'SIM' ? item.type : item.model) || '-'}
                                                    </td>
                                                    <td className="px-4 py-2">{item.manufacturer || '-'}</td>
                                                    {['MAINTENANCE', 'SEND_TO_CENTER'].includes(selectedOrder.type) && (
                                                        <td className="px-4 py-2">
                                                            {item.complaint ? (
                                                                <span className="text-red-600 bg-red-50 px-2 py-0.5 rounded text-[11px] font-bold">
                                                                    {item.complaint}
                                                                </span>
                                                            ) : (
                                                                <span className="text-slate-400">-</span>
                                                            )}
                                                        </td>
                                                    )}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button
                                onClick={() => setSelectedOrder(null)}
                                className="smart-btn-secondary"
                            >
                                إغلاق
                            </button>
                            {selectedOrder.status === 'PENDING' && (() => {
                                const isReceiver = selectedOrder.toBranchId === user?.branchId;
                                const isSender = selectedOrder.fromBranchId === user?.branchId;

                                if (isReceiver) {
                                    return (
                                        <>
                                            <button
                                                onClick={() => setShowRejectModal(true)}
                                                className="smart-btn-secondary text-red-600 border-red-200 hover:bg-red-50"
                                            >
                                                رفض الاستلام
                                            </button>
                                            <button
                                                onClick={() => handleReceive(selectedOrder)}
                                                disabled={receiveMutation.isPending}
                                                className="smart-btn-primary bg-green-600 hover:bg-green-700"
                                            >
                                                <Check size={18} />
                                                تأكيد الاستلام
                                            </button>
                                        </>
                                    );
                                } else if (isSender) {
                                    return (
                                        <button
                                            onClick={() => cancelMutation.mutate(selectedOrder.id)}
                                            disabled={cancelMutation.isPending}
                                            className="smart-btn-primary bg-orange-500 hover:bg-orange-600"
                                        >
                                            <XCircle size={18} />
                                            إلغاء الإذن
                                        </button>
                                    );
                                }
                                return null;
                            })()}
                        </div>
                    </div>
                </div>
            )}

            {/* Reject Modal */}
            {showRejectModal && selectedOrder && (
                <div className="modal-overlay" onClick={() => { setShowRejectModal(false); setRejectReason(''); }}>
                    <div className="modal-container modal-sm" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header bg-red-50">
                            <div className="modal-header-content">
                                <XCircle className="modal-icon text-red-600" size={24} />
                                <h2 className="modal-title text-red-700">رفض الإذن</h2>
                            </div>
                            <button
                                type="button"
                                className="modal-close"
                                onClick={() => { setShowRejectModal(false); setRejectReason(''); }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="modal-body">
                            <div className="bg-red-50 border border-red-100 rounded-xl p-4 mb-6">
                                <p className="text-sm text-red-800 leading-relaxed">
                                    هل أنت متأكد من رفض الإذن رقم <strong>{selectedOrder.orderNumber}</strong>؟ سيتم إعادة الأصناف لعهد المرسل ولن تتم العملية.
                                </p>
                            </div>

                            <div className="modal-form-field">
                                <label className="modal-form-label required">سبب الرفض</label>
                                <textarea
                                    value={rejectReason}
                                    onChange={e => setRejectReason(e.target.value)}
                                    className="smart-input min-h-[100px] py-3"
                                    placeholder="يرجى ذكر سبب الرفض بالتفصيل ليتمكن المرسل من تصحيحه..."
                                    required
                                />
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button
                                onClick={() => { setShowRejectModal(false); setRejectReason(''); }}
                                className="smart-btn-secondary"
                            >
                                إلغاء
                            </button>
                            <button
                                onClick={handleReject}
                                disabled={rejectMutation.isPending || !rejectReason.trim()}
                                className="smart-btn-primary bg-red-600 hover:bg-red-700"
                            >
                                {rejectMutation.isPending ? 'جاري الرفض...' : 'تأكيد الرفض النهائي'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
