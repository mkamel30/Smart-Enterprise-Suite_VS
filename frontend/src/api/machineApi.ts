
import { request, downloadFile } from './baseClient';

export const machineApi = {
    // Assets Definitions
    getMachineTemplate: () => downloadFile('/machines/template', 'machines_template.xlsx'),
    importMachines: (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        return request<any>('/machines/import', { method: 'POST', body: formData });
    },
    exportMachines: () => downloadFile('/machines/export', 'machines_export.xlsx'),

    // Warehouse Operations
    getWarehouseMachines: async (status?: string, branchId?: string): Promise<any> => {
        const params = new URLSearchParams();
        if (status) params.append('status', status);
        if (branchId) params.append('branchId', branchId);
        const query = params.toString() ? `?${params.toString()}` : '';
        const response = await request<any>(`/warehouse-machines${query}`);
        return response.data || response;
    },
    getWarehouseMachineCounts: (branchId?: string): Promise<Record<string, number>> => {
        const query = branchId ? `?branchId=${branchId}` : '';
        return request(`/warehouse-machines/counts${query}`);
    },
    addWarehouseMachine: (data: any): Promise<any> =>
        request('/warehouse-machines', { method: 'POST', body: JSON.stringify(data) }),
    updateWarehouseMachine: (id: string, data: any): Promise<any> =>
        request(`/warehouse-machines/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteWarehouseMachine: (id: string): Promise<any> =>
        request(`/warehouse-machines/${id}`, { method: 'DELETE' }),
    getWarehouseLogs: (branchId?: string): Promise<any[]> => {
        const query = branchId ? `?branchId=${branchId}` : '';
        return request(`/warehouse-machines/logs${query}`);
    },
    getMachineHistory: (serialNumber: string): Promise<any> =>
        request(`/machines/${serialNumber}/history`),
    exchangeWarehouseMachine: (data: any): Promise<any> =>
        request('/warehouse-machines/exchange', { method: 'POST', body: JSON.stringify(data) }),
    returnMachineToWarehouse: (data: any): Promise<any> =>
        request('/warehouse-machines/return', { method: 'POST', body: JSON.stringify(data) }),
    updateMachinesByPrefix: (prefix: string, data: { model: string; manufacturer: string }): Promise<any> =>
        request('/warehouse-machines/update-by-prefix', { method: 'PUT', body: JSON.stringify({ prefix, ...data }) }),
    getAvailableWarehouseMachines: async (branchId?: string): Promise<any[]> => {
        const query = branchId ? `&branchId=${branchId}` : '';
        const response = await request<any>(`/warehouse-machines?status=NEW&status=STANDBY${query}`);
        return response.data || response;
    },

    // Template & Import
    getWarehouseMachineTemplate: () => downloadFile('/warehouse-machines/template', 'warehouse_machines_template.xlsx'),
    exportWarehouseMachines: (status?: string, branchId?: string) => {
        const params = new URLSearchParams();
        if (status) params.append('status', status);
        if (branchId) params.append('branchId', branchId);
        const query = params.toString() ? `?${params.toString()}` : '';
        return downloadFile(`/warehouse-machines/export${query}`, `warehouse_machines_${status || 'all'}.xlsx`);
    },
    importWarehouseMachines: (machines: any[], branchId: string, performedBy: string): Promise<any> =>
        request('/warehouse-machines/import', {
            method: 'POST',
            body: JSON.stringify({ machines, branchId, performedBy })
        }),

    // Operations
    returnMachineToCustomer: (data: any): Promise<any> =>
        request('/warehouse-machines/return-to-customer', { method: 'POST', body: JSON.stringify(data) }),
    repairMachineToStandby: (data: any): Promise<any> =>
        request('/warehouse-machines/repair-to-standby', { method: 'POST', body: JSON.stringify(data) }),
    transitionMachineState: (id: string, targetStatus: string, notes?: string, payload?: any): Promise<any> =>
        request(`/machine-workflow/${id}/transition`, { method: 'POST', body: JSON.stringify({ targetStatus, notes, payload }) }),
};
