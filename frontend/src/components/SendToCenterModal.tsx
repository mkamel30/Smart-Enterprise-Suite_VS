import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../api/client';
import { Truck, X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
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
            <DialogContent className="p-0 border-0 [&>button]:hidden flex flex-col max-h-[90vh] h-auto overflow-hidden sm:max-w-sm rounded-2xl shadow-2xl bg-white" dir="rtl">
                <DialogHeader className="bg-slate-50/50 p-4 md:p-5 border-b shrink-0 text-right">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary text-white rounded-lg">
                            <Truck size={16} />
                        </div>
                        <div>
                            <DialogTitle className="text-base font-black text-slate-900 leading-tight">إرسال لمركز الصيانة</DialogTitle>
                            <DialogDescription className="text-[10px] text-slate-400 font-bold mt-0.5 opacity-80">نقل الماكينة لمركز الصيانة الرئيسي</DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-4">
                    <div className="bg-blue-50/50 border border-blue-100 p-3 rounded-xl">
                        <p className="text-[10px] text-blue-700 font-bold leading-relaxed">
                            سيتم إنشاء إذن نقل للماكينة رقم <span className="font-mono text-sm font-black mx-0.5">{request.posMachine?.serialNumber}</span> وتوجيه الطلب.
                        </p>
                    </div>

                    <div className="space-y-1.5">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">مركز الصيانة المستهدف</label>
                        {isLoadingBranches ? (
                            <div className="flex items-center gap-2 text-xs text-slate-400 animate-pulse bg-slate-50 p-2.5 rounded-lg border border-dashed border-slate-200">
                                <Loader2 size={12} className="animate-spin" />
                                جاري التحميل...
                            </div>
                        ) : (
                            <div className="relative group">
                                <select
                                    value={selectedCenterId}
                                    onChange={e => setSelectedCenterId(e.target.value)}
                                    className="w-full h-10 border border-slate-200 rounded-lg px-3 text-xs font-bold outline-none focus:border-primary transition-all bg-white"
                                >
                                    <option value="">-- اختر المركز --</option>
                                    {branches?.map((b: any) => (
                                        <option key={b.id} value={b.id}>{b.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    <div className="space-y-1.5">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">ملاحظات التوجيه</label>
                        <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            className="w-full border border-slate-200 rounded-lg p-3 text-xs font-bold outline-none focus:border-primary bg-slate-50/30 focus:bg-white transition-all min-h-[70px]"
                            placeholder="أي ملاحظات إضافية للفنيين بالمركز..."
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
                        onClick={() => transferMutation.mutate()}
                        disabled={transferMutation.isPending || !selectedCenterId}
                        className="flex-1 h-10 bg-primary hover:bg-primary/90 text-white rounded-lg font-black text-xs shadow-lg shadow-primary/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {transferMutation.isPending ? <Loader2 className="animate-spin" size={14} /> : <Truck size={14} />}
                        تأكيد التوجيه
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
