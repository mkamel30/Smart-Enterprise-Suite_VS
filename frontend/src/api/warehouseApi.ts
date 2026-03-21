
import { request, downloadFile } from './baseClient';
import type { SparePart } from '../lib/types';

export const warehouseApi = {
    // Spare Parts (MasterSparePart catalog from admin portal)
    getSpareParts: (params?: { page?: number; limit?: number; search?: string; model?: string }): Promise<any> => {
        const query = new URLSearchParams();
        if (params?.page) query.set('page', String(params.page));
        if (params?.limit) query.set('limit', String(params.limit));
        if (params?.search) query.set('search', params.search);
        if (params?.model) query.set('model', params.model);
        const qs = query.toString();
        return request(`/spare-parts${qs ? '?' + qs : ''}`);
    },
    createSparePart: (data: any) => request('/spare-parts', { method: 'POST', body: JSON.stringify(data) }),
    updateSparePart: (id: string, data: any) => request(`/spare-parts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteSparePart: (id: string) => request(`/spare-parts/${id}`, { method: 'DELETE' }),

    // External Repairs
    withdrawMachineForRepair: (data: {
        serialNumber: string;
        customerId: string;
        customerName?: string;
        requestId?: string;
        notes?: string;
    }): Promise<any> =>
        request('/warehouse-machines/external-repair/withdraw', { method: 'POST', body: JSON.stringify(data) }),
    getExternalRepairMachines: (status?: string): Promise<any> => {
        const query = status ? `?status=${status}` : '';
        return request(`/warehouse-machines/external-repair${query}`);
    },
    markMachineReadyForPickup: (id: string): Promise<any> =>
        request(`/warehouse-machines/external-repair/${id}/ready`, { method: 'PUT' }),
    deliverMachineToCustomer: (id: string): Promise<any> =>
        request(`/warehouse-machines/external-repair/${id}/deliver`, { method: 'POST' }),
    getReadyForPickupCount: (): Promise<{ count: number }> => request('/warehouse-machines/external-repair/ready-count'),

    // Bulk Operations
    bulkTransferMachines: (data: {
        serialNumbers: string[];
        toBranchId: string;
        waybillNumber?: string;
        notes?: string;
        performedBy?: string;
    }): Promise<any> =>
        request('/warehouse-machines/bulk-transfer', { method: 'POST', body: JSON.stringify(data) }),

    // Templates & Import/Export
    downloadTemplate: () => {
        return request('/spare-parts/template/download', { method: 'GET' });
    },
    importSpareParts: (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        return request<any>('/spare-parts/import', {
            method: 'POST',
            body: formData
        });
    },
    exportSpareParts: () => {
        return downloadFile('/spare-parts/export', `spare_parts_${new Date().toISOString().split('T')[0]}.xlsx`);
    }
};
