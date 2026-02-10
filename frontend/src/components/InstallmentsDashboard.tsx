import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { Users, FileText, DollarSign, Calendar, AlertCircle } from 'lucide-react';
import type { InstallmentStats } from '../lib/types';

interface StatCardProps {
    title: string;
    value: string | number;
    icon: any;
    color: string;
    subValue?: string;
    onClick?: () => void;
}

const StatCard = ({ title, value, icon: Icon, color, subValue, onClick }: StatCardProps) => (
    <div
        className={`bg-white p-6 rounded-xl shadow-sm border border-slate-100 relative overflow-hidden group transition-all hover:shadow-md ${onClick ? 'cursor-pointer' : ''}`}
        onClick={onClick}
    >
        <div className={`absolute top-0 right-0 w-full h-1 bg-${color}-500 opacity-90`} />
        <div className="flex items-start justify-between relative z-10">
            <div>
                <p className="text-slate-500 font-medium text-sm mb-1">{title}</p>
                <h3 className="text-2xl font-bold text-slate-800">{value}</h3>
                {subValue && <p className="text-xs text-slate-400 mt-1">{subValue}</p>}
            </div>
            <div className={`p-3 rounded-lg bg-${color}-50 text-${color}-600 group-hover:scale-110 transition-transform`}>
                <Icon size={24} />
            </div>
        </div>
    </div>
);

export default function InstallmentsDashboard({ onFilterOverdue }: { onFilterOverdue: () => void }) {
    const { data: stats, isLoading } = useQuery<InstallmentStats>({
        queryKey: ['installment-stats'],
        queryFn: () => api.getInstallmentStats()
    });

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 animate-pulse">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-32 bg-slate-100 rounded-xl"></div>
                ))}
            </div>
        );
    }

    if (!stats) return null;

    return (
        <div className="mb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* 1. Customers with Installments */}
                <StatCard
                    title="العملاء (أقساط جارية)"
                    value={stats.customersCount}
                    icon={Users}
                    color="blue"
                    subValue="عميل لديه أقساط نشطة"
                />

                {/* 2. Total Installments (Unpaid) */}
                <StatCard
                    title="إجمالي الأقساط المتبقية"
                    value={stats.totalInstallments}
                    icon={FileText}
                    color="indigo"
                    subValue="قسط مستحق السداد"
                />

                {/* 3. Total Value */}
                <StatCard
                    title="المستحقات القائمة"
                    value={stats.totalValue.toLocaleString('ar-EG')}
                    icon={DollarSign}
                    color="emerald"
                    subValue="جنية مصري"
                />

                {/* 4. Average Months */}
                <StatCard
                    title="متوسط مدة السداد"
                    value={`${stats.avgMonths} شهر`}
                    icon={Calendar}
                    color="purple"
                    subValue="متوسط فترة التقسيط"
                />

                {/* 5. Overdue (Clickable) */}
                <StatCard
                    title="الأقساط المتأخرة"
                    value={stats.overdueCount}
                    subValue={`${stats.overdueCustomersCount} عميل لديهم متأخرات`}
                    icon={AlertCircle}
                    color="red"
                    onClick={onFilterOverdue}
                />
            </div>
        </div>
    );
}
