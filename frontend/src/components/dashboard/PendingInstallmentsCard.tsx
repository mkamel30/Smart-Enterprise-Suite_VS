import React from 'react';
import { DollarSign, Clock, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface PendingInstallmentsCardProps {
    installmentsData: any;
    periodLabel: string;
}

const PendingInstallmentsCard: React.FC<PendingInstallmentsCardProps> = ({ installmentsData, periodLabel }) => {
    const navigate = useNavigate();

    return (
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
            <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-base text-slate-800 flex items-center gap-2">
                    <DollarSign size={18} className="text-orange-500" />
                    الأقساط المستحقة ({periodLabel})
                </h3>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-orange-50 p-2 rounded-lg text-center">
                    <div className="text-xl font-bold text-orange-600">
                        {installmentsData?.totalCount || 0}
                    </div>
                    <div className="text-xs text-orange-700">قسط مستحق</div>
                </div>
                <div className="bg-red-50 p-2 rounded-lg text-center">
                    <div className="text-base font-bold text-red-600">
                        {(installmentsData?.totalAmount || 0).toLocaleString()}
                    </div>
                    <div className="text-xs text-red-700">ج.م الإجمالي</div>
                </div>
            </div>

            {/* Installments List */}
            <div className="space-y-1 max-h-[150px] overflow-y-auto">
                {installmentsData?.installments?.map((inst: any) => (
                    <div key={inst.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-100">
                        <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm text-slate-700 truncate">{inst.sale?.customer?.client_name || 'عميل'}</div>
                            <div className="text-xs text-slate-500">قسط {inst.installmentNumber || 1}/{inst.totalInstallments || 1}</div>
                        </div>
                        <div className="text-left mr-2">
                            <div className="font-bold text-sm text-slate-800">{inst.amount.toLocaleString()} ج.م</div>
                            <div className="text-xs text-orange-500">
                                <Clock size={10} className="inline ml-1" />
                                {new Date(inst.dueDate).toLocaleDateString('ar-EG')}
                            </div>
                        </div>
                    </div>
                ))}
                {(!installmentsData?.installments || installmentsData.installments.length === 0) && (
                    <div className="text-center py-3 text-slate-500 text-sm">
                        <CheckCircle2 size={24} className="mx-auto text-green-500 mb-2" />
                        لا توجد أقساط مستحقة
                    </div>
                )}
            </div>

            <button
                onClick={() => navigate('/receipts')}
                className="w-full mt-2 text-sm text-primary hover:underline"
            >
                عرض كل الأقساط →
            </button>
        </div>
    );
};

export default PendingInstallmentsCard;
