import React from 'react';
import { ArrowUpRight } from 'lucide-react';

interface StatCardProps {
    title: string;
    value: string | number;
    icon: React.ReactNode;
    subtext?: string;
    trend?: string;
    color: 'green' | 'orange' | 'red' | 'purple' | 'blue';
    onClick?: () => void;
    className?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, subtext, trend, color, onClick, className }) => {
    const bgColors: any = {
        green: 'bg-success/10 text-success',
        orange: 'bg-warning/10 text-warning',
        red: 'bg-destructive/10 text-destructive',
        purple: 'bg-info/10 text-info',
        blue: 'bg-primary/10 text-primary',
    };

    return (
        <div
            onClick={onClick}
            className={`bg-white p-6 rounded-2xl border border-slate-100 shadow-sm transition-all hover:shadow-md ${onClick ? 'cursor-pointer active:scale-95' : ''} ${className}`}
            dir="rtl"
        >
            <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-xl ${bgColors[color]}`}>
                    {icon}
                </div>
                {trend && (
                    <span className="flex items-center text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                        <ArrowUpRight size={14} className="mr-1" />
                        {trend}
                    </span>
                )}
            </div>
            <div className="space-y-1 text-right">
                <h3 className="text-slate-500 text-sm font-medium">{title}</h3>
                <h2 className="text-2xl font-bold text-slate-900">{value}</h2>
                {subtext && <p className="text-xs text-slate-400 mt-2">{subtext}</p>}
            </div>
        </div>
    );
};

export default StatCard;
