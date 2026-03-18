
import { request } from './baseClient';
import type { Payment, PaymentStats } from '../lib/types';

export const paymentApi = {
    getPayments: async (): Promise<Payment[]> => {
        const response = await request<any>('/payments');
        return response.data || response;
    },
    getPaymentStats: (): Promise<PaymentStats> => request('/payments/stats'),
    createPayment: (data: any) => request('/payments', { method: 'POST', body: JSON.stringify(data) }),
    deletePayment: (id: string) => request(`/payments/${id}`, { method: 'DELETE' }),
    checkReceipt: (number: string): Promise<{ exists: boolean }> =>
        request(`/payments/check-receipt?number=${encodeURIComponent(number)}`),
    getMonthlyRepairCount: (serialNumber: string, date?: string): Promise<{ count: number }> => {
        const url = `/requests/machine/${serialNumber}/monthly-count${date ? `?date=${encodeURIComponent(date)}` : ''}`;
        return request(url);
    },
    getInstallments: (overdue: boolean = false): Promise<any> => request(`/sales/installments?overdue=${overdue}`),
    payInstallment: (id: string): Promise<any> => request(`/sales/installments/${id}/pay`, { method: 'POST' }),
    payInstallmentWithDetails: (id: string, amount: number, receiptNumber: string, paymentPlace: string): Promise<any> =>
        request(`/sales/installments/${id}/pay`, {
            method: 'POST',
            body: JSON.stringify({ amount, receiptNumber, paymentPlace })
        }),
    recalculateInstallments: (saleId: string, newCount: number): Promise<any> =>
        request(`/sales/${saleId}/recalculate`, {
            method: 'PUT',
            body: JSON.stringify({ newCount })
        }),
    createSale: (data: any): Promise<any> => request('/sales', { method: 'POST', body: JSON.stringify(data) }),
    getSales: async (): Promise<any> => {
        const response = await request<any>('/sales');
        return response.data || response;
    },
    deleteSale: (id: string): Promise<any> => request(`/sales/${id}`, { method: 'DELETE' }),
};
