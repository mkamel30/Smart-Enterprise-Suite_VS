import React from 'react';
import { X, Hash, MapPin, Calendar, FileText, ArrowRight, ArrowRightLeft } from 'lucide-react';
import { Dialog } from '../ui/dialog';
import { Button } from '../ui/button';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { adminStoreApi } from '../../api/adminStoreApi';

interface AdminAssetHistoryModalProps {
    onClose: () => void;
    asset: any;
}

export default function AdminAssetHistoryModal({ onClose, asset }: AdminAssetHistoryModalProps) {
    const { data: history, isLoading } = useQuery({
        queryKey: ['admin-asset-history', asset.id],
        queryFn: () => adminStoreApi.getAdminAssetHistory(asset.id)
    });

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-card w-full max-w-2xl rounded-3xl shadow-2xl border border-border overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 border-b border-border bg-muted/30 flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-black text-foreground flex items-center gap-2">
                            <Hash className="text-primary" size={24} />
                            سجل حركات الأصل
                        </h2>
                        <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground font-bold">
                            <span className="bg-primary/10 text-primary px-3 py-1 rounded-full">{asset.serialNumber}</span>
                            <span>{asset.itemType?.name}</span>
                            {asset.model && <span>• {asset.model}</span>}
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-muted">
                        <X size={24} />
                    </Button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
                            <span>جاري تحميل السجل...</span>
                        </div>
                    ) : history && history.length > 0 ? (
                        <div className="relative border-r-2 border-border/50 mr-4 space-y-8 pr-8">
                            {history.map((record: any, index: number) => (
                                <div key={record.id} className="relative group">
                                    {/* Timeline dot */}
                                    <div className={`absolute -right-[39px] top-1 w-5 h-5 rounded-full border-4 border-card ${index === 0 ? 'bg-primary ring-4 ring-primary/20' : 'bg-muted-foreground/30'
                                        }`}></div>

                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-black text-muted-foreground bg-muted px-2 py-1 rounded-lg">
                                                {new Date(record.createdAt).toLocaleDateString('ar-EG', {
                                                    year: 'numeric', month: 'long', day: 'numeric',
                                                    hour: '2-digit', minute: '2-digit'
                                                })}
                                            </span>
                                            <span className={`text-xs font-black px-2 py-1 rounded-full ${getTypeColor(record.type)}`}>
                                                {getTypeName(record.type)}
                                            </span>
                                        </div>

                                        <div className="bg-muted/30 p-4 rounded-2xl border border-border/50 group-hover:border-primary/20 transition-colors">
                                            <div className="flex items-start gap-3">
                                                {getIconForType(record.type)}
                                                <div className="flex-1">
                                                    <p className="font-bold text-foreground text-sm leading-relaxed mb-2">
                                                        {record.notes || getAutomaticDescription(record)}
                                                    </p>

                                                    {(record.fromBranch || record.toBranch) && (
                                                        <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground bg-background/50 p-2 rounded-xl mt-2 w-fit">
                                                            {record.fromBranch && (
                                                                <>
                                                                    <span>{record.fromBranch.name}</span>
                                                                    <ArrowRight size={12} className="text-muted-foreground/50 rotate-180" />
                                                                </>
                                                            )}
                                                            {record.toBranch ? (
                                                                <span className="text-primary">{record.toBranch.name}</span>
                                                            ) : (
                                                                <span>-</span>
                                                            )}
                                                        </div>
                                                    )}

                                                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50 text-xs text-muted-foreground font-semibold">
                                                        <span>بواسطة: {record.performedBy || 'النظام'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12 text-muted-foreground">
                            <FileText size={48} className="mx-auto mb-4 opacity-20" />
                            <p className="font-bold">لا يوجد سجل حركات لهذا الأصل</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-border bg-muted/30 flex justify-end">
                    <Button onClick={onClose} variant="outline" className="font-bold rounded-xl px-6">
                        إغلاق
                    </Button>
                </div>
            </div>
        </div>
    );
}

function getTypeColor(type: string) {
    switch (type) {
        case 'IMPORT': return 'bg-emerald-500/10 text-emerald-600';
        case 'TRANSFER': return 'bg-blue-500/10 text-blue-600';
        case 'DISPOSAL': return 'bg-rose-500/10 text-rose-600';
        default: return 'bg-gray-500/10 text-gray-600';
    }
}

function getTypeName(type: string) {
    switch (type) {
        case 'IMPORT': return 'إضافة للمخزن';
        case 'TRANSFER': return 'نقل عهدة';
        case 'DISPOSAL': return 'تكهين';
        default: return type;
    }
}

function getIconForType(type: string) {
    switch (type) {
        case 'IMPORT': return <MapPin className="text-emerald-500 block min-w-[16px]" size={18} />;
        case 'TRANSFER': return <ArrowRightLeft className="text-blue-500 block min-w-[16px]" size={18} />;
        case 'DISPOSAL': return <X className="text-rose-500 block min-w-[16px]" size={18} />;
        default: return <FileText className="text-gray-500 block min-w-[16px]" size={18} />;
    }
}

function getAutomaticDescription(record: any) {
    if (record.type === 'TRANSFER' && record.toBranch) {
        return `تم نقل الأصل إلى ${record.toBranch.name}`;
    }
    return 'حركة إدارية';
}
