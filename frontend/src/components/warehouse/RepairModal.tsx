import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Wrench, Plus, Trash2, Package } from 'lucide-react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

interface RepairModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (payload: any) => void;
    selectedMachine: any;
    isLoading: boolean;
}

export const RepairModal: React.FC<RepairModalProps> = ({
    isOpen,
    onClose,
    onSubmit,
    selectedMachine,
    isLoading
}) => {
    const { user } = useAuth();
    const [notes, setNotes] = useState('');
    const [resolution, setResolution] = useState<'REPAIRED' | 'SCRAPPED' | 'REJECTED_REPAIR'>('REPAIRED');
    const [usedParts, setUsedParts] = useState<{ partId: string; name: string; quantity: number; cost: number }[]>([]);

    const { data: inventory } = useQuery({
        queryKey: ['spare-parts-inventory'],
        queryFn: () => api.getInventory() as any,
        enabled: !!user
    });

    const addPart = (partId: string) => {
        const part = (inventory as any[])?.find(p => p.partId === partId);
        if (!part) return;

        if (usedParts.find(p => p.partId === partId)) return;

        setUsedParts([...usedParts, {
            partId: part.partId,
            name: part.part.name,
            quantity: 1,
            cost: part.part.defaultCost
        }]);
    };

    const removePart = (partId: string) => {
        setUsedParts(usedParts.filter(p => p.partId !== partId));
    };

    const updatePartQuantity = (partId: string, qty: number) => {
        setUsedParts(usedParts.map(p => p.partId === partId ? { ...p, quantity: Math.max(1, qty) } : p));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit({
            resolution,
            notes,
            parts: usedParts
        });
    };

    if (!isOpen) return null;

    const totalCost = usedParts.reduce((acc, p) => acc + (p.cost * p.quantity), 0);

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-200"
                    dir="rtl"
                >
                    <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50 shrink-0">
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <Wrench className="text-purple-600" size={24} />
                            تفاصيل عملية الإصلاح
                        </h2>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                            <X size={24} />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scroll">
                            {/* Machine Summary */}
                            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-2 gap-4">
                                <div>
                                    <div className="flex items-center gap-2 text-slate-400 mb-1">
                                        <Package size={14} />
                                        <span className="text-[10px] font-bold uppercase tracking-wider">رقم السيريال</span>
                                    </div>
                                    <p className="font-mono font-bold text-slate-800">{selectedMachine?.serialNumber}</p>
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 text-slate-400 mb-1">
                                        <AlertCircle size={14} />
                                        <span className="text-[10px] font-bold uppercase tracking-wider">الموديل</span>
                                    </div>
                                    <p className="text-sm font-medium text-slate-600 truncate">{selectedMachine?.model || 'Unknown'}</p>
                                </div>
                            </div>

                            {/* Resolution Picker */}
                            <div className="space-y-2">
                                <Label>القرار الفني النهائي</Label>
                                <div className="grid grid-cols-3 gap-2">
                                    {(['REPAIRED', 'SCRAPPED', 'REJECTED_REPAIR'] as const).map((res) => (
                                        <button
                                            key={res}
                                            type="button"
                                            onClick={() => setResolution(res)}
                                            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border-2 ${resolution === res
                                                ? (res === 'REPAIRED' ? 'border-green-600 bg-green-50 text-green-700' : res === 'SCRAPPED' ? 'border-red-600 bg-red-50 text-red-700' : 'border-slate-600 bg-slate-50 text-slate-700')
                                                : 'border-slate-100 hover:border-slate-200 text-slate-400'
                                                }`}
                                        >
                                            {res === 'REPAIRED' ? 'تم الإصلاح' : res === 'SCRAPPED' ? 'تخريد الماكينة' : 'رفض الإصلاح'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Spare Parts Section - Only show if Repaired */}
                            {resolution === 'REPAIRED' && (
                                <div className="space-y-3">
                                    <Label className="flex justify-between items-center">
                                        <span>قطع الغيار المستخدمة</span>
                                        <span className="text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-bold">
                                            التكلفة: {totalCost} ج.م
                                        </span>
                                    </Label>

                                    <div className="border border-slate-100 rounded-xl overflow-hidden">
                                        <div className="bg-slate-50 p-2 border-b border-slate-100">
                                            <select
                                                className="w-full bg-white border-slate-200 rounded-lg text-sm p-2 outline-none"
                                                onChange={(e) => addPart(e.target.value)}
                                                value=""
                                            >
                                                <option value="" disabled>اختر قطعة غيار لإضافتها...</option>
                                                {(inventory as any[])?.map(item => (
                                                    <option key={item.partId} value={item.partId} disabled={item.quantity <= 0}>
                                                        {item.part.name} (متوفر: {item.quantity})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="max-h-48 overflow-y-auto bg-white divide-y divide-slate-50">
                                            {usedParts.length === 0 ? (
                                                <div className="p-8 text-center text-slate-400 text-xs italic">
                                                    لا توجد قطع غيار مضافة
                                                </div>
                                            ) : (
                                                usedParts.map(part => (
                                                    <div key={part.partId} className="p-3 flex items-center justify-between group">
                                                        <div className="flex-1">
                                                            <p className="text-xs font-bold text-slate-700">{part.name}</p>
                                                            <p className="text-[10px] text-slate-400 font-mono">{part.cost} ج.م / قطعة</p>
                                                        </div>
                                                        <div className="flex items-center gap-4">
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => updatePartQuantity(part.partId, part.quantity - 1)}
                                                                    className="w-6 h-6 rounded-md bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-slate-200"
                                                                >-</button>
                                                                <span className="text-sm font-bold w-4 text-center">{part.quantity}</span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => updatePartQuantity(part.partId, part.quantity + 1)}
                                                                    className="w-6 h-6 rounded-md bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-slate-200"
                                                                >+</button>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => removePart(part.partId)}
                                                                className="text-red-400 hover:text-red-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label>تقرير المهندس / ملاحظات</Label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    className="w-full border border-slate-200 rounded-xl p-3 h-24 focus:ring-blue-500/20 outline-none resize-none text-sm"
                                    placeholder="اكتب تقرير الصيانة بالتفصيل هنا..."
                                    required
                                />
                            </div>
                        </div>

                        <div className="p-6 border-t bg-slate-50/50 shrink-0 flex gap-3">
                            <Button
                                type="submit"
                                className="flex-1 bg-slate-900 hover:bg-slate-800 text-white rounded-xl py-6 font-bold shadow-lg shadow-slate-200 transition-all border-none"
                                disabled={isLoading}
                            >
                                {isLoading ? 'جاري الحفظ...' : 'إتمام وتسجيل العملية'}
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
