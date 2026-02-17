import React, { useState, useMemo } from 'react';
import { X, Box, Plus, Hash, FileText, CheckCircle2, AlertCircle, Layers, ListFilter, Signal, Smartphone } from 'lucide-react';
import { api } from '../../api/client';
import { useApiMutation } from '../../hooks/useApiMutation';

interface CreateCartonModalProps {
    onClose: () => void;
    itemTypes: any[];
}

export default function CreateCartonModal({ onClose, itemTypes }: CreateCartonModalProps) {
    const [formData, setFormData] = useState({
        cartonCode: '',
        itemTypeCode: '',
        machinesCount: 10,
        isSerialContinuous: true,
        firstSerialNumber: '',
        serialListRaw: '',
        notes: '',
        simProvider: 'Vodafone',
        simNetworkType: '4G'
    });

    const selectedItemType = useMemo(() => itemTypes.find(t => t.code === formData.itemTypeCode), [itemTypes, formData.itemTypeCode]);
    const isQuantityBased = selectedItemType?.trackingMode?.toUpperCase() === 'QUANTITY_BASED';
    const isSim = selectedItemType?.category === 'SIM' || selectedItemType?.code === 'SIM' || selectedItemType?.name.includes('شريحة');

    const createMutation = useApiMutation({
        mutationFn: (data: any) => {
            if (isQuantityBased) return api.createAdminAssetManual(data);
            return api.createAdminCarton(data);
        },
        successMessage: isQuantityBased ? 'تم إضافة الكمية للمخزن بنجاح' : 'تم إنشاء الكرتونة والأصول بنجاح',
        errorMessage: 'فشل الإضافة',
        invalidateKeys: [['admin-inventory'], ['admin-cartons'], ['admin-affairs-summary'], ['admin-stocks']],
        onSuccess: () => onClose()
    });

    const generatedSerials = useMemo(() => {
        if (!formData.isSerialContinuous || !formData.firstSerialNumber || !formData.machinesCount) return [];

        const serials = [];
        const match = formData.firstSerialNumber.match(/^(.*?)(\d+)$/);
        if (!match) {
            for (let i = 0; i < formData.machinesCount; i++) serials.push(formData.firstSerialNumber);
            return serials;
        }

        const prefix = match[1];
        const numberStr = match[2];
        const number = parseInt(numberStr);
        const padLength = numberStr.length;

        for (let i = 0; i < formData.machinesCount; i++) {
            const currentNum = (number + i).toString().padStart(padLength, '0');
            serials.push(`${prefix}${currentNum}`);
        }
        return serials;
    }, [formData.isSerialContinuous, formData.firstSerialNumber, formData.machinesCount, isQuantityBased]);

    const manualSerials = useMemo(() => {
        if (isQuantityBased || formData.isSerialContinuous) return [];
        return formData.serialListRaw.split('\n').map(s => s.trim()).filter(s => s !== '');
    }, [formData.isSerialContinuous, formData.serialListRaw, isQuantityBased]);

    const isValid = useMemo(() => {
        if (!formData.cartonCode || !formData.itemTypeCode || !formData.machinesCount) return false;
        if (isQuantityBased) return formData.machinesCount > 0;
        if (formData.isSerialContinuous) return !!formData.firstSerialNumber;
        return manualSerials.length === formData.machinesCount;
    }, [formData, manualSerials, isQuantityBased]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!isValid) return;

        if (isQuantityBased) {
            // For quantity based items, we call the manual addition logic which handles stock updates
            // Since cartons are serialized in this DB, we group it as a manual stock addition
            const payload = {
                itemTypeCode: formData.itemTypeCode,
                quantity: formData.machinesCount,
                notes: `إضافة كمية (كرتونة: ${formData.cartonCode}). ${formData.notes || ''}`
            };
            createMutation.mutate(payload, {
                onSuccess: () => {
                    // We might need to call a different success message or handling if needed
                }
            });
        } else {
            const payload = {
                ...formData,
                serialList: formData.isSerialContinuous ? null : manualSerials
            };
            createMutation.mutate(payload);
        }
    };

    return (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-md flex items-start sm:items-center justify-center z-[100] p-2 sm:p-4 overflow-y-auto custom-scroll">
            <div className="bg-card rounded-[2rem] sm:rounded-[2.5rem] p-4 sm:p-7 w-full max-w-xl border border-border shadow-2xl animate-scale-in my-auto text-right relative">
                <div className="flex items-center justify-between mb-5">
                    <h2 className="text-xl sm:text-2xl font-black flex items-center gap-2 sm:gap-3 text-foreground">
                        <Box size={28} className="text-primary p-1.5 bg-primary/10 rounded-xl" />
                        تعبئة كرتونة
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors group">
                        <X size={24} className="text-muted-foreground group-hover:text-foreground" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                        <div className="space-y-2">
                            <label className="text-xs sm:text-sm font-black text-muted-foreground mr-1">كود الكرتونة</label>
                            <div className="relative group">
                                <Box size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                <input
                                    placeholder="مثال: CR-2024-001"
                                    value={formData.cartonCode}
                                    onChange={e => setFormData({ ...formData, cartonCode: e.target.value.toUpperCase() })}
                                    className="w-full bg-muted/30 border-2 border-border/50 rounded-2xl pr-12 pl-4 py-4 focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none font-black text-sm sm:text-base tracking-wider"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs sm:text-sm font-black text-muted-foreground mr-1">نوع الأصناف</label>
                            <select
                                value={formData.itemTypeCode}
                                onChange={e => setFormData({ ...formData, itemTypeCode: e.target.value })}
                                className="w-full bg-muted/30 border-2 border-border/50 rounded-2xl px-5 py-4 focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none font-bold appearance-none text-sm sm:text-base"
                                required
                            >
                                <option value="">اختر النوع...</option>
                                {itemTypes.map((t: any) => (
                                    <option key={t.id} value={t.code}>
                                        {t.name} {t.trackingMode?.toUpperCase() === 'QUANTITY_BASED' ? '📦 (كمية)' : '🏷️ (سيريال)'}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs sm:text-sm font-black text-muted-foreground mr-1">عدد الوحدات</label>
                            <input
                                type="number"
                                placeholder="مثال: 10"
                                value={formData.machinesCount}
                                onChange={e => setFormData({ ...formData, machinesCount: parseInt(e.target.value) || 0 })}
                                className="w-full bg-muted/30 border-2 border-border/50 rounded-2xl px-5 py-4 focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none font-black text-sm sm:text-base"
                                required
                            />
                        </div>

                        {!isQuantityBased && (
                            <div className="space-y-2 animate-fade-in">
                                <label className="text-xs sm:text-sm font-black text-muted-foreground mr-1">نظام المسلسل (Serial)</label>
                                <div className="flex bg-muted/30 p-1.5 rounded-2xl border-2 border-border/50">
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, isSerialContinuous: true })}
                                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black text-xs sm:text-sm transition-all ${formData.isSerialContinuous ? 'bg-primary text-primary-foreground shadow-lg' : 'text-muted-foreground hover:bg-muted/50'}`}
                                    >
                                        <Layers size={16} />
                                        نطاق متتالي
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, isSerialContinuous: false })}
                                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black text-xs sm:text-sm transition-all ${!formData.isSerialContinuous ? 'bg-primary text-primary-foreground shadow-lg' : 'text-muted-foreground hover:bg-muted/50'}`}
                                    >
                                        <ListFilter size={16} />
                                        قائمة منفردة
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {!isQuantityBased && (
                        <>
                            {formData.isSerialContinuous ? (
                                <div className="space-y-3 animate-fade-in">
                                    <label className="text-xs sm:text-sm font-black text-muted-foreground mr-1">أول سيريال في النطاق</label>
                                    <div className="relative group">
                                        <Hash size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                        <input
                                            placeholder="مثال: S90-1001"
                                            value={formData.firstSerialNumber}
                                            onChange={e => setFormData({ ...formData, firstSerialNumber: e.target.value.toUpperCase() })}
                                            className="w-full bg-muted/30 border-2 border-border/50 rounded-2xl pr-12 pl-4 py-4 focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none font-black text-sm sm:text-base tracking-wider"
                                            required
                                        />
                                    </div>
                                    {generatedSerials.length > 0 && (
                                        <div className="p-4 bg-primary/5 rounded-[1.5rem] border-2 border-primary/10 space-y-3">
                                            <div className="flex items-center justify-between text-[10px] sm:text-xs font-black text-neutral-500">
                                                <span className="flex items-center gap-1.5">
                                                    <CheckCircle2 size={14} className="text-emerald-500" />
                                                    معاينة السيريالات ({generatedSerials.length} وحدة)
                                                </span>
                                                <span className="bg-primary/10 text-primary px-2 py-1 rounded-md">آخر سيريال: {generatedSerials[generatedSerials.length - 1]}</span>
                                            </div>
                                            <div className="flex flex-wrap gap-2 max-h-[100px] overflow-y-auto px-1 custom-scroll">
                                                {generatedSerials.slice(0, 30).map((s, idx) => (
                                                    <span key={`${s}-${idx}`} className="px-3 py-1 bg-white dark:bg-neutral-800 border border-border rounded-lg text-[10px] font-bold shadow-sm">{s}</span>
                                                ))}
                                                {generatedSerials.length > 30 && <span className="text-[10px] font-black text-muted-foreground py-1">... ({generatedSerials.length - 30} إضافي)</span>}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-2 animate-fade-in">
                                    <div className="flex justify-between items-end mb-1">
                                        <div className={`px-3 py-1 rounded-lg text-[10px] font-black ${manualSerials.length === formData.machinesCount ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}`}>
                                            {manualSerials.length} من {formData.machinesCount} وحدة
                                        </div>
                                        <label className="text-xs sm:text-sm font-black text-muted-foreground">قائمة السيريالات (سيريال في كل سطر)</label>
                                    </div>
                                    <div className="relative group">
                                        <FileText size={20} className="absolute right-4 top-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                        <textarea
                                            placeholder="أدخل السيريالات هنا..."
                                            value={formData.serialListRaw}
                                            onChange={e => setFormData({ ...formData, serialListRaw: e.target.value })}
                                            className="w-full bg-muted/30 border-2 border-border/50 rounded-2xl pr-12 pl-4 py-4 focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none font-mono text-xs sm:text-sm h-32 sm:h-40 resize-none leading-relaxed"
                                            required
                                        />
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {isSim && (
                        <div className="grid grid-cols-2 gap-4 animate-fade-in p-5 bg-primary/5 rounded-[2rem] border-2 border-primary/10">
                            <div className="space-y-2">
                                <label className="text-xs sm:text-sm font-black text-primary mr-1 flex items-center gap-2">
                                    <Smartphone size={14} />
                                    شركة الاتصالات
                                </label>
                                <div className="relative group">
                                    <select
                                        value={formData.simProvider}
                                        onChange={e => setFormData({ ...formData, simProvider: e.target.value })}
                                        className="w-full bg-card border-2 border-border/50 rounded-2xl px-4 py-4 focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none font-black text-sm sm:text-base appearance-none cursor-pointer"
                                    >
                                        <option value="Vodafone">Vodafone</option>
                                        <option value="Orange">Orange</option>
                                        <option value="Etisalat">Etisalat</option>
                                        <option value="WE">WE</option>
                                    </select>
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-20">
                                        <Smartphone size={18} />
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs sm:text-sm font-black text-primary mr-1 flex items-center gap-2">
                                    <Signal size={14} />
                                    نوع الشبكة
                                </label>
                                <div className="relative group">
                                    <select
                                        value={formData.simNetworkType}
                                        onChange={e => setFormData({ ...formData, simNetworkType: e.target.value })}
                                        className="w-full bg-card border-2 border-border/50 rounded-2xl px-4 py-4 focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none font-black text-sm sm:text-base appearance-none cursor-pointer"
                                    >
                                        <option value="4G">4G</option>
                                        <option value="3G">3G</option>
                                        <option value="2G">2G</option>
                                    </select>
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-20">
                                        <Signal size={18} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-xs sm:text-sm font-black text-muted-foreground mr-1">ملاحظات الكرتونة</label>
                        <textarea
                            placeholder="أي ملاحظات إضافية..."
                            value={formData.notes}
                            onChange={e => setFormData({ ...formData, notes: e.target.value })}
                            className="w-full bg-muted/30 border-2 border-border/50 rounded-2xl px-5 py-4 focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none font-bold text-sm sm:text-base h-20 resize-none"
                        />
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-border">
                        <button
                            type="submit"
                            disabled={!isValid || createMutation.isPending}
                            className="w-full sm:flex-1 bg-primary text-primary-foreground py-4 sm:py-5 rounded-2xl font-black text-lg sm:text-xl shadow-xl shadow-primary/20 hover:shadow-2xl hover:-translate-y-1 transition-all active:scale-95 disabled:opacity-50 disabled:translate-y-0 order-1 sm:order-2 flex items-center justify-center gap-3"
                        >
                            {createMutation.isPending ? (
                                <Hash className="animate-spin" size={24} />
                            ) : (
                                <CheckCircle2 size={24} />
                            )}
                            حفظ البيانات
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-full sm:flex-1 bg-muted hover:bg-muted/80 text-foreground py-4 sm:py-5 rounded-2xl font-black text-lg sm:text-xl transition-all active:scale-95 order-2 sm:order-1"
                        >
                            إلغاء
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
