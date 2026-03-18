
import { request } from './baseClient';

export const branchApi = {
    getBranches: async (): Promise<any[]> => {
        const response = await request<any>('/branches');
        return response.data || response;
    },
    getActiveBranches: (): Promise<any[]> => request('/branches/active'),
    getBranch: (id: string): Promise<any> => request(`/branches/${id}`),
    createBranch: (data: { code: string; name: string; address?: string }): Promise<any> =>
        request('/branches', { method: 'POST', body: JSON.stringify(data) }),
    updateBranch: (id: string, data: { code?: string; name?: string; address?: string; isActive?: boolean }): Promise<any> =>
        request(`/branches/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteBranch: (id: string): Promise<any> => request(`/branches/${id}`, { method: 'DELETE' }),
    getBranchesByType: (type: string): Promise<any[]> => request(`/branches/type/${type}`),
    getMaintenanceCenters: (): Promise<any[]> => request('/branches/centers/with-branches'),
    getCenterBranches: (centerId: string): Promise<any[]> => request(`/branches/center/${centerId}/branches`),
    getBranchesLookup: (): Promise<any[]> => request('/branches-lookup'),
    getAuthorizedBranches: (): Promise<any[]> => request('/branches/authorized'),
    getSystemHwid: (): Promise<{ hwid: string }> => request('/branches/system-info/hwid'),
};
