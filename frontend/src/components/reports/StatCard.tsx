import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface StatCardProps {
    title: string;
    value: string | number;
    icon: React.ReactNode;
    color: 'blue' | 'emerald' | 'orange' | 'purple';
    trend?: string;
    trendUp?: boolean;
    suffix?: string;
    breakdown?: {
        machines: number;
        sims: number;
        maintenance: number;
        manual: number;
        other: number;
    };
}

export function StatCard({ title, value, icon, color, trend, trendUp, suffix, breakdown }: StatCardProps) {
    const colors = {
        blue: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
        emerald: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
        orange: 'text-orange-500 bg-orange-500/10 border-orange-500/20',
        purple: 'text-purple-500 bg-purple-500/10 border-purple-500/20',
    };

    return (
        <div className="bg-card p-8 rounded-[2.5rem] border border-border shadow-lg hover:shadow-2xl transition-all group relative overflow-hidden flex flex-col justify-between">
            <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-5 group-hover:scale-150 transition-transform ${colors[color].split(' ')[1]}`} />

            <div>
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 border shadow-inner ${colors[color]}`}>
                    {icon}
                </div>

                <p className="text-muted-foreground text-xs font-black uppercase tracking-widest mb-2">{title}</p>
                <div className="flex items-baseline gap-2">
                    <h2 className="text-3xl font-black text-foreground tracking-tighter">
                        {typeof value === 'number' ? value.toLocaleString() : value}
                    </h2>
                    {suffix && <span className="text-xs font-bold text-muted-foreground">{suffix}</span>}
                </div>

                {trend && (
                    <div className={`mt-4 flex items-center gap-1.5 text-xs font-bold ${trendUp ? 'text-emerald-600' : 'text-red-600'}`}>
                        {trendUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                        {trend} مقارنة بالماضي
                    </div>
                )}
            </div>

            {/* Breakdown Subtotals */}
            {breakdown && (
                <div className="mt-6 pt-4 border-t border-border space-y-2">
                    <div className="flex justify-between text-[10px] font-bold">
                        <span className="text-muted-foreground">الماكينات:</span>
                        <span className="text-foreground">{breakdown.machines.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-[10px] font-bold">
                        <span className="text-muted-foreground">الشرائح:</span>
                        <span className="text-foreground">{breakdown.sims.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-[10px] font-bold">
                        <span className="text-muted-foreground">الصيانة:</span>
                        <span className="text-foreground">{breakdown.maintenance.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-[10px] font-bold">
                        <span className="text-muted-foreground">أخرى:</span>
                        <span className="text-foreground">{(breakdown.manual + breakdown.other).toLocaleString()}</span>
                    </div>
                </div>
            )}
        </div>
    );
}
