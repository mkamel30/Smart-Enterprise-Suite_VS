import React from 'react';
import { X } from 'lucide-react';
import { FaHistory } from 'react-icons/fa';

interface CustomerDetailHeaderProps {
    customer: any;
    onClose: () => void;
    onShowHistory: () => void;
}

export default function CustomerDetailHeader({
    customer,
    onClose,
    onShowHistory
}: CustomerDetailHeaderProps) {
    return (
        <div className="p-8 border-b border-border/50 bg-muted/20 flex flex-row-reverse justify-between items-start">
            <div className="text-right">
                <h2 className="text-3xl font-black tracking-tight flex flex-row-reverse items-center gap-3">
                    <span>{customer.client_name}</span>
                    <button
                        onClick={onShowHistory}
                        className="text-[10px] bg-primary/10 text-primary px-3 py-1 rounded-full hover:bg-primary/20 transition-all flex flex-row-reverse items-center gap-2 font-black uppercase tracking-widest"
                        title="عرض سجل التعديلات"
                    >
                        <FaHistory size={12} />
                        سجل الحركة
                    </button>
                </h2>
                <div className="flex flex-row-reverse items-center gap-2 mt-2">
                    <span className="bg-slate-500/10 text-slate-500 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest">
                        بكود: {customer.bkcode}
                    </span>
                    {customer.branch?.name && (
                        <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest">
                            {customer.branch.name}
                        </span>
                    )}
                </div>
            </div>
            <button
                onClick={onClose}
                className="p-3 hover:bg-muted rounded-2xl transition-all hover:rotate-90 active:scale-95 text-muted-foreground"
                title="إغلاق بطاقة العميل"
            >
                <X size={24} strokeWidth={3} />
            </button>
        </div>
    );
}
