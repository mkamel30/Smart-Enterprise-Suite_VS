import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../api/client';
import { CheckCircle, X, Loader2, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';

interface RequestApprovalModalProps {
    request: any;
    onClose: () => void;
    onSuccess: () => void;
}

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';

interface RequestApprovalModalProps {
    request: any;
    onClose: () => void;
    onSuccess: () => void;
}

export function RequestApprovalModal({ request, onClose, onSuccess }: RequestApprovalModalProps) {
    const [cost, setCost] = useState<number>(0);
    const [notes, setNotes] = useState('');

    const approvalMutation = useMutation({
        mutationFn: async () => {
            return api.createApproval({
                requestId: request.id,
                cost: Number(cost),
                parts: [],
                notes: notes
            });
        },
        onSuccess: () => {
            toast.success('تم إرسال طلب الموافقة بنجاح');
            onSuccess();
            onClose();
        },
        onError: (error: any) => {
            toast.error(error.message || 'فشل إرسال الطلب');
        }
    });

    return (
        <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="p-0 border-0 [&>button]:hidden flex flex-col max-h-[90vh] h-auto overflow-hidden sm:max-w-md" dir="rtl">
                <DialogHeader className="bg-purple-50 p-6 pb-4 border-b shrink-0">
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <CheckCircle className="text-purple-600" />
                        طلب موافقة صيانة
                    </DialogTitle>
                    <DialogDescription>
                        إرسال طلب موافقة على تكلفة الصيانة
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    <div className="bg-purple-50 p-4 rounded-2xl text-sm text-purple-800 border border-purple-100 leading-relaxed shadow-sm">
                        طلب موافقة على تكلفة الصيانة وقطع الغيار للطلب <b className="font-mono text-lg mx-1">#{request.id.slice(-6)}</b>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-black text-slate-700">
                            <DollarSign size={16} className="inline ml-1 text-green-600" />
                            التكلفة التقديرية (شاملة المصنعية)
                        </label>
                        <div className="relative">
                            <input
                                type="number"
                                value={cost}
                                onChange={e => setCost(Number(e.target.value))}
                                className="w-full border border-slate-200 rounded-xl px-4 py-3 pl-12 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all font-bold text-lg"
                                min="0"
                            />
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">ج.م</div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-black text-slate-700">ملاحظات / تفاصيل القطع</label>
                        <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all resize-none bg-slate-50/30 focus:bg-white"
                            rows={4}
                            placeholder="اكتب تفاصيل العطل وقطع الغيار المطلوبة..."
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
                        onClick={() => approvalMutation.mutate()}
                        disabled={approvalMutation.isPending}
                        className="flex-[2] bg-purple-600 text-white py-3 rounded-xl font-black hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-purple-600/20 transition-all hover:translate-y-[-1px] active:translate-y-[1px]"
                    >
                        {approvalMutation.isPending ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle size={20} />}
                        إرسال الطلب
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
