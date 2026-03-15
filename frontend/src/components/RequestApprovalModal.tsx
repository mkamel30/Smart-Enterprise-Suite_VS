import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../api/client';
import { CheckCircle, X, Loader2, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';
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
            <DialogContent className="p-0 border-0 [&>button]:hidden flex flex-col max-h-[90vh] h-auto overflow-hidden sm:max-w-sm rounded-2xl shadow-2xl bg-white" dir="rtl">
                <DialogHeader className="bg-slate-50/50 p-4 md:p-5 border-b shrink-0 text-right">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-600 text-white rounded-lg">
                            <DollarSign size={16} />
                        </div>
                        <div>
                            <DialogTitle className="text-base font-black text-slate-900 leading-tight">طلب موافقة صيانة</DialogTitle>
                            <DialogDescription className="text-[10px] text-slate-400 font-bold mt-0.5 opacity-80">طلب اعتماد مالي للإصلاح</DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-4">
                    <div className="bg-purple-50/50 border border-purple-100 p-3 rounded-xl">
                        <p className="text-[10px] text-purple-700 font-bold leading-relaxed">
                            سيتم إرسال طلب اعتماد مالي للطلب رقم <span className="font-mono text-sm font-black mx-0.5">#{request.id.slice(-6)}</span> للمراجعة.
                        </p>
                    </div>

                    <div className="space-y-1.5">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">التكلفة المتوقعة (ج.م)</label>
                        <div className="relative group">
                            <input
                                type="number"
                                value={cost}
                                onChange={e => setCost(Number(e.target.value))}
                                className="w-full h-11 border border-slate-200 rounded-lg pr-4 pl-12 text-lg font-black outline-none focus:border-purple-500 transition-all bg-white"
                                min="0"
                            />
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">ج.م</div>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">تفاصيل العطل والقطع</label>
                        <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            className="w-full border border-slate-200 rounded-lg p-3 text-xs font-bold outline-none focus:border-purple-500 bg-slate-50/30 focus:bg-white transition-all min-h-[90px]"
                            placeholder="اكتب هنا تفاصيل الفحص الفني وقطع الغيار المطلوبة لتدبيرها..."
                        />
                    </div>
                </div>

                <div className="p-4 border-t bg-slate-50 flex items-center gap-2">
                    <button
                        onClick={onClose}
                        className="h-10 px-4 border border-slate-200 text-slate-500 font-bold text-xs rounded-lg hover:bg-slate-100 transition-all"
                    >
                        إلغاء
                    </button>
                    <button
                        onClick={() => approvalMutation.mutate()}
                        disabled={approvalMutation.isPending}
                        className="flex-1 h-10 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-black text-xs shadow-lg shadow-purple-100 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {approvalMutation.isPending ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle size={14} />}
                        إرسال الطلب
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
