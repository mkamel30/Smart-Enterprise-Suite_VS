import React from 'react';
import { Send, X, Landmark, ClipboardList } from 'lucide-react';
import { Button } from '../ui/button';

interface TransferModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedCount: number;
    transferTargetBranch: string;
    setTransferTargetBranch: (value: string) => void;
    transferNotes: string;
    setTransferNotes: (value: string) => void;
    branches: any[] | undefined;
    onTransfer: () => void;
    isPending: boolean;
}

export function SimTransferModal({
    isOpen,
    onClose,
    selectedCount,
    transferTargetBranch,
    setTransferTargetBranch,
    transferNotes,
    setTransferNotes,
    branches,
    onTransfer,
    isPending
}: TransferModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[150] p-4 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white rounded-[32px] w-full max-w-sm sm:max-w-md shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 flex flex-col max-h-[90vh] overflow-hidden border border-slate-200">
                <div className="p-8 pb-4 flex justify-between items-center bg-slate-50/50 border-b border-slate-100 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-amber-200">
                            <Send size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-900">إنشاء إذن نقل شرائح</h2>
                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Stock Transfer Order</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-6">
                    <div className="text-sm text-slate-600 bg-amber-50/50 p-6 rounded-[24px] border border-amber-100/50 flex items-center gap-4">
                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-amber-600 shadow-sm border border-amber-100">
                            <span className="text-2xl font-black">{selectedCount}</span>
                        </div>
                        <div>
                            <p className="font-bold text-slate-700">شرائح محددة للنقل</p>
                            <p className="text-xs text-slate-500">سيتم نقل جميع العناصر المختارة للفرع المستهدف</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="flex items-center gap-2 text-xs font-black text-slate-500 uppercase tracking-wider mb-2 mr-1">
                                <Landmark size={14} className="text-slate-400" />
                                الفرع المستلم المستهدف *
                            </label>
                            <select
                                className="w-full border-slate-200 rounded-2xl px-5 py-4 bg-slate-50/50 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:bg-white outline-none transition-all font-bold text-slate-700"
                                value={transferTargetBranch}
                                onChange={e => setTransferTargetBranch(e.target.value)}
                            >
                                <option value="">-- اختر الفرع المستلم --</option>
                                {branches?.map((branch: any) => (
                                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="flex items-center gap-2 text-xs font-black text-slate-500 uppercase tracking-wider mb-2 mr-1">
                                <ClipboardList size={14} className="text-slate-400" />
                                ملاحظات إدارية / سبب النقل
                            </label>
                            <textarea
                                className="w-full border-slate-200 rounded-2xl px-5 py-4 bg-slate-50/50 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:bg-white outline-none transition-all font-medium text-slate-700 min-h-[120px]"
                                placeholder="مثال: تعويض عهده تالفة أو صرف حصة شهرية..."
                                value={transferNotes}
                                onChange={e => setTransferNotes(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <div className="p-8 pt-4 border-t bg-slate-50/50 shrink-0 flex gap-4">
                    <Button
                        onClick={onTransfer}
                        disabled={!transferTargetBranch || isPending}
                        className="flex-[2] bg-amber-600 hover:bg-amber-700 text-white rounded-2xl py-7 font-black shadow-xl shadow-amber-100 transition-all gap-2"
                    >
                        {isPending ? 'جاري إنشاء الإذن...' : 'تأكيد عملية النقل'}
                    </Button>
                    <Button
                        variant="outline"
                        onClick={onClose}
                        className="flex-1 border-slate-200 text-slate-600 rounded-2xl py-7 font-bold hover:bg-white transition-all shadow-sm"
                    >
                        إلغاء
                    </Button>
                </div>
            </div>
        </div>
    );
}
