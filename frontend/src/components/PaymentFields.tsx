import { useState } from 'react';
import { CreditCard, DollarSign, Building2 } from 'lucide-react';

export type PaymentMethod = 'ضامن' | 'البريد' | 'بنك';

export interface PaymentData {
    amount: number;
    receiptNumber: string;
    paymentPlace: PaymentMethod;
}

export const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: any }[] = [
    { value: 'ضامن', label: 'ضامن', icon: CreditCard },
    { value: 'البريد', label: 'البريد', icon: DollarSign },
    { value: 'بنك', label: 'بنك', icon: Building2 },
];

export function usePaymentForm(initialData?: Partial<PaymentData>) {
    const [data, setData] = useState<PaymentData>({
        amount: initialData?.amount || 0,
        receiptNumber: initialData?.receiptNumber || '',
        paymentPlace: initialData?.paymentPlace || 'ضامن'
    });

    // If amount > 0 => receipt is required; if 0 => allow proceed (installment with no upfront)
    const isValid = data.amount > 0 ? data.receiptNumber.trim().length > 0 : true;

    const updateField = (field: keyof PaymentData, value: any) => {
        setData(prev => ({ ...prev, [field]: value }));
    };

    const reset = () => {
        setData({
            amount: 0,
            receiptNumber: '',
            paymentPlace: 'ضامن'
        });
    };

    return { data, updateField, reset, isValid, setData };
}

interface PaymentFieldsProps {
    data: PaymentData;
    onChange: (field: keyof PaymentData, value: any) => void;
    showAmount?: boolean; // Sometimes amount is fixed or handled elsewhere
    disabled?: boolean;
    amountReadOnly?: boolean;
    onReceiptBlur?: (value: string) => void;
    receiptExists?: boolean;
    receiptChecking?: boolean;
}

export function PaymentFields({
    data,
    onChange,
    showAmount = true,
    disabled = false,
    amountReadOnly = false,
    onReceiptBlur,
    receiptExists = false,
    receiptChecking = false
}: PaymentFieldsProps) {
    return (
        <div className="space-y-4">
            {showAmount && (
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">المبلغ المدفوع</label>
                    <div className="relative">
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={data.amount || ''}
                            onChange={(e) => onChange('amount', parseFloat(e.target.value) || 0)}
                            className={`w-full border rounded-lg pr-3 pl-10 py-2 focus:ring-2 focus:ring-blue-500 outline-none ${amountReadOnly ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                            placeholder="0.00"
                            disabled={disabled || amountReadOnly}

                        />
                        <div className="absolute left-3 top-2.5 text-gray-400 text-sm">ج.م</div>
                    </div>
                </div>
            )}

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">طريقة الدفع</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {PAYMENT_METHODS.map((method) => {
                        const Icon = method.icon;
                        const isSelected = data.paymentPlace === method.value;
                        return (
                            <button
                                key={method.value}
                                type="button"
                                onClick={() => onChange('paymentPlace', method.value)}
                                disabled={disabled}
                                className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${isSelected
                                    ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                    }`}
                            >
                                <Icon size={20} className="mb-1" />
                                <span className="text-xs font-medium">{method.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">رقم الإيصال</label>
                <input
                    type="text"
                    value={data.receiptNumber}
                    onChange={(e) => onChange('receiptNumber', e.target.value)}
                    onBlur={(e) => onReceiptBlur?.(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="أدخل رقم الإيصال..."
                    disabled={disabled}
                    dir="ltr" // Receipt numbers are usually LTR
                />
                <div className="flex items-center gap-2 mt-1 text-xs">
                    {receiptChecking && <span className="text-blue-500">جار التحقق...</span>}
                    {receiptExists && !receiptChecking && (
                        <span className="text-red-600 font-semibold">⚠️ رقم الإيصال مكرر</span>
                    )}
                    {!receiptExists && !receiptChecking && data.receiptNumber.length > 0 && (
                        <span className="text-green-600">✓ رقم الإيصال متاح</span>
                    )}
                </div>
            </div>
        </div>
    );
}
