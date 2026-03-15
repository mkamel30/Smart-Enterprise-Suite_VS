import React, { useState } from 'react';
import { X, FileText, CheckCircle, Clock, ArrowLeftRight, User, Calendar, StickyNote, AlertCircle, Package } from 'lucide-react';
import { ORDER_TYPES } from './constants';
import { TransferOrderStatusBadge } from './TransferBadges';
import { Button } from '../ui/button';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

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
        (user?.role === 'ADMIN_AFFAIRS' && order.fromBranch?.type === 'ADMIN_AFFAIRS') ||
        user?.id === order.createdByUserId
    );

    const handleReject = () => {
        if (!rejectReason.trim()) return;
        onReject(order.id, rejectReason);
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[150] p-4 overflow-y-auto">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className={cn(
                    "bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col border border-white/20",
                    highlightedOrderId === order.id ? 'ring-4 ring-indigo-500/20' : ''
                )}
            >
                {/* Header */}
                <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
                            <FileText size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-900 dark:text-white">تفاصيل الإذن</h2>
                            <p className="text-xs font-mono font-black text-indigo-600 uppercase tracking-tighter">#{order.orderNumber}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto">
                    {/* Route Info */}
                    <div className="relative">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-slate-50 dark:bg-slate-800/50 p-6 rounded-[24px] border border-slate-100 dark:border-slate-800">
                            <div className="space-y-1">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">جهة الإرسال</span>
                                <div className="text-lg font-black text-slate-900 dark:text-white">{order.fromBranch?.name || '—'}</div>
                            </div>
                            <div className="space-y-1 sm:text-left">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">جهة الاستلام</span>
                                <div className="text-lg font-black text-indigo-600">{order.toBranch?.name || '—'}</div>
                            </div>
                            {/* Direction Arrow */}
                            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden sm:flex w-10 h-10 bg-white dark:bg-slate-700 rounded-full border border-slate-100 dark:border-slate-600 items-center justify-center text-slate-400 shadow-sm">
                                <ArrowLeftRight size={18} />
                            </div>
                        </div>
                    </div>

                    {/* Meta Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 flex items-center justify-center"><Package size={16} /></div>
                            <div>
                                <span className="text-[10px] text-slate-400 font-black uppercase block">النوع</span>
                                <span className="text-xs font-black text-slate-700 dark:text-slate-300">{ORDER_TYPES.find(t => t.value === order.type)?.label}</span>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-600 flex items-center justify-center"><Calendar size={16} /></div>
                            <div>
                                <span className="text-[10px] text-slate-400 font-black uppercase block">التاريخ</span>
                                <span className="text-xs font-black text-slate-700 dark:text-slate-300">{new Date(order.createdAt).toLocaleDateString('ar-EG')}</span>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-3 col-span-2 sm:col-span-1">
                            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center"><User size={16} /></div>
                            <div>
                                <span className="text-[10px] text-slate-400 font-black uppercase block">بواسطة</span>
                                <span className="text-xs font-black text-slate-700 dark:text-slate-300">{order.createdByName}</span>
                            </div>
                        </div>
                    </div>

                    {/* Status Tracker */}
                    <div className="flex items-center gap-4 p-5 bg-indigo-50/50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100/50 dark:border-indigo-900/50">
                        <div className="flex-1">
                            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block mb-1">حالة الإذن الحالية</span>
                            <div className="flex items-center gap-3">
                                <TransferOrderStatusBadge status={order.status} />
                                {order.receivedAt && (
                                    <span className="text-[10px] text-indigo-400 font-black">
                                        استلم في {new Date(order.receivedAt).toLocaleString('ar-EG')}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Items List */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                                <Package size={16} className="text-indigo-600" />
                                الأصناف المشمولة ({order.items?.length})
                            </h3>
                        </div>
                        <div className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                            <table className="w-full text-right text-xs">
                                <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                                    <tr>
                                        <th className="px-6 py-3 font-black text-slate-400 uppercase">#</th>
                                        <th className="px-6 py-3 font-black text-slate-400 uppercase">الرقم التسلسلي</th>
                                        <th className="px-6 py-3 font-black text-slate-400 uppercase text-center">الحالة</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                    {order.items?.map((item: any, index: number) => (
                                        <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                            <td className="px-6 py-3 text-slate-300 font-black">{String(index + 1).padStart(2, '0')}</td>
                                            <td className="px-6 py-3 font-mono font-black text-slate-700 dark:text-slate-300">{item.serialNumber}</td>
                                            <td className="px-6 py-3 text-center">
                                                {item.isReceived ? (
                                                    <span className="inline-flex items-center gap-1.5 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1 rounded-full font-black">
                                                        <CheckCircle size={12} /> استلم
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 text-amber-600 bg-amber-50 dark:bg-amber-900/30 px-3 py-1 rounded-full font-black">
                                                        <Clock size={12} /> معلق
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Notes & Reject Reason */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {order.notes && (
                            <div className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-900/20 flex gap-3">
                                <StickyNote size={18} className="text-amber-600 shrink-0" />
                                <div>
                                    <span className="text-[10px] font-black text-amber-600 uppercase block mb-1">ملاحظات الإذن</span>
                                    <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed font-medium">{order.notes}</p>
                                </div>
                            </div>
                        )}
                        {order.rejectionReason && (
                            <div className="p-4 bg-red-50 dark:bg-red-900/10 rounded-2xl border border-red-100 dark:border-red-900/20 flex gap-3">
                                <AlertCircle size={18} className="text-red-600 shrink-0" />
                                <div>
                                    <span className="text-[10px] font-black text-red-600 uppercase block mb-1">سبب الرفض</span>
                                    <p className="text-xs text-red-800 dark:text-red-200 leading-relaxed font-medium">{order.rejectionReason}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Reject Form */}
                    <AnimatePresence>
                        {showRejectForm && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="bg-red-50 dark:bg-red-900/10 p-6 rounded-[24px] border border-red-100 dark:border-red-900/20 space-y-4"
                            >
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-red-800 dark:text-red-400 block">يرجى كتابة سبب الرفض لتوضيح الأمر للمخزن الرئيسي</label>
                                    <textarea
                                        value={rejectReason}
                                        onChange={(e) => setRejectReason(e.target.value)}
                                        className="w-full p-4 rounded-xl border-red-200 focus:ring-red-500 focus:border-red-500 bg-white placeholder:text-red-200 text-sm font-medium"
                                        placeholder="مثال: الأصناف ناقصة، موديلات غير مطابقة..."
                                        rows={3}
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <Button size="sm" variant="destructive" onClick={handleReject} disabled={!rejectReason || isProcessing} className="flex-1 py-6 rounded-xl font-black">
                                        تأكيد رفض الإذن
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => setShowRejectForm(false)} className="px-6 py-6 rounded-xl font-black bg-white">
                                        إلغاء
                                    </Button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Footer Actions */}
                <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex gap-4">
                    <button
                        onClick={onClose}
                        className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 py-4 rounded-2xl font-black text-slate-600 dark:text-slate-400 hover:bg-slate-50 transition-all shadow-sm active:scale-95"
                    >
                        إغلاق
                    </button>

                    {canCancel && onCancel && !showRejectForm && (
                        <Button
                            onClick={() => {
                                if (window.confirm('هل أنت متأكد من رغبتك في إلغاء هذا الإذن؟ سيتم إعادة الأصناف إلى المخزن.')) {
                                    onCancel(order.id);
                                }
                            }}
                            className="bg-red-100 text-red-700 hover:bg-red-200 border border-red-200 rounded-2xl px-8 py-4 font-black transition-all active:scale-95"
                            disabled={isProcessing}
                        >
                            إلغاء الإذن
                        </Button>
                    )}

                    {canAction && !showRejectForm && (
                        <div className="flex gap-3 flex-[2]">
                            <Button
                                onClick={() => setShowRejectForm(true)}
                                variant="destructive"
                                className="px-8 py-8 rounded-2xl font-black transition-all shadow-lg active:scale-95"
                                disabled={isProcessing}
                            >
                                رفض
                            </Button>
                            <Button
                                onClick={() => onReceive(order.id)}
                                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl py-8 font-black shadow-xl shadow-indigo-100 transition-all active:scale-95"
                                disabled={isProcessing}
                            >
                                {isProcessing ? (
                                    <div className="flex items-center gap-2">
                                        <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                                        جاري المعالجة...
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <CheckCircle size={22} />
                                        تأكيد الاستلام
                                    </div>
                                )}
                            </Button>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
