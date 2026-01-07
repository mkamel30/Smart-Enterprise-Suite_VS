import React from 'react';
import { Send } from 'lucide-react';

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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[150] p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-sm sm:max-w-md shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] overflow-hidden">
                <div className="p-6 pb-4 shrink-0">
                    <h2 className="text-xl font-black mb-2 flex items-center gap-3 text-slate-900">
                        <div className="p-2 bg-blue-100 rounded-xl">
                            <Send className="text-blue-600" size={24} />
                        </div>
                        إنشاء إذن نقل شرائح
                    </h2>
                    <div className="text-sm text-slate-600 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                        سيتم نقل <span className="font-black text-blue-700 text-lg mx-1">{selectedCount}</span> شريحة إلى الفرع المحدد.
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 pt-0 space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1.5">الفرع المستلم *</label>
                        <select
                            className="w-full border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                            value={transferTargetBranch}
                            onChange={e => setTransferTargetBranch(e.target.value)}
                        >
                            <option value="">-- اختر الفرع --</option>
                            {branches?.map((branch: any) => (
                                <option key={branch.id} value={branch.id}>{branch.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1.5">ملاحظات / سبب النقل</label>
                        <textarea
                            className="w-full border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                            rows={3}
                            placeholder="مثال: صرف عهدة شهرية..."
                            value={transferNotes}
                            onChange={e => setTransferNotes(e.target.value)}
                        />
                    </div>
                </div>

                <div className="p-6 pt-4 border-t bg-slate-50/50 shrink-0 flex gap-3">
                    <button
                        onClick={onTransfer}
                        disabled={!transferTargetBranch || isPending}
                        className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-black hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all active:scale-95 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:cursor-not-allowed"
                    >
                        {isPending ? 'جاري التحويل...' : 'تأكيد النقل'}
                    </button>
                    <button
                        onClick={onClose}
                        className="flex-1 border-2 border-slate-100 text-slate-600 py-3 rounded-xl font-bold hover:bg-slate-50 transition-all"
                    >
                        إلغاء
                    </button>
                </div>
            </div>
        </div>
    );
}
