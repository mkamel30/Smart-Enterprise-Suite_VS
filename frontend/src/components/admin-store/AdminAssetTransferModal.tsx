import React, { useState } from 'react';
import { X, ArrowRightLeft, MapPin, CheckCircle2, Info, AlertCircle, Box, Send } from 'lucide-react';
import { api } from '../../api/client';
import { useApiMutation } from '../../hooks/useApiMutation';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { getLegalTargetBranches } from '../../utils/transferValidation';

interface AdminAssetTransferModalProps {
    onClose: () => void;
    asset?: any;
    cartonCode?: string;
    assets?: any[];
    cartons?: string[];
}

export default function AdminAssetTransferModal({ onClose, asset, cartonCode, assets, cartons }: AdminAssetTransferModalProps) {
    const [targetBranchId, setTargetBranchId] = useState('');
    const [notes, setNotes] = useState('');

    const { user } = useAuth();
    const { data: branches } = useQuery({
        queryKey: ['branches-lookup'],
        queryFn: api.getAuthorizedBranches
    });

    const isBulk = (assets && assets.length > 0) || (cartons && cartons.length > 0);
    const isCarton = !!cartonCode;

    // Identify the source branch (Administrative Affairs)
    const fromBranch = branches?.find((b: any) =>
        (user?.branchId && b.id === user.branchId) || b.type === 'ADMIN_AFFAIRS'
    );

    // For single asset, determine type for validation
    const transferType = asset ? (asset.itemType?.code === 'SIM' ? 'SIM' : 'MACHINE') : 'ASSET';

    const legalBranches = fromBranch && branches
        ? getLegalTargetBranches(fromBranch, branches, transferType)
        : branches?.filter((b: any) => b.id !== user?.branchId && b.type !== 'ADMIN_AFFAIRS');

    const transferMutation = useApiMutation({
        mutationFn: () => {
            if (isBulk) {
                return api.transferAdminBulk({
                    assetIds: assets?.map((a: any) => a.id) || [],
                    cartonCodes: cartons || [],
                    targetBranchId,
                    notes
                });
            }
            return isCarton
                ? api.transferAdminCarton({ cartonId: cartonCode, targetBranchId, notes })
                : api.transferAdminAsset({ assetId: asset.id, targetBranchId, notes });
        },
        successMessage: `تم تحويل ${isBulk ? 'العناصر المختارة' : isCarton ? 'الكرتونة' : 'الأصل'} بنجاح`,
        errorMessage: 'فشل عملية التحويل',
        invalidateKeys: [['admin-inventory'], ['admin-cartons'], ['admin-affairs-summary']],
        onSuccess: () => onClose()
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!targetBranchId) return;
        transferMutation.mutate({});
    };

    return (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-md flex items-start sm:items-center justify-center z-[110] p-2 sm:p-4 overflow-y-auto">
            <div className="bg-card rounded-[2rem] sm:rounded-[3rem] p-5 sm:p-10 w-full max-w-lg border border-border shadow-2xl animate-scale-in my-4 sm:my-8 text-right">
                <div className="flex items-center justify-between mb-6 sm:mb-8">
                    <h2 className="text-xl sm:text-3xl font-black flex items-center gap-2 sm:gap-3 text-foreground">
                        <ArrowRightLeft size={32} className="text-primary sm:w-10 sm:h-10 p-2 bg-primary/10 rounded-xl" />
                        {isBulk ? 'تحويل جماعي' : 'تحويل عهدة'}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors group">
                        <X size={24} className="text-muted-foreground group-hover:text-foreground" />
                    </button>
                </div>

                <div className="bg-primary/5 border-2 border-primary/10 rounded-3xl p-4 sm:p-6 mb-6 sm:mb-8 flex items-start gap-3 sm:gap-5">
                    <div className="p-4 bg-white dark:bg-neutral-800 rounded-2xl shadow-sm">
                        <Box size={28} className="text-primary" />
                    </div>
                    <div className="flex-1">
                        <div className="text-[10px] sm:text-xs font-black text-muted-foreground mb-1 uppercase tracking-tight">تفاصيل المحتوى المراد تحويله</div>
                        <div className="text-lg sm:text-xl font-black text-primary mb-0.5">
                            {isBulk ? (
                                <div className="flex flex-col">
                                    {assets && assets.length > 0 && <span>{assets.length} صنف منفرد</span>}
                                    {cartons && cartons.length > 0 && <span>{cartons.length} كرتونة كاملة</span>}
                                </div>
                            ) : (
                                asset ? `${asset.serialNumber}` : `${cartonCode}`
                            )}
                        </div>
                        <div className="text-xs sm:text-sm text-primary/70 font-bold">
                            {isBulk ? `إجمالي ${(assets?.length || 0) + (cartons?.length || 0)} عنصر مختار` : (asset ? `صنف: ${asset.itemType?.name}` : 'تحويل كامل محتويات الكرتونة')}
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-xs sm:text-sm font-black text-muted-foreground mr-1">الفرع / الموقع المستلم</label>
                        <div className="relative group">
                            <MapPin size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                            <select
                                value={targetBranchId}
                                onChange={e => setTargetBranchId(e.target.value)}
                                className="w-full bg-muted/30 border-2 border-border/50 rounded-2xl pr-12 pl-4 py-4 focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none font-bold appearance-none text-sm sm:text-base cursor-pointer text-foreground"
                                required
                            >
                                <option value="" className="text-muted-foreground">اختر الفرع المستلم...</option>
                                {legalBranches?.map((b: any) => (
                                    <option key={b.id} value={b.id} className="text-foreground">{b.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs sm:text-sm font-black text-muted-foreground mr-1">سبب أو ملاحظات التحويل</label>
                        <textarea
                            placeholder="أي ملاحظات إدارية حول هذه العملية..."
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            className="w-full bg-muted/30 border-2 border-border/50 rounded-2xl px-5 py-4 focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none font-bold text-sm sm:text-base h-28 resize-none leading-relaxed"
                        />
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-border">
                        <button
                            type="submit"
                            disabled={transferMutation.isPending || !targetBranchId}
                            className="w-full sm:flex-1 bg-primary text-primary-foreground py-4 sm:py-5 rounded-2xl font-black text-lg sm:text-xl shadow-xl shadow-primary/20 hover:shadow-2xl hover:-translate-y-1 transition-all active:scale-95 disabled:opacity-50 disabled:translate-y-0 order-1 sm:order-2 flex items-center justify-center gap-3"
                        >
                            {transferMutation.isPending ? (
                                <ArrowRightLeft className="animate-spin" size={24} />
                            ) : (
                                <Send size={24} />
                            )}
                            تأكيد التحويل
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
