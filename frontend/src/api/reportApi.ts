
import { request } from './baseClient';

export const reportApi = {
    getMovementsReport: (startDate?: string, endDate?: string, branchId?: string): Promise<any> => {
        const query = new URLSearchParams();
        if (startDate) query.append('startDate', startDate);
        if (endDate) query.append('endDate', endDate);
        if (branchId) query.append('branchId', branchId);
        return request(`/reports/movements?${query.toString()}`);
    },

    getPerformanceReport: (startDate?: string, endDate?: string, branchId?: string): Promise<any> => {
        const query = new URLSearchParams();
        if (startDate) query.append('startDate', startDate);
        if (endDate) query.append('endDate', endDate);
        if (branchId) query.append('branchId', branchId);
        return request(`/reports/performance?${query.toString()}`);
    },

    getExecutiveReport: (filters?: { startDate?: string; endDate?: string; branchId?: string }): Promise<any> => {
        const query = new URLSearchParams();
        if (filters?.startDate) query.append('startDate', filters.startDate);
        if (filters?.endDate) query.append('endDate', filters.endDate);
        if (filters?.branchId) query.append('branchId', filters.branchId);
        return request(`/reports/executive?${query.toString()}`);
    },

    getTechnicianConsumptionReport: (filters: { from?: string; to?: string; branchId?: string; page?: number; pageSize?: number }): Promise<any> => {
        const query = new URLSearchParams();
        if (filters.from) query.append('from', filters.from);
        if (filters.to) query.append('to', filters.to);
        if (filters.branchId) query.append('branchId', filters.branchId);
        if (filters.page) query.append('page', filters.page.toString());
        if (filters.pageSize) query.append('pageSize', filters.pageSize.toString());
        return request(`/reports/technician-consumption?${query.toString()}`);
    },

    getPosStock: (filters?: { branchId?: string }): Promise<any> => {
        const query = new URLSearchParams();
        if (filters?.branchId) query.append('branchId', filters.branchId);
        return request(`/reports/pos/stock?${query.toString()}`);
    },

    getPosSalesMonthly: (filters?: { from?: string; to?: string; branchId?: string }): Promise<any> => {
        const query = new URLSearchParams();
        if (filters?.from) query.append('from', filters.from);
        if (filters?.to) query.append('to', filters.to);
        if (filters?.branchId) query.append('branchId', filters.branchId);
        return request(`/reports/pos/sales/monthly?${query.toString()}`);
    },

    getPosSalesDaily: (filters?: { from?: string; to?: string; branchId?: string }): Promise<any> => {
        const query = new URLSearchParams();
        if (filters?.from) query.append('from', filters.from);
        if (filters?.to) query.append('to', filters.to);
        if (filters?.branchId) query.append('branchId', filters.branchId);
        return request(`/reports/pos/sales/daily?${query.toString()}`);
    },

    getMonthlyClosing: (month: string, branchId?: string): Promise<any> => {
        const query = new URLSearchParams({ month });
        if (branchId) query.append('branchId', branchId);
        return request(`/reports/monthly-closing?${query.toString()}`);
    }
};
