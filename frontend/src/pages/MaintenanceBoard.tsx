import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import {
    LayoutDashboard, Package, Truck, Clock,
    CheckCircle, Eye, X,
    MessageSquare, RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import MaintenanceKanban from '../components/warehouse/MaintenanceKanban';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { cn } from '../lib/utils';

export default function MaintenanceBoard() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [activeView, setActiveView] = useState<'KANBAN' | 'INCOMING'>('KANBAN');
    const [selectedOrder, setSelectedOrder] = useState<any>(null);

    // Queries
    const { data: pendingOrders, isLoading: loadingPending } = useQuery({
        queryKey: ['pending-orders', user?.branchId],
        queryFn: () => api.getPendingTransferOrders(),
        enabled: activeView === 'INCOMING' || !!user?.branchId
    });

    // Filtering only maintenance shipments for this center
    const maintenanceShipments = pendingOrders?.filter((o: any) =>
        (o.type === 'MAINTENANCE' || o.type === 'MACHINE') &&
        o.toBranchId === user?.branchId
    ) || [];

    // Mutations
    const receiveMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) =>
            api.receiveTransferOrder(id, data),
        onSuccess: () => {
            toast.success('تم استلام الشحنة بنجاح');
            queryClient.invalidateQueries({ queryKey: ['pending-orders'] });
            queryClient.invalidateQueries({ queryKey: ['warehouse-machines'] });
            queryClient.invalidateQueries({ queryKey: ['machine-workflow', 'kanban'] });
            setSelectedOrder(null);
        },
        onError: (err: any) => toast.error(err.message || 'فشل الاستلام')
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

    return (
        <div className="px-8 pt-4 pb-8 space-y-8 max-w-400 mx-auto" dir="rtl">
            {/* Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                    <h1 className="text-3xl lg:text-4xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <LayoutDashboard className="text-purple-600" size={32} />
                        إدارة مركز الصيانة
                    </h1>
                    <p className="text-slate-500 mt-2 font-medium">متابعة الأجهزة المستلمة، الفحص، وعمليات الإصلاح</p>
                </div>

                <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                    <button
                        onClick={() => setActiveView('KANBAN')}
                        className={cn(
                            "px-6 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
                            activeView === 'KANBAN' ? "bg-white text-purple-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                        )}
                    >
                        <RefreshCw size={16} />
                        سير العمل
                    </button>
                    <button
                        onClick={() => setActiveView('INCOMING')}
                        className={cn(
                            "px-6 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 relative",
                            activeView === 'INCOMING' ? "bg-white text-purple-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                        )}
                    >
                        <Truck size={16} />
                        الشحنات الواردة
                        {maintenanceShipments.length > 0 && (
                            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">
                                {maintenanceShipments.length}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="bg-white/40 backdrop-blur-xl border border-slate-200 rounded-3xl p-6 shadow-sm min-h-150">
                {activeView === 'KANBAN' ? (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <MaintenanceKanban />
                    </div>
                ) : (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <Package className="text-blue-500" />
                                بانتظار الاستلام بالمركز
                            </h2>
                        </div>

                        {loadingPending ? (
                            <div className="p-12 text-center text-slate-400 italic">جاري تحميل الأذونات...</div>
                        ) : maintenanceShipments.length === 0 ? (
                            <div className="p-12 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                                <CheckCircle className="mx-auto text-green-400 mb-4" size={48} />
                                <p className="text-slate-600 font-bold">لا توجد شحنات واردة معلقة</p>
                                <p className="text-slate-400 text-sm mt-1">سيتم عرض الشحنات المحولة للمركز هنا للاستلام</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {maintenanceShipments.map((order: any) => (
                                    <div key={order.id} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow group relative overflow-hidden">
                                        <div className="absolute top-0 right-0 w-1 h-full bg-blue-500" />

                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1">إذن تحويل</span>
                                                <h3 className="font-mono font-bold text-lg text-slate-800">{order.orderNumber}</h3>
                                            </div>
                                            <Badge className="bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100 transition-colors">
                                                {order.items?.length} صنف
                                            </Badge>
                                        </div>

                                        <div className="space-y-3 mb-6">
                                            <div className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                                                <Truck size={14} className="text-slate-400" />
                                                <span>من: {order.fromBranch?.name}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm text-slate-500">
                                                <Clock size={14} />
                                                <span>{new Date(order.createdAt).toLocaleString('ar-EG')}</span>
                                            </div>
                                        </div>

                                        <div className="flex gap-2">
                                            <Button
                                                onClick={() => handleReceive(order)}
                                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 rounded-xl"
                                                disabled={receiveMutation.isPending}
                                            >
                                                استلام الكل
                                            </Button>
                                            <Button
                                                variant="outline"
                                                onClick={() => setSelectedOrder(order)}
                                                className="h-11 rounded-xl border-slate-200 text-slate-600"
                                            >
                                                <Eye size={18} />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* View Order Modal */}
            {selectedOrder && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b flex justify-between items-center bg-slate-50/50">
                            <h2 className="text-xl font-bold flex items-center gap-3 text-slate-800">
                                <Package className="text-blue-600" />
                                تفاصيل الإذن {selectedOrder.orderNumber}
                            </h2>
                            <button onClick={() => setSelectedOrder(null)} className="text-slate-400 hover:text-slate-600">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                                    <span className="text-[10px] font-black text-slate-400 block mb-1 uppercase tracking-widest">المصدر</span>
                                    <p className="font-bold text-slate-800">{selectedOrder.fromBranch?.name}</p>
                                </div>
                                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                                    <span className="text-[10px] font-black text-slate-400 block mb-1 uppercase tracking-widest">بواسطة</span>
                                    <p className="font-bold text-slate-800">{selectedOrder.createdByName}</p>
                                </div>
                            </div>

                            {selectedOrder.notes && (
                                <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-100 flex gap-3 text-amber-800 text-sm">
                                    <MessageSquare size={18} className="shrink-0 mt-0.5" />
                                    <p className="italic font-medium">{selectedOrder.notes}</p>
                                </div>
                            )}

                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-3 pr-2">الأصناف المحولة</h3>
                            <div className="border border-slate-100 rounded-2xl overflow-hidden bg-white">
                                <table className="w-full text-right">
                                    <thead className="bg-slate-50 border-b border-slate-100">
                                        <tr>
                                            <th className="px-4 py-3 text-xs font-black text-slate-400 uppercase">السيريال</th>
                                            <th className="px-4 py-3 text-xs font-black text-slate-400 uppercase">الموديل</th>
                                            <th className="px-4 py-3 text-xs font-black text-slate-400 uppercase">المصنع</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {selectedOrder.items?.map((item: any) => (
                                            <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-4 py-3 font-mono text-sm font-bold text-slate-700">{item.serialNumber}</td>
                                                <td className="px-4 py-3 text-sm text-slate-600">{item.model || '-'}</td>
                                                <td className="px-4 py-3 text-sm text-slate-600">{item.manufacturer || '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="p-6 border-t bg-slate-50/50 flex gap-3">
                            <Button
                                onClick={() => handleReceive(selectedOrder)}
                                disabled={receiveMutation.isPending}
                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 rounded-2xl shadow-lg shadow-blue-200"
                            >
                                <CheckCircle size={18} className="ml-2" />
                                تأكيد الاستلام بالكامل
                            </Button>
                            <Button
                                onClick={() => setSelectedOrder(null)}
                                variant="outline"
                                className="px-8 h-12 rounded-2xl border-slate-200 font-bold"
                            >
                                إغلاق
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
