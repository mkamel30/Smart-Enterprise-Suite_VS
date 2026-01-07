import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, MapPin, ClipboardList } from 'lucide-react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useAuth } from '../../context/AuthContext';

interface TransferMachinesModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (targetBranchId: string, notes: string) => void;
    selectedCount: number;
    branches: any[];
    isLoading: boolean;
}

export const TransferMachinesModal: React.FC<TransferMachinesModalProps> = ({
    isOpen,
    onClose,
    onSubmit,
    selectedCount,
    branches,
    isLoading
}) => {
    const { user } = useAuth();
    const [targetBranchId, setTargetBranchId] = useState('');
    const [notes, setNotes] = useState('');

    // Filter out: 1) Current user's branch (source), 2) ADMIN_AFFAIRS type branches
    const filteredBranches = branches.filter(
        (b: any) => b.id !== user?.branchId && b.type !== 'ADMIN_AFFAIRS'
    );

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(targetBranchId, notes);
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]"
                    dir="rtl"
                >
                    <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50 shrink-0">
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <Send className="text-blue-600" size={24} />
                            تحويل الماكينات للفرع
                        </h2>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                            <X size={24} />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 flex items-center gap-3">
                                <div className="p-2 bg-blue-600 text-white rounded-lg">
                                    <ClipboardList size={20} />
                                </div>
                                <div>
                                    <p className="text-sm text-blue-700 font-medium">عدد الماكينات المختارة</p>
                                    <p className="text-2xl font-bold text-blue-900">{selectedCount}</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="flex items-center gap-2">
                                        <MapPin size={16} className="text-slate-400" />
                                        الفرع المراد التحويل إليه
                                    </Label>
                                    <Select value={targetBranchId} onValueChange={setTargetBranchId} required>
                                        <SelectTrigger className="rounded-xl border-slate-200">
                                            <SelectValue placeholder="اختر الفرع المستلم..." />
                                        </SelectTrigger>
                                        <SelectContent className="z-[99999]">
                                            {filteredBranches.map((b: any) => (
                                                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>ملاحظات أمر التحويل</Label>
                                    <textarea
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        className="w-full border border-slate-200 rounded-xl p-3 h-24 focus:ring-blue-500/20 outline-none resize-none"
                                        placeholder="أي ملاحظات إضافية..."
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t bg-slate-50/50 shrink-0 flex gap-3">
                            <Button
                                type="submit"
                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-6 font-bold shadow-lg shadow-blue-500/20 transition-all font-bold"
                                disabled={isLoading || !targetBranchId}
                            >
                                {isLoading ? 'جاري إنشاء الطلب...' : 'تأكيد إرسال التحويل'}
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={onClose}
                                className="rounded-xl py-6 border-slate-200 hover:bg-slate-50"
                            >
                                إلغاء
                            </Button>
                        </div>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
