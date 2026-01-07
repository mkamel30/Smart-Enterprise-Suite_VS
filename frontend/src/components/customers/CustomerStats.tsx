import React from 'react';
import { Users, Monitor, CreditCard } from 'lucide-react';

interface CustomerStatsProps {
    stats: {
        customers: number;
        machines: number;
        simCards: number;
    };
}

export default function CustomerStats({ stats }: CustomerStatsProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8" dir="rtl">
            {/* 1 - العملاء (Right) */}
            <div className="bg-card p-6 rounded-4xl border border-border shadow-xl hover:shadow-2xl transition-all group overflow-hidden relative">
                <div className="absolute top-0 left-0 p-8 opacity-5 group-hover:scale-125 transition-transform">
                    <Users size={80} />
                </div>
                <div className="flex flex-row-reverse items-center justify-end gap-4 text-muted-foreground mb-3 font-black text-xs uppercase tracking-widest">
                    <div className="p-2 bg-primary/10 rounded-xl text-primary">
                        <Users size={20} />
                    </div>
                    <span>إجمالي العملاء</span>
                </div>
                <div className="text-4xl font-black tracking-tighter text-right">{stats.customers}</div>
                <div className="mt-2 text-[10px] font-bold text-emerald-500 bg-emerald-500/10 w-fit px-2 py-0.5 rounded-full mr-auto">نظام نشط</div>
            </div>

            {/* 2 - الماكينات (Middle) */}
            <div className="bg-card p-6 rounded-4xl border border-border shadow-xl hover:shadow-2xl transition-all group overflow-hidden relative">
                <div className="absolute top-0 left-0 p-8 opacity-5 group-hover:scale-125 transition-transform">
                    <Monitor size={80} />
                </div>
                <div className="flex flex-row-reverse items-center justify-end gap-4 text-muted-foreground mb-3 font-black text-xs uppercase tracking-widest">
                    <div className="p-2 bg-blue-500/10 rounded-xl text-blue-500">
                        <Monitor size={20} />
                    </div>
                    <span>إجمالي الماكينات</span>
                </div>
                <div className="text-4xl font-black tracking-tighter text-right">{stats.machines}</div>
                <div className="mt-2 text-[10px] font-bold text-blue-500 bg-blue-500/10 w-fit px-2 py-0.5 rounded-full mr-auto">تغطية الأجهزة</div>
            </div>

            {/* 3 - الشرائح (Left) */}
            <div className="bg-card p-6 rounded-4xl border border-border shadow-xl hover:shadow-2xl transition-all group overflow-hidden relative">
                <div className="absolute top-0 left-0 p-8 opacity-5 group-hover:scale-125 transition-transform">
                    <CreditCard size={80} />
                </div>
                <div className="flex flex-row-reverse items-center justify-end gap-4 text-muted-foreground mb-3 font-black text-xs uppercase tracking-widest">
                    <div className="p-2 bg-purple-500/10 rounded-xl text-purple-500">
                        <CreditCard size={20} />
                    </div>
                    <span>إجمالي الشرائح</span>
                </div>
                <div className="text-4xl font-black tracking-tighter text-right">{stats.simCards}</div>
                <div className="mt-2 text-[10px] font-bold text-purple-500 bg-purple-500/10 w-fit px-2 py-0.5 rounded-full mr-auto">اتصالات مفعلة</div>
            </div>
        </div>
    );
}
