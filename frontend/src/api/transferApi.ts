
import { request } from './baseClient';

export const transferApi = {
    getTransferOrders: async (params?: { branchId?: string; status?: string; type?: string; q?: string }): Promise<any[]> => {
        const query = new URLSearchParams();
        if (params?.branchId) query.append('branchId', params.branchId);
        if (params?.status) query.append('status', params.status);
        if (params?.type) query.append('type', params.type);
        if (params?.q) query.append('q', params.q);
        const response = await request<any>(`/transfer-orders?${query.toString()}`);
        return response.data || response;
    },

    getPendingTransferOrders: (branchId?: string): Promise<any[]> => {
        const query = branchId ? `?branchId=${branchId}` : '';
        return request(`/transfer-orders/pending${query}`);
    },

    getPendingTransferSerials: (branchId?: string, type?: string): Promise<string[]> => {
        const params = new URLSearchParams();
        if (branchId) params.append('branchId', branchId);
        if (type) params.append('type', type);
        const query = params.toString();
        return request(`/transfer-orders/pending-serials${query ? '?' + query : ''}`);
    },

    getTransferOrder: (id: string): Promise<any> => request(`/transfer-orders/${id}`),

    createTransferOrder: (data: any): Promise<any> =>
        request('/transfer-orders', { method: 'POST', body: JSON.stringify(data) }),

    importTransferOrder: (formData: FormData): Promise<any> =>
        request('/transfer-orders/import', { method: 'POST', body: formData }),

    receiveTransferOrder: (id: string, data: any): Promise<any> =>
        request(`/transfer-orders/${id}/receive`, { method: 'POST', body: JSON.stringify(data) }),

    rejectTransferOrder: (id: string, data: any): Promise<any> =>
        request(`/transfer-orders/${id}/reject`, { method: 'POST', body: JSON.stringify(data) }),

    cancelTransferOrder: (id: string): Promise<any> =>
        request(`/transfer-orders/${id}/cancel`, { method: 'POST' }),

    getTransferOrderStats: (params?: { branchId?: string }): Promise<any> => {
        const query = params?.branchId ? `?branchId=${params.branchId}` : '';
        return request(`/transfer-orders/stats/summary${query}`);
    }
};
