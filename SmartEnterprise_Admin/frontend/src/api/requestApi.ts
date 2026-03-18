
import { request, downloadFile } from './baseClient';
import type { MaintenanceRequest } from '../lib/types';

export const requestApi = {
    getRequests: async (params?: { branchId?: string; search?: string }): Promise<MaintenanceRequest[]> => {
        const queryParams = new URLSearchParams();
        if (params?.branchId) queryParams.append('branchId', params.branchId);
        if (params?.search) queryParams.append('search', params.search);
        queryParams.append('includeRelations', 'true');

        const response = await request<any>(`/requests?${queryParams.toString()}`);
        return response.data || response;
    },

    getRequest: (id: string) => {
        return request<MaintenanceRequest>(`/requests/${id}`);
    },

    createRequest: (data: any) => {
        return request<MaintenanceRequest>('/requests', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    assignTechnician: (id: string, technicianId: string) => {
        return request<any>(`/requests/${id}/assign`, {
            method: 'POST',
            body: JSON.stringify({ technicianId }),
        });
    },

    closeRequest: (id: string, data: any) => {
        return request<any>(`/requests/${id}/close`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    },

    deleteRequest: (id: string) => {
        return request<any>(`/requests/${id}`, {
            method: 'DELETE',
        });
    },

    getRequestStats: (branchId?: string): Promise<any> => {
        return request(`/requests/stats${branchId ? `?branchId=${branchId}` : ''}`);
    },

    exportRequests: (branchId?: string, search?: string): Promise<void> => {
        const query = new URLSearchParams();
        if (branchId) query.append('branchId', branchId);
        if (search) query.append('search', search);
        return downloadFile(`/requests/export?${query.toString()}`, `requests_${new Date().toISOString().slice(0, 10)}.xlsx`);
    }
};
