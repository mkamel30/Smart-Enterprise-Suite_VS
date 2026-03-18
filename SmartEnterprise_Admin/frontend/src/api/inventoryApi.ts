
import { request } from './baseClient';

export const inventoryApi = {
    getInventory: (params?: { branchId?: string; page?: number; limit?: number; search?: string; model?: string }): Promise<any> => {
        const query = new URLSearchParams();
        if (params?.branchId) query.append('branchId', params.branchId);
        if (params?.page) query.append('page', params.page.toString());
        if (params?.limit) query.append('limit', params.limit.toString());
        if (params?.search) query.append('search', params.search);
        if (params?.model) query.append('model', params.model);

        return request(`/inventory?${query.toString()}`);
    },

    getInventoryLite: (search?: string): Promise<any[]> => {
        const query = search ? `?search=${encodeURIComponent(search)}` : '';
        return request(`/inventory/lite${query}`);
    },

    getStockMovements: (params?: { branchId?: string; model?: string; startDate?: string; endDate?: string; search?: string }): Promise<any[]> => {
        const query = new URLSearchParams();
        if (params?.branchId) query.append('branchId', params.branchId);
        if (params?.model) query.append('model', params.model);
        if (params?.startDate) query.append('startDate', params.startDate);
        if (params?.endDate) query.append('endDate', params.endDate);
        if (params?.search) query.append('search', params.search);

        return request(`/inventory/movements?${query.toString()}`);
    },

    updateInventory: (id: string, quantity: number) => {
        return request(`/inventory/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ quantity })
        });
    },

    importInventory: (items: any[], branchId?: string) => {
        return request('/inventory/import', {
            method: 'POST',
            body: JSON.stringify({ items, branchId })
        });
    },

    getInventoryReport: (params?: { branchId?: string }) => {
        const query = params?.branchId ? `?branchId=${params.branchId}` : '';
        return request(`/reports/inventory${query}`);
    },

    transferInventory: (data: {
        partId: string;
        quantity: number;
        fromBranchId: string;
        toBranchId: string;
        reason?: string;
    }): Promise<any> => {
        return request('/inventory/transfer', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }
};
