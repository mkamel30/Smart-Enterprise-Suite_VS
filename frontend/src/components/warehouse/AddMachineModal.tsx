import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useAuth } from '../../context/AuthContext';

interface AddMachineModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: any) => void;
    branches: any[];
    isAdmin: boolean;
    parameters: any[];
    isLoading: boolean;
}

export const AddMachineModal: React.FC<AddMachineModalProps> = ({
    isOpen,
    onClose,
    onSubmit,
    branches,
    isAdmin,
    parameters,
    isLoading
}) => {
    const { user } = useAuth();
    const isAffairs = user?.role === 'ADMIN_AFFAIRS';

    const [formData, setFormData] = useState({
        serialNumber: '',
        model: '',
        manufacturer: '',
        status: isAffairs ? 'NEW' : 'NEW', // Default strict for all initially
        notes: '',
        branchId: ''
    });

    const handleSerialChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const sn = e.target.value.toUpperCase();
        const prefixMatch = parameters
            ?.sort((a: any, b: any) => b.prefix.length - a.prefix.length)
            .find((p: any) => sn.startsWith(p.prefix.toUpperCase()));

        setFormData(prev => ({
            ...prev,
            serialNumber: sn,
            model: prefixMatch?.model || '',
            manufacturer: prefixMatch?.manufacturer || ''
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(formData);
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]"
                    dir="rtl"
                >
                    <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50 shrink-0">
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <Plus className="text-emerald-600" size={24} />
                            إضافة ماكينة جديدة للمخزن
                        </h2>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                            <X size={24} />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scroll">
                            <div className="space-y-2">
                                <Label htmlFor="sn">رقم السيريال (S/N)</Label>
                                <Input
                                    id="sn"
                                    placeholder="8920..."
                                    value={formData.serialNumber}
                                    onChange={handleSerialChange}
                                    required
                                    className="font-mono text-lg py-6 rounded-xl focus:ring-emerald-500/20"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>الموديل</Label>
                                    <Input
                                        value={formData.model}
                                        readOnly
                                        className="bg-slate-50 border-slate-100 rounded-xl"
                                        placeholder="يتحدد تلقائياً..."
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>الشركة</Label>
                                    <Input
                                        value={formData.manufacturer}
                                        readOnly
                                        className="bg-slate-50 border-slate-100 rounded-xl"
                                        placeholder="يتحدد تلقائياً..."
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>حالة الماكينة</Label>
                                <Select
                                    value={formData.status}
                                    onValueChange={(val: string) => setFormData(prev => ({ ...prev, status: val }))}
                                >
                                    <SelectTrigger className="rounded-xl border-slate-200">
                                        <SelectValue placeholder="اختر الحالة" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl z-[99999]">
                                        <SelectItem value="NEW">جديدة (NEW)</SelectItem>
                                        {!isAffairs && <SelectItem value="STANDBY">استبدال (STANDBY)</SelectItem>}
                                        <SelectItem value="DEFECTIVE">تالفة (DEFECTIVE)</SelectItem>
                                        {!isAffairs && <SelectItem value="CLIENT_REPAIR">صيانة عملاء (CLIENT_REPAIR)</SelectItem>}
                                    </SelectContent>
                                </Select>
                            </div>

                            {isAdmin && (
                                <div className="space-y-2">
                                    <Label>الفرع</Label>
                                    <Select
                                        value={formData.branchId}
                                        onValueChange={(val: string) => setFormData(prev => ({ ...prev, branchId: val }))}
                                        required
                                    >
                                        <SelectTrigger className="rounded-xl border-slate-200">
                                            <SelectValue placeholder="اختر الفرع" />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl">
                                            {branches.map((b) => (
                                                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label>ملاحظات إضافية</Label>
                                <Input
                                    value={formData.notes}
                                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                                    placeholder="..."
                                    className="rounded-xl border-slate-200"
                                />
                            </div>

                            {!formData.model && formData.serialNumber.length > 5 && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    className="flex items-center gap-2 p-3 bg-amber-50 rounded-xl border border-amber-100 text-amber-700 text-sm"
                                >
                                    <AlertCircle size={16} />
                                    السيريال غير مطابق لأي موديل مسجل. سيتم إضافتها كموديل غير معروف.
                                </motion.div>
                            )}
                        </div>

                        <div className="p-6 border-t bg-slate-50/50 shrink-0 flex gap-3">
                            <Button
                                type="submit"
                                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-6 font-bold shadow-lg shadow-emerald-500/20 transition-all"
                                disabled={isLoading}
                            >
                                {isLoading ? 'جاري الإضافة...' : 'حفظ الماكينة للمخزن'}
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
