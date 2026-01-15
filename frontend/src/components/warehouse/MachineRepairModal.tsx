import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Wrench } from 'lucide-react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';

interface MachineRepairModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (notes: string) => void;
    selectedMachine: any;
    isLoading: boolean;
}

export const MachineRepairModal: React.FC<MachineRepairModalProps> = ({
    isOpen,
    onClose,
    onSubmit,
    selectedMachine,
    isLoading
}) => {
    const [notes, setNotes] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(notes);
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]"
                    dir="rtl"
                >
                    <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50 shrink-0">
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <CheckCircle className="text-primary" size={24} />
                            إصلاح وإرجاع للمخزن
                        </h2>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                            <X size={24} />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scroll">
                            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                                <div className="flex items-center gap-2 text-slate-400">
                                    <Wrench size={16} />
                                    <span className="text-xs font-bold uppercase tracking-wider">تفاصيل الماكينة التالفة</span>
                                </div>
                                <p className="font-mono font-bold text-lg text-slate-800">{selectedMachine?.serialNumber}</p>
                                <p className="text-sm text-slate-500">{selectedMachine?.model} - {selectedMachine?.manufacturer}</p>
                            </div>

                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex gap-3">
                                <AlertCircle className="text-primary shrink-0" size={20} />
                                <p className="text-sm text-blue-800 italic">
                                    سيتم نقل هذه الماكينة من قسم التالف إلى قسم <strong>الاستبدال (STANDBY)</strong> لتكون جاهزة للصرف مرة أخرى.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label>ملاحظات الإصلاح / ما تم تغييره</Label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    className="w-full border border-slate-200 rounded-xl p-3 h-24 focus:ring-blue-500/20 outline-none resize-none"
                                    placeholder="..."
                                    required
                                />
                            </div>
                        </div>

                        <div className="p-6 border-t bg-slate-50/50 shrink-0 flex gap-3">
                            <Button
                                type="submit"
                                className="flex-1 bg-primary hover:bg-primary/90 text-white rounded-xl py-6 font-bold shadow-lg shadow-primary/20 transition-all"
                                disabled={isLoading}
                            >
                                {isLoading ? 'جاري الحفظ...' : 'تأكيد عملية الإصلاح'}
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
