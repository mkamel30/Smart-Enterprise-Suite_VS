import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../api/client';
import { Truck, X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface SendToCenterModalProps {
    request: any;
    onClose: () => void;
    onSuccess: () => void;
}

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';

interface SendToCenterModalProps {
    request: any;
    onClose: () => void;
    onSuccess: () => void;
}

export function SendToCenterModal({ request, onClose, onSuccess }: SendToCenterModalProps) {
    const [selectedCenterId, setSelectedCenterId] = useState('');
    const [notes, setNotes] = useState('');

    const { data: branches, isLoading: isLoadingBranches } = useQuery({
        queryKey: ['branches-centers'],
        queryFn: async () => {
            const all = await api.getActiveBranches();
            return all.filter((b: any) => b.type === 'MAINTENANCE_CENTER');
        }
    });

    const transferMutation = useMutation({
        mutationFn: async () => {
            return api.createTransferOrder({
                branchId: selectedCenterId,
                type: 'MACHINE',
                items: [{
                    serialNumber: request.posMachine?.serialNumber,
                    type: request.posMachine?.model,
                    manufacturer: request.posMachine?.manufacturer
                }],
                notes: `Maintenance Request #${request.id}. ${notes}`,
                createdBy: request.createdBy
            });
        },
        onSuccess: () => {
            toast.success('تم إرسال الماكينة للمركز بنجاح');
            onSuccess();
            onClose();
        },
        onError: (error: any) => {
            toast.error(error.message || 'فشل الإرسال');
        }
    });

    return (
        <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="p-0 border-0 [&>button]:hidden flex flex-col max-h-[90vh] h-auto overflow-hidden sm:max-w-md" dir="rtl">
                <DialogHeader className="bg-slate-50 p-6 pb-4 border-b shrink-0">
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <Truck className="text-primary" />
                        إرسال لمركز الصيانة
                    </DialogTitle>
                    <DialogDescription>
                        إنشاء إذن نقل للماكينة إلى مركز الصيانة
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    <div className="bg-blue-50 p-4 rounded-2xl text-sm text-blue-800 border border-blue-100 leading-relaxed shadow-sm">
                        سيتم إنشاء إذن نقل للماكينة رقم <b className="font-mono text-lg mx-1">{request.posMachine?.serialNumber}</b> وتغيير حالة الطلب.
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-black text-slate-700">مركز الصيانة المستلم *</label>
                        {isLoadingBranches ? (
                            <div className="flex items-center gap-2 text-sm text-slate-500 animate-pulse bg-slate-50 p-3 rounded-xl border border-dashed">
                                <Loader2 size={16} className="animate-spin" />
                                جاري تحميل المراكز...
                            </div>
                        ) : (
                            <div className="relative">
                                <select
                                    value={selectedCenterId}
                                    onChange={e => setSelectedCenterId(e.target.value)}
                                    className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all font-bold appearance-none bg-background"
                                >
                                    <option value="">-- اختر المركز --</option>
                                    {branches?.map((b: any) => (
                                        <option key={b.id} value={b.id}>{b.name}</option>
                                    ))}
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-black text-slate-700">ملاحظات</label>
                        <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all resize-none bg-slate-50/30 focus:bg-white"
                            rows={3}
                            placeholder="أي ملاحظات إضافية..."
                        />
                    </div>
                </div>

                <div className="p-6 border-t bg-slate-50/50 shrink-0 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 bg-white border border-slate-200 text-slate-700 py-3 rounded-xl font-bold hover:bg-slate-50 transition-colors"
                    >
                        إلغاء
                    </button>
                    <button
                        onClick={() => transferMutation.mutate()}
                        disabled={transferMutation.isPending || !selectedCenterId}
                        className="flex-[2] bg-primary text-white py-3 rounded-xl font-black hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-primary/20 transition-all hover:translate-y-[-1px] active:translate-y-[1px]"
                    >
                        {transferMutation.isPending ? <Loader2 className="animate-spin" size={20} /> : <Truck size={20} />}
                        تأكيد وإرسال
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
