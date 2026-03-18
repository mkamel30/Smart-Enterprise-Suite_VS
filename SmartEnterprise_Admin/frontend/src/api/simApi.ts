
import { request, downloadFile } from './baseClient';

export const simApi = {
    // Assets Definitions
    getAllSimCards: async (): Promise<any[]> => {
        const response = await request<any>('/simcards');
        return response.data || response;
    },
    updateSimCard: (id: string, data: { type: string }) =>
        request(`/simcards/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    getSimCardTemplate: () => downloadFile('/simcards/template', 'simcards_template.xlsx'),
    importSimCards: (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        return request<any>('/simcards/import', { method: 'POST', body: formData });
    },
    exportSimCards: () => downloadFile('/simcards/export', 'simcards_export.xlsx'),

    // Warehouse Operations
    getWarehouseSims: async (branchId?: string, status?: string): Promise<any[]> => {
        const params = new URLSearchParams();
        if (branchId) params.append('branchId', branchId);
        if (status && status !== 'ALL') params.append('status', status);
        const query = params.toString() ? `?${params.toString()}` : '';
        const response = await request<any>(`/warehouse-sims${query}`);
        return response.data || response;
    },
    getWarehouseSimCounts: (branchId?: string): Promise<any> => {
        const query = branchId ? `?branchId=${branchId}` : '';
        return request(`/warehouse-sims/counts${query}`);
    },
    createWarehouseSim: (data: { serialNumber: string; type?: string; networkType?: string; status?: string; notes?: string }): Promise<any> =>
        request('/warehouse-sims', { method: 'POST', body: JSON.stringify(data) }),
    updateWarehouseSim: (id: string, data: any): Promise<any> =>
        request(`/warehouse-sims/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteWarehouseSim: (id: string): Promise<any> =>
        request(`/warehouse-sims/${id}`, { method: 'DELETE' }),
    transferWarehouseSims: (data: { simIds: string[]; targetBranchId: string; notes?: string }): Promise<any> =>
        request('/warehouse-sims/transfer', { method: 'POST', body: JSON.stringify(data) }),
    getAvailableWarehouseSims: async (branchId?: string): Promise<any[]> => {
        const query = branchId ? `?branchId=${branchId}&status=ACTIVE` : '?status=ACTIVE';
        const response = await request<any>(`/warehouse-sims${query}`);
        return response.data || response;
    },

    // Customer Operations
    assignSimToCustomer: (data: any): Promise<any> =>
        request('/warehouse-sims/assign', { method: 'POST', body: JSON.stringify(data) }),
    exchangeSim: (data: any): Promise<any> =>
        request('/warehouse-sims/exchange', { method: 'POST', body: JSON.stringify(data) }),
    returnSimToWarehouse: (data: any): Promise<any> =>
        request('/warehouse-sims/return', { method: 'POST', body: JSON.stringify(data) }),
    getSimMovements: (serialNumber?: string): Promise<any[]> => {
        const query = serialNumber ? `?serialNumber=${serialNumber}` : '';
        return request(`/warehouse-sims/movements${query}`);
    },

    // Warehouse Template & Import/Export
    getWarehouseSimTemplate: () => downloadFile('/warehouse-sims/template', 'warehouse_sims_template.xlsx'),
    importWarehouseSims: (file: File, branchId?: string) => {
        const formData = new FormData();
        formData.append('file', file);
        if (branchId) formData.append('branchId', branchId);
        return request<any>('/warehouse-sims/import', { method: 'POST', body: formData });
    },
    exportWarehouseSims: (branchId?: string) => {
        const query = branchId ? `?branchId=${branchId}` : '';
        return downloadFile(`/warehouse-sims/export${query}`, `warehouse_sims_export_${new Date().toISOString().split('T')[0]}.xlsx`);
    },
};
