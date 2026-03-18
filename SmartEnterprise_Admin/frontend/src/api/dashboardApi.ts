
import { request } from './baseClient';
import type { DashboardStats } from '../lib/types';

export const dashboardApi = {
    getDashboardStats: (params?: {
        branchId?: string;
        period?: 'month' | 'quarter' | 'year';
        month?: number;
        quarter?: number;
        year?: number;
    }): Promise<DashboardStats> => {
        const query = new URLSearchParams();
        if (params?.branchId) query.append('branchId', params.branchId);
        if (params?.period) query.append('period', params.period);
        if (params?.month !== undefined) query.append('month', params.month.toString());
        if (params?.quarter !== undefined) query.append('quarter', params.quarter.toString());
        if (params?.year !== undefined) query.append('year', params.year.toString());
        const queryStr = query.toString() ? `?${query.toString()}` : '';
        return request(`/dashboard${queryStr}`);
    },

    getInstallmentStats: (): Promise<any> => request('/sales/stats'),

    getExecutiveDashboard: (params?: { startDate?: string; endDate?: string; branchId?: string }): Promise<any> => {
        const query = new URLSearchParams();
        if (params?.startDate) query.append('startDate', params.startDate);
        if (params?.endDate) query.append('endDate', params.endDate);
        if (params?.branchId) query.append('branchId', params.branchId);
        const queryStr = query.toString() ? `?${query.toString()}` : '';
        return request(`/executive-dashboard${queryStr}`);
    },

    getExecutiveBranchDetail: (branchId: string): Promise<any> => request(`/executive-dashboard/branch/${branchId}`),

    getAdminSummary: (): Promise<any> => request('/dashboard/admin-summary'),

    getAdminAffairsSummary: (): Promise<any> => request('/dashboard/admin-affairs-summary'),

    globalSearch: (query: string): Promise<{ machines: any[]; customers: any[] }> =>
        request(`/dashboard/search?q=${encodeURIComponent(query)}`),
};
