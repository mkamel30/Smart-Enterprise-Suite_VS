import { DollarSign, TrendingUp, AlertTriangle, Wrench } from 'lucide-react';

interface SummaryProps {
    summary: {
        totalMonthlyRevenue: number;
        totalSalesValue: number;
        totalOverdueAmount: number;
        totalPaidParts: number;
        totalFreeParts: number;
        totalPartsValue: number;
    } | undefined;
}

const formatCurrency = (val: number) => val?.toLocaleString('ar-EG') || '0';

export function OverallSummary({ summary }: SummaryProps) {
    if (!summary) return null;

    const cards = [
        {
            label: 'إجمالي إيرادات الشهر',
            value: summary.totalMonthlyRevenue,
            icon: <DollarSign size={24} />,
            textColor: 'text-emerald-600',
            bgColor: 'bg-emerald-50'
        },
        {
            label: 'إجمالي المبيعات',
            value: summary.totalSalesValue,
            icon: <TrendingUp size={24} />,
            textColor: 'text-indigo-600',
            bgColor: 'bg-indigo-50'
        },
        {
            label: 'أقساط متأخرة',
            value: summary.totalOverdueAmount,
            icon: <AlertTriangle size={24} />,
            textColor: 'text-red-600',
            bgColor: 'bg-red-50'
        },
        {
            label: 'قطع غيار مصروفة',
            value: summary.totalPartsValue,
            icon: <Wrench size={24} />,
            textColor: 'text-amber-600',
            bgColor: 'bg-amber-50'
        }
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
            {cards.map((card) => (
                <div
                    key={card.label}
                    className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all"
                >
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-2xl ${card.bgColor} ${card.textColor}`}>
                            {card.icon}
                        </div>
                        <div>
                            <p className="text-sm text-slate-500 font-medium">{card.label}</p>
                            <p className={`text-2xl font-black ${card.textColor}`}>
                                {formatCurrency(card.value)} <span className="text-sm font-bold">ج.م</span>
                            </p>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
