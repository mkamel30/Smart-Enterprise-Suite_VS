import React, { useState } from 'react';
import { X, ArrowRightLeft, MapPin, Hash, FileText, CheckCircle2 } from 'lucide-react';
import { api } from '../../api/client';
import { useApiMutation } from '../../hooks/useApiMutation';
import { useQuery } from '@tanstack/react-query';

interface AdminStockTransferModalProps {
    onClose: () => void;
    stock: any; // { itemType: { code, name }, quantity: number, branchId: string | null }
}

export default function AdminStockTransferModal({ onClose, stock }: AdminStockTransferModalProps) {
    const [formData, setFormData] = useState({
        quantity: '',
        toBranchId: '',
        notes: ''
    });

    const { data: branches } = useQuery({
        queryKey: ['branches-lookup'],
        queryFn: () => api.getAuthorizedBranches()
    });

    const transferMutation = useApiMutation({
        mutationFn: (data: any) => api.transferAdminStock(data),
        successMessage: 'تم تحويل الكمية بنجاح',
        errorMessage: 'فشل التحويل',
        invalidateKeys: [['admin-stocks'], ['admin-inventory']],
        onSuccess: () => onClose()
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.toBranchId) return;

        transferMutation.mutate({
            itemTypeCode: stock.itemTypeCode,
            quantity: parseInt(formData.quantity) || 0,
            toBranchId: formData.toBranchId,
            notes: formData.notes
        });
    };

    const maxQty = stock.quantity;

    return (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
            <div className="bg-card rounded-[2.5rem] p-8 w-full max-w-lg border border-border shadow-2xl animate-scale-in text-right">
                <div className="flex items-center justify-between mb-8">
                    <h2 className="text-2xl font-black flex items-center gap-3 text-foreground">
                        <ArrowRightLeft size={32} className="text-blue-500 p-2 bg-blue-500/10 rounded-xl" />
                        تحويل مخزون ( {stock.itemType?.name} )
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors group">
                        <X size={24} className="text-muted-foreground group-hover:text-foreground" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="bg-muted/30 p-4 rounded-2xl border border-border/50 space-y-2">
                        <div className="flex justify-between items-center text-sm font-bold">
                            <span className="text-muted-foreground">الرصيد الحالي:</span>
                            <span className="text-primary">{stock.quantity} {stock.itemType?.defaultUnit || 'وحدة'}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm font-bold">
                            <span className="text-muted-foreground">الموقع الحالي:</span>
                            <span className="text-foreground">{stock.branch ? stock.branch.name : 'المخزن الإداري'}</span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-black text-muted-foreground mr-1">الفرع المستلم</label>
                        <div className="relative group">
                            <MapPin size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                            <select
                                value={formData.toBranchId}
                                onChange={e => setFormData({ ...formData, toBranchId: e.target.value })}
                                className="w-full bg-muted/30 border-2 border-border/50 rounded-2xl pr-12 pl-4 py-4 focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none font-bold appearance-none text-base cursor-pointer"
                                required
                            >
                                <option value="">اختر الفرع...</option>
                                {branches?.filter((b: any) => b.id !== (stock.branchId || '')) // explicit filter if needed, though backend handles it
                                    .map((b: any) => (
                                        <option key={b.id} value={b.id}>{b.name}</option>
                                    ))}
                            </select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-black text-muted-foreground mr-1">الكمية المراد تحويلها</label>
                        <div className="relative group">
                            <Hash size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                            <input
                                type="number"
                                min="1"
                                max={maxQty}
                                placeholder={`الحد الأقصى: ${maxQty}`}
                                value={formData.quantity}
                                onChange={e => setFormData({ ...formData, quantity: e.target.value })}
                                className="w-full bg-muted/30 border-2 border-border/50 rounded-2xl pr-12 pl-4 py-4 focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none font-black text-base tracking-wider"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-black text-muted-foreground mr-1">ملاحظات التوريد</label>
                        <div className="relative group">
                            <FileText size={20} className="absolute right-4 top-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                            <textarea
                                placeholder="اختياري..."
                                value={formData.notes}
                                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                className="w-full bg-muted/30 border-2 border-border/50 rounded-2xl pr-12 pl-4 py-4 focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none font-bold text-base min-h-[100px] resize-none"
                            />
                        </div>
                    </div>

                    <div className="flex gap-4 pt-4">
                        <button
                            type="submit"
                            disabled={transferMutation.isPending}
                            className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-blue-600/20 hover:shadow-2xl hover:-translate-y-1 transition-all active:scale-95 disabled:opacity-50 disabled:translate-y-0"
                        >
                            {transferMutation.isPending ? 'جاري التحويل...' : 'تأكيد التحويل'}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 bg-muted hover:bg-muted/80 text-foreground py-4 rounded-2xl font-black text-lg transition-all active:scale-95"
                        >
                            إلغاء
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
