
import { request } from './baseClient';
import type { Technician } from '../lib/types';

export const userApi = {
    getUsers: async (params?: { branchId?: string }): Promise<any[]> => {
        const query = params?.branchId ? `?branchId=${params.branchId}` : '';
        const response = await request<any>(`/users${query}`);
        return response.data || response;
    },

    getTechnicians: (): Promise<Technician[]> => request('/technicians'),

    createUser: (data: any) => request('/users', { method: 'POST', body: JSON.stringify(data) }),

    updateUser: (id: string, data: any) => request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

    deleteUser: (id: string) => request(`/users/${id}`, { method: 'DELETE' }),

    resetUserPassword: (id: string, newPassword: string) =>
        request(`/users/${id}/reset-password`, { method: 'POST', body: JSON.stringify({ newPassword }) }),
};
