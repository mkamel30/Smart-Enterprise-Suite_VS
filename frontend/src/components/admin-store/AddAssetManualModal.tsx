import React, { useState, useMemo } from 'react';
import { X, Plus, Hash, Tag, FileText, CheckCircle2, Package, Signal, Smartphone } from 'lucide-react';
import { api } from '../../api/client';
import { useApiMutation } from '../../hooks/useApiMutation';

interface AddAssetManualModalProps {
    onClose: () => void;
    itemTypes: any[];
}

export default function AddAssetManualModal({ onClose, itemTypes }: AddAssetManualModalProps) {
    const [formData, setFormData] = useState({
        serialNumber: '',
        itemTypeCode: '',
        cartonCode: '',
        notes: '',
        quantity: '',
        simProvider: 'Vodafone',
        simNetworkType: '4G'
    });

    const selectedItemType = useMemo(() =>
        itemTypes.find(t => t.code === formData.itemTypeCode),
        [formData.itemTypeCode, itemTypes]);

    const isQuantityBased = selectedItemType?.trackingMode === 'QUANTITY_BASED';
    const isSim = selectedItemType?.category === 'SIM' || selectedItemType?.code === 'SIM' || selectedItemType?.name.includes('شريحة');

    const createMutation = useApiMutation({
        mutationFn: (data: any) => api.createAdminAssetManual(data),
        successMessage: isQuantityBased ? 'تم إضافة الكمية بنجاح' : 'تم إضافة الأصل بنجاح',
        errorMessage: 'فشل الإضافة',
        invalidateKeys: [['admin-inventory'], ['admin-affairs-summary'], ['admin-stocks']],
        onSuccess: () => onClose()
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        createMutation.mutate(formData);
    };

    return (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-md flex items-start sm:items-center justify-center z-[100] p-2 sm:p-4 overflow-y-auto custom-scroll">
            <div className="bg-card rounded-[2rem] sm:rounded-[2.5rem] p-4 sm:p-7 w-full max-w-md border border-border shadow-2xl animate-scale-in my-auto text-right relative">
                <div className="flex items-center justify-between mb-5">
                    <h2 className="text-xl sm:text-2xl font-black flex items-center gap-2 sm:gap-3 text-foreground">
                        <Plus size={28} className="text-primary p-1.5 bg-primary/10 rounded-xl" />
                        {isQuantityBased ? 'إضافة رصيد مخزني' : 'إضافة عهدة جديدة'}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors group">
                        <X size={24} className="text-muted-foreground group-hover:text-foreground" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
                    <div className="space-y-4">
                        {/* Item Type */}
                        <div className="space-y-2">
                            <label className="text-xs sm:text-sm font-black text-muted-foreground mr-1">نوع الصنف</label>
                            <div className="relative group">
                                <Package size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                <select
                                    value={formData.itemTypeCode}
                                    onChange={e => setFormData({ ...formData, itemTypeCode: e.target.value })}
                                    className="w-full bg-muted/30 border-2 border-border/50 rounded-2xl pr-12 pl-4 py-4 focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none font-bold appearance-none text-sm sm:text-base cursor-pointer"
                                    required
                                >
                                    <option value="">اختر النوع...</option>
                                    {itemTypes.map((t: any) => (
                                        <option key={t.id} value={t.code}>{t.name} {t.trackingMode === 'QUANTITY_BASED' ? '(كمية)' : ''}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Quantity Based Input */}
                        {isQuantityBased && (
                            <div className="space-y-2 animate-fade-in">
                                <label className="text-xs sm:text-sm font-black text-muted-foreground mr-1">الكمية ({selectedItemType?.defaultUnit || 'وحدة'})</label>
                                <div className="relative group">
                                    <Hash size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                    <input
                                        type="number"
                                        placeholder="0"
                                        min="1"
                                        value={formData.quantity}
                                        onChange={e => setFormData({ ...formData, quantity: e.target.value })}
                                        className="w-full bg-muted/30 border-2 border-border/50 rounded-2xl pr-12 pl-4 py-4 focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none font-black text-sm sm:text-base tracking-wider"
                                        required
                                    />
                                </div>
                            </div>
                        )}

                        {/* Serial Based Input (Machine / SIM) */}
                        {!isQuantityBased && (
                            <div className="space-y-2 animate-fade-in">
                                <label className="text-xs sm:text-sm font-black text-muted-foreground mr-1">
                                    {isSim ? 'رقم الشريحة (ICCID)' : 'السيريال (Serial)'}
                                </label>
                                <div className="relative group">
                                    <Hash size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                    <input
                                        placeholder={isSim ? "8920..." : "مثال: S90-123456"}
                                        value={formData.serialNumber}
                                        onChange={e => setFormData({ ...formData, serialNumber: e.target.value.toUpperCase() })}
                                        className="w-full bg-muted/30 border-2 border-border/50 rounded-2xl pr-12 pl-4 py-4 focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none font-black text-sm sm:text-base tracking-wider"
                                        required
                                    />
                                </div>
                            </div>
                        )}

                        {/* SIM Specific Fields */}
                        {isSim && (
                            <div className="grid grid-cols-2 gap-4 animate-fade-in">
                                <div className="space-y-2">
                                    <label className="text-xs sm:text-sm font-black text-muted-foreground mr-1">الشركة</label>
                                    <div className="relative group">
                                        <Smartphone size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                        <select
                                            value={formData.simProvider}
                                            onChange={e => setFormData({ ...formData, simProvider: e.target.value })}
                                            className="w-full bg-muted/30 border-2 border-border/50 rounded-2xl pr-12 pl-4 py-4 focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none font-bold appearance-none text-sm sm:text-base cursor-pointer"
                                        >
                                            <option value="Vodafone">Vodafone</option>
                                            <option value="Orange">Orange</option>
                                            <option value="Etisalat">Etisalat</option>
                                            <option value="WE">WE</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs sm:text-sm font-black text-muted-foreground mr-1">الشبكة</label>
                                    <div className="relative group">
                                        <Signal size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                        <select
                                            value={formData.simNetworkType}
                                            onChange={e => setFormData({ ...formData, simNetworkType: e.target.value })}
                                            className="w-full bg-muted/30 border-2 border-border/50 rounded-2xl pr-12 pl-4 py-4 focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none font-bold appearance-none text-sm sm:text-base cursor-pointer"
                                        >
                                            <option value="4G">4G</option>
                                            <option value="3G">3G</option>
                                            <option value="2G">2G</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Common Fields */}
                        {!isQuantityBased && (
                            <div className="space-y-2 animate-fade-in">
                                <label className="text-xs sm:text-sm font-black text-muted-foreground mr-1">كود الكرتونة (اختياري)</label>
                                <div className="relative group">
                                    <Tag size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                    <input
                                        placeholder="مثال: CR-2024-001"
                                        value={formData.cartonCode}
                                        onChange={e => setFormData({ ...formData, cartonCode: e.target.value.toUpperCase() })}
                                        className="w-full bg-muted/30 border-2 border-border/50 rounded-2xl pr-12 pl-4 py-4 focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none font-black text-sm sm:text-base tracking-wider"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-xs sm:text-sm font-black text-muted-foreground mr-1">ملاحظات إضافية</label>
                            <div className="relative group">
                                <FileText size={20} className="absolute right-4 top-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                <textarea
                                    placeholder="سجل أي تفاصيل إضافية هنا..."
                                    value={formData.notes}
                                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                    className="w-full bg-muted/30 border-2 border-border/50 rounded-2xl pr-12 pl-4 py-4 focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none font-bold text-sm sm:text-base min-h-[100px] resize-none"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 pt-4">
                        <button
                            type="submit"
                            disabled={createMutation.isPending}
                            className="w-full sm:flex-1 bg-primary text-primary-foreground py-4 sm:py-5 rounded-2xl font-black text-lg sm:text-xl shadow-xl shadow-primary/20 hover:shadow-2xl hover:-translate-y-1 transition-all active:scale-95 disabled:opacity-50 disabled:translate-y-0"
                        >
                            {createMutation.isPending ? (
                                <span className="flex items-center justify-center gap-2">
                                    <Hash className="animate-spin" size={20} />
                                    جاري الحفظ...
                                </span>
                            ) : isQuantityBased ? 'حفظ الكمية' : 'حفظ الأصل'}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-full sm:flex-1 bg-muted hover:bg-muted/80 text-foreground py-4 sm:py-5 rounded-2xl font-black text-lg sm:text-xl transition-all active:scale-95"
                        >
                            إلغاء
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
