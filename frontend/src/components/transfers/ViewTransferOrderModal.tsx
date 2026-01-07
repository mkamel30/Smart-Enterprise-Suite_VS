import React, { useState } from 'react';
import { X, FileText, CheckCircle, Clock } from 'lucide-react';
import { ORDER_TYPES, STATUS_MAP } from './constants';
import { TransferOrderStatusBadge } from './TransferBadges';
import { Button } from '../ui/button';
import { useAuth } from '../../context/AuthContext';

interface ViewOrderModalProps {
    order: any;
    onClose: () => void;
    onReceive: (id: string, items?: string[]) => void;
    onReject: (id: string, reason: string) => void;
    onCancel?: (id: string) => void;
    isProcessing: boolean;
    highlightedOrderId?: string | null;
}

export function ViewTransferOrderModal({ order, onClose, onReceive, onReject, onCancel, isProcessing, highlightedOrderId }: ViewOrderModalProps) {
    const { user } = useAuth();
    const [rejectReason, setRejectReason] = useState('');
    const [showRejectForm, setShowRejectForm] = useState(false);

    if (!order) return null;

    const canAction = order.status === 'PENDING' && (
        user?.role === 'SUPER_ADMIN' ||
        user?.role === 'MANAGEMENT' ||
        user?.branchId === order.toBranchId
    );

    const canCancel = order.status === 'PENDING' && (
        user?.role === 'SUPER_ADMIN' ||
        user?.role === 'MANAGEMENT' ||
        // Check if user is the creator (by ID if available, or just role based if not tracked perfectly on frontend)
        // Ideally backend checks this, but frontend should show it.
        // Assuming order.createdByUserId is available, or we just trust the backend.
        // For now, let's enable it for Admin Affairs if they created it.
        (user?.role === 'ADMIN_AFFAIRS' && order.fromBranch?.type === 'ADMIN_AFFAIRS') ||
        user?.id === order.createdByUserId
    );

    const handleReject = () => {
        if (!rejectReason.trim()) return;
        onReject(order.id, rejectReason);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[150] p-4">
            <div className={`bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col ${highlightedOrderId === order.id ? 'animate-highlight-pulse ring-4 ring-primary' : ''
                }`}>
                <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        <FileText className="text-blue-600" />
                        تفاصيل الإذن {order.orderNumber}
                    </h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-700 p-1 hover:bg-slate-200 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-6 flex-1">
                    {/* Order Info */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <div className="text-xs text-slate-500 mb-1 uppercase tracking-wider">من الفرع</div>
                            <div className="font-bold text-red-600">{order.fromBranch?.name || '—'}</div>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <div className="text-xs text-slate-500 mb-1 uppercase tracking-wider">إلى الفرع</div>
                            <div className="font-bold text-green-600">{order.toBranch?.name || '—'}</div>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <div className="text-xs text-slate-500 mb-1 uppercase tracking-wider">النوع</div>
                            <div className="font-bold">{ORDER_TYPES.find(t => t.value === order.type)?.label}</div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <div className="text-xs text-slate-500 mb-1 uppercase tracking-wider">الحالة</div>
                            <div className="mt-1">
                                <TransferOrderStatusBadge status={order.status} />
                            </div>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <div className="text-xs text-slate-500 mb-1 uppercase tracking-wider">تاريخ الإنشاء</div>
                            <div className="font-medium">{new Date(order.createdAt).toLocaleString('ar-EG')}</div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-slate-600">
                        <div className="flex justify-between p-2 border-b">
                            <span>أنشئ بواسطة:</span>
                            <span className="font-medium text-slate-900">{order.createdByName}</span>
                        </div>
                        {order.receivedByName && (
                            <>
                                <div className="flex justify-between p-2 border-b">
                                    <span>استلم بواسطة:</span>
                                    <span className="font-medium text-slate-900">{order.receivedByName}</span>
                                </div>
                                <div className="flex justify-between p-2 border-b">
                                    <span>تاريخ الاستلام:</span>
                                    <span className="font-medium text-slate-900">{new Date(order.receivedAt).toLocaleString('ar-EG')}</span>
                                </div>
                            </>
                        )}
                    </div>

                    {order.notes && (
                        <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100">
                            <div className="text-xs text-yellow-700 font-bold mb-1 uppercase tracking-wider">ملاحظات</div>
                            <div className="text-sm text-yellow-800">{order.notes}</div>
                        </div>
                    )}

                    {order.rejectionReason && (
                        <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                            <div className="text-xs text-red-700 font-bold mb-1 uppercase tracking-wider">سبب الرفض</div>
                            <div className="text-sm text-red-800">{order.rejectionReason}</div>
                        </div>
                    )}

                    {/* Items */}
                    <div>
                        <h3 className="font-bold mb-3 flex items-center gap-2">
                            الأصناف ({order.items?.length})
                        </h3>
                        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                            <div className="max-h-[300px] overflow-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 sticky top-0 border-b border-slate-200">
                                        <tr>
                                            <th className="text-center px-4 py-3 font-medium text-slate-500">#</th>
                                            <th className="text-center px-4 py-3 font-medium text-slate-500">السيريال</th>
                                            <th className="text-center px-4 py-3 font-medium text-slate-500">النوع</th>
                                            <th className="text-center px-4 py-3 font-medium text-slate-500">الحالة</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {order.items?.map((item: any, index: number) => (
                                            <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-4 py-3 text-slate-400">{index + 1}</td>
                                                <td className="px-4 py-3 font-mono font-medium">{item.serialNumber}</td>
                                                <td className="px-4 py-3 text-slate-600">{item.type || item.manufacturer || '-'}</td>
                                                <td className="px-4 py-3">
                                                    {item.isReceived ? (
                                                        <span className="text-green-600 flex items-center gap-1 font-medium">
                                                            <CheckCircle size={14} /> مستلم
                                                        </span>
                                                    ) : (
                                                        <span className="text-yellow-600 flex items-center gap-1 font-medium">
                                                            <Clock size={14} /> معلق
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* Reject Form */}
                    {showRejectForm && (
                        <div className="bg-red-50 p-4 rounded-xl border border-red-100 animate-in fade-in zoom-in-95 duration-200">
                            <label className="block text-sm font-bold text-red-800 mb-2">سبب الرفض</label>
                            <textarea
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                className="w-full p-2 rounded-lg border-red-200 focus:ring-red-500 text-sm"
                                placeholder="اكتب سبب الرفض هنا..."
                            ></textarea>
                            <div className="flex gap-2 mt-2">
                                <Button size="sm" variant="destructive" onClick={handleReject} disabled={!rejectReason || isProcessing}>
                                    تأكيد الرفض
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setShowRejectForm(false)} className="bg-white">
                                    إلغاء
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t bg-slate-50 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 bg-white border border-slate-200 py-3 rounded-xl font-bold hover:bg-slate-100 transition-colors shadow-sm"
                    >
                        إغلاق
                    </button>
                    {canCancel && onCancel && (
                        <Button
                            onClick={() => {
                                if (window.confirm('هل أنت متأكد من رغبتك في إلغاء هذا الإذن؟ سيتم إعادة الأصناف إلى المخزن.')) {
                                    onCancel(order.id);
                                }
                            }}
                            variant="secondary"
                            className="bg-red-100 text-red-700 hover:bg-red-200 border border-red-200 rounded-xl px-6 py-6 font-bold"
                            disabled={isProcessing}
                        >
                            إلغاء الإذن
                        </Button>
                    )}
                    {canAction && !showRejectForm && (
                        <>
                            <Button
                                onClick={() => setShowRejectForm(true)}
                                variant="destructive"
                                className="px-6 py-6 rounded-xl font-bold"
                                disabled={isProcessing}
                            >
                                رفض الإذن
                            </Button>
                            <Button
                                onClick={() => onReceive(order.id)}
                                className="flex-1 bg-green-600 hover:bg-green-700 text-white rounded-xl py-6 font-bold shadow-lg shadow-green-500/20"
                                disabled={isProcessing}
                            >
                                {isProcessing ? 'جاري التنفيذ...' : 'تأكيد استلام الأصناف'}
                            </Button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
