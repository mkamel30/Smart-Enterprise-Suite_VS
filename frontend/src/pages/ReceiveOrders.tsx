import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useSearchParams } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import {
    Package, CheckCircle, XCircle, Clock,
    Smartphone, Monitor, AlertCircle, Eye, X,
    FileText, Check, MessageSquare
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const ORDER_TYPES: Record<string, { label: string; icon: any; color: string }> = {
    'SIM': { label: 'شرائح', icon: Smartphone, color: 'purple' },
    'MACHINE': { label: 'ماكينات', icon: Monitor, color: 'green' },
    'MAINTENANCE': { label: 'صيانة (ماكينات)', icon: Monitor, color: 'blue' },
    'SPARE_PART': { label: 'قطع غيار', icon: Package, color: 'orange' }
};

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
    'PENDING': { label: 'معلق', color: 'yellow', icon: Clock },
    'RECEIVED': { label: 'مستلم', color: 'green', icon: CheckCircle },
    'PARTIAL': { label: 'جزئي', color: 'blue', icon: AlertCircle },
    'REJECTED': { label: 'مرفوض', color: 'red', icon: XCircle }
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

    // Auto-open order from notification
    useEffect(() => {
        const orderId = searchParams.get('orderId');
        if (orderId && pendingOrders) {
            const order = pendingOrders.find((o: any) => o.id === orderId);
            if (order) {
                setSelectedOrder(order);
                setActiveTab('pending');
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
    }, [pendingOrders, searchParams, setSearchParams, preferences]);

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

    const historyOrders = allOrders?.filter((o: any) => o.status !== 'PENDING') || [];

    return (
        <div className="px-8 pt-4 pb-8 bg-gradient-to-br from-slate-50 to-blue-50/30 min-h-screen" dir="rtl">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-black text-[#0A2472] flex items-center gap-2">
                    <Package className="text-green-600" />
                    استلام الأذونات
                </h1>

                {/* Pending Badge */}
                {pendingOrders && pendingOrders.length > 0 && (
                    <div className="bg-yellow-100 text-yellow-800 px-4 py-2 rounded-lg flex items-center gap-2">
                        <Clock size={18} />
                        <span className="font-bold">{pendingOrders.length}</span>
                        <span>إذن معلق</span>
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6">
                <button
                    onClick={() => setActiveTab('pending')}
                    className={`px-6 py-3 rounded-xl font-black flex items-center gap-2 transition-all shadow-md ${activeTab === 'pending'
                        ? 'bg-gradient-to-r from-[#F5C451] to-[#F5C451]/90 text-[#0A2472]'
                        : 'bg-white text-[#0A2472] border-2 border-[#0A2472]/10 hover:bg-[#0A2472]/5'
                        }`}
                >
                    <Clock size={18} />
                    الأذونات المعلقة
                    {pendingOrders && pendingOrders.length > 0 && (
                        <span className="bg-white text-yellow-600 px-2 py-0.5 rounded-full text-sm font-bold">
                            {pendingOrders.length}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`px-6 py-3 rounded-xl font-black transition-all shadow-md ${activeTab === 'history'
                        ? 'bg-gradient-to-r from-[#0A2472] to-[#0A2472]/90 text-white'
                        : 'bg-white text-[#0A2472] border-2 border-[#0A2472]/10 hover:bg-[#0A2472]/5'
                        }`}
                >
                    السجل
                </button>
            </div>

            {/* Pending Tab */}
            {activeTab === 'pending' && (
                <div>
                    {loadingPending ? (
                        <div className="text-center py-8">جاري التحميل...</div>
                    ) : pendingOrders?.length === 0 ? (
                        <div className="text-center py-12 bg-slate-50 rounded-lg">
                            <CheckCircle size={48} className="mx-auto text-green-400 mb-4" />
                            <p className="text-slate-600 font-medium">لا توجد أذونات معلقة</p>
                            <p className="text-slate-500 text-sm">كل الأذونات تم استلامها</p>
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {pendingOrders?.map((order: any) => {
                                const orderType = ORDER_TYPES[order.type] || ORDER_TYPES.MACHINE;
                                const TypeIcon = orderType.icon;

                                return (
                                    <div
                                        key={order.id}
                                        className="bg-white rounded-lg border p-4 hover:shadow-md transition-shadow"
                                    >
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <span className="font-mono bg-slate-100 px-3 py-1 rounded text-lg">
                                                        {order.orderNumber}
                                                    </span>
                                                    <span className={`flex items-center gap-1 px-2 py-1 rounded text-sm bg-${orderType.color}-100 text-${orderType.color}-700`}>
                                                        <TypeIcon size={14} />
                                                        {orderType.label}
                                                    </span>
                                                    <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-sm">
                                                        {order.items?.length} صنف
                                                    </span>
                                                </div>

                                                <div className="text-sm text-slate-500 space-y-1">
                                                    <div>من: {order.createdByName}</div>
                                                    <div>التاريخ: {new Date(order.createdAt).toLocaleString('ar-EG')}</div>
                                                    {order.notes && (
                                                        <div className="flex items-start gap-1 text-yellow-700 bg-yellow-50 p-2 rounded mt-2">
                                                            <MessageSquare size={14} className="mt-0.5" />
                                                            {order.notes}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setSelectedOrder(order)}
                                                    className="px-4 py-2 border rounded-lg hover:bg-slate-50 flex items-center gap-1"
                                                >
                                                    <Eye size={16} />
                                                    عرض
                                                </button>
                                                <button
                                                    onClick={() => openRejectModal(order)}
                                                    className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 flex items-center gap-1"
                                                >
                                                    <XCircle size={16} />
                                                    رفض
                                                </button>
                                                <button
                                                    onClick={() => handleReceive(order)}
                                                    disabled={receiveMutation.isPending}
                                                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-1 disabled:opacity-50"
                                                >
                                                    <CheckCircle size={16} />
                                                    تأكيد الاستلام
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
                <div className="bg-white rounded-lg border overflow-hidden">
                    {loadingAll ? (
                        <div className="p-8 text-center">جاري التحميل...</div>
                    ) : historyOrders.length === 0 ? (
                        <div className="p-8 text-center text-slate-500">لا يوجد سجل</div>
                    ) : (
                        <table className="w-full">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="text-center px-4 py-3 font-medium">رقم الإذن</th>
                                    <th className="text-center px-4 py-3 font-medium">النوع</th>
                                    <th className="text-center px-4 py-3 font-medium">الأصناف</th>
                                    <th className="text-center px-4 py-3 font-medium">الحالة</th>
                                    <th className="text-center px-4 py-3 font-medium">تاريخ الاستلام</th>
                                    <th className="text-center px-4 py-3 font-medium">بواسطة</th>
                                    <th className="text-center px-4 py-3 font-medium">الإجراءات</th>
                                </tr>
                            </thead>
                            <tbody>
                                {historyOrders.map((order: any) => {
                                    const status = STATUS_MAP[order.status];
                                    const orderType = ORDER_TYPES[order.type];
                                    const StatusIcon = status?.icon || Clock;

                                    return (
                                        <tr key={order.id} className="border-t hover:bg-slate-50">
                                            <td className="px-4 py-3">
                                                <span className="font-mono">{order.orderNumber}</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 rounded text-sm bg-${orderType?.color}-100 text-${orderType?.color}-700`}>
                                                    {orderType?.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                {order.items?.length} صنف
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`flex items-center gap-1 px-2 py-1 rounded text-sm w-fit bg-${status?.color}-100 text-${status?.color}-700`}>
                                                    <StatusIcon size={14} />
                                                    {status?.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-500">
                                                {order.receivedAt ? new Date(order.receivedAt).toLocaleString('ar-EG') : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                {order.receivedByName || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                <button
                                                    onClick={() => setSelectedOrder(order)}
                                                    className="p-1 hover:bg-slate-100 rounded text-blue-600"
                                                    title="عرض التفاصيل"
                                                >
                                                    <Eye size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {/* View Order Modal */}
            {selectedOrder && !showRejectModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-150">
                    <div className={`bg-white rounded-xl shadow-2xl w-full max-w-md sm:max-w-lg max-h-[80vh] overflow-auto ${highlightedOrderId === selectedOrder.id ? 'animate-highlight-pulse ring-4 ring-primary' : ''
                        }`}>
                        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                            <h2 className="text-lg font-bold flex items-center gap-2">
                                <FileText className="text-blue-600" />
                                {selectedOrder.orderNumber}
                            </h2>
                            <button onClick={() => setSelectedOrder(null)} className="text-slate-500 hover:text-slate-700">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-4">
                            <div className="mb-4 text-sm text-slate-500">
                                <div>من: {selectedOrder.createdByName}</div>
                                <div>التاريخ: {new Date(selectedOrder.createdAt).toLocaleString('ar-EG')}</div>
                            </div>

                            <h3 className="font-medium mb-2">الأصناف ({selectedOrder.items?.length})</h3>
                            <div className="border rounded-lg max-h-[300px] overflow-auto">
                                <table className="w-full">
                                    <thead className="bg-slate-50 sticky top-0">
                                        <tr>
                                            <th className="text-right px-3 py-2 text-sm">#</th>
                                            <th className="text-right px-3 py-2 text-sm">السيريال</th>
                                            <th className="text-right px-3 py-2 text-sm">
                                                {selectedOrder.type === 'SIM' ? 'النوع' : 'الموديل'}
                                            </th>
                                            <th className="text-right px-3 py-2 text-sm">المصنع</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedOrder.items?.map((item: any, index: number) => (
                                            <tr key={item.id} className="border-t">
                                                <td className="px-3 py-2 text-sm text-slate-500">{index + 1}</td>
                                                <td className="px-3 py-2 font-mono text-sm">{item.serialNumber}</td>
                                                <td className="px-3 py-2 text-sm">
                                                    {(selectedOrder.type === 'SIM' ? item.type : item.model) || '-'}
                                                </td>
                                                <td className="px-3 py-2 text-sm">{item.manufacturer || '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="p-4 border-t flex gap-2">
                            {selectedOrder.status === 'PENDING' && (
                                <>
                                    <button
                                        onClick={() => handleReceive(selectedOrder)}
                                        disabled={receiveMutation.isPending}
                                        className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        <Check size={18} />
                                        تأكيد الاستلام
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowRejectModal(true);
                                        }}
                                        className="flex-1 bg-red-100 text-red-700 py-2 rounded-lg hover:bg-red-200 flex items-center justify-center gap-2"
                                    >
                                        <XCircle size={18} />
                                        رفض
                                    </button>
                                </>
                            )}
                            <button
                                onClick={() => setSelectedOrder(null)}
                                className="flex-1 border py-2 rounded-lg hover:bg-slate-50"
                            >
                                إغلاق
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reject Modal */}
            {showRejectModal && selectedOrder && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-2xl w-[400px]">
                        <div className="p-4 border-b flex justify-between items-center bg-red-50">
                            <h2 className="text-lg font-bold text-red-700 flex items-center gap-2">
                                <XCircle />
                                رفض الإذن
                            </h2>
                            <button
                                onClick={() => {
                                    setShowRejectModal(false);
                                    setRejectReason('');
                                }}
                                className="text-slate-500 hover:text-slate-700"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-4">
                            <p className="text-sm text-slate-600 mb-4">
                                هل أنت متأكد من رفض الإذن رقم <strong>{selectedOrder.orderNumber}</strong>؟
                            </p>

                            <label className="block text-sm font-medium mb-2">سبب الرفض</label>
                            <textarea
                                value={rejectReason}
                                onChange={e => setRejectReason(e.target.value)}
                                className="w-full border rounded-lg px-3 py-2"
                                rows={3}
                                placeholder="اكتب سبب الرفض..."
                            />
                        </div>

                        <div className="p-4 border-t flex gap-2">
                            <button
                                onClick={handleReject}
                                disabled={rejectMutation.isPending}
                                className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 disabled:opacity-50"
                            >
                                {rejectMutation.isPending ? 'جاري الرفض...' : 'تأكيد الرفض'}
                            </button>
                            <button
                                onClick={() => {
                                    setShowRejectModal(false);
                                    setRejectReason('');
                                }}
                                className="flex-1 border py-2 rounded-lg hover:bg-slate-50"
                            >
                                إلغاء
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
