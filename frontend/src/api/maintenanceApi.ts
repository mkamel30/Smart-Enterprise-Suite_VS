
import { request } from './baseClient';

export const maintenanceApi = {
    // Approvals
    getApprovalByRequest: (requestId: string): Promise<any> => request(`/approvals/request/${requestId}`),
    createApproval: (data: { requestId: string; cost: number; parts: any[]; notes?: string }): Promise<any> =>
        request('/approvals', { method: 'POST', body: JSON.stringify(data) }),
    respondToApproval: (id: string, data: { status: 'APPROVED' | 'REJECTED'; responseNotes?: string }): Promise<any> =>
        request(`/approvals/${id}/respond`, { method: 'PUT', body: JSON.stringify(data) }),
    getApprovalStats: (params?: {
        branchId?: string;
        period?: 'month' | 'quarter' | 'year';
        month?: number;
        quarter?: number;
        year?: number;
    }): Promise<any> => {
        const query = new URLSearchParams();
        if (params?.branchId) query.append('branchId', params.branchId);
        if (params?.period) query.append('period', params.period);
        if (params?.month !== undefined) query.append('month', params.month.toString());
        if (params?.quarter !== undefined) query.append('quarter', params.quarter.toString());
        if (params?.year !== undefined) query.append('year', params.year.toString());
        const queryStr = query.toString() ? `?${query.toString()}` : '';
        return request(`/maintenance-approvals/stats${queryStr}`);
    },

    // Maintenance Center
    getMaintenanceCenterMachines: (params?: {
        status?: string;
        technicianId?: string;
        branchId?: string;
        search?: string;
    }): Promise<any[]> => {
        const query = new URLSearchParams();
        if (params?.status) query.append('status', params.status);
        if (params?.technicianId) query.append('technicianId', params.technicianId);
        if (params?.branchId) query.append('branchId', params.branchId);
        if (params?.search) query.append('search', params.search);
        const queryStr = query.toString() ? `?${query.toString()}` : '';
        return request(`/maintenance-center/machines${queryStr}`).then((res: any) => res.data || res);
    },
    getMaintenanceCenterMachine: (id: string): Promise<any> =>
        request(`/maintenance-center/machines/${id}`).then((res: any) => res.data || res),
    getMaintenanceCenterMachineBySerial: (serial: string): Promise<any> =>
        request(`/maintenance-center/machines/by-serial/${serial}`).then((res: any) => res.data || res),
    assignTechnicianToMachine: (id: string, data: {
        technicianId: string;
        technicianName?: string;
        notes?: string;
    }): Promise<any> =>
        request(`/maintenance-center/machines/${id}/assign`, { method: 'POST', body: JSON.stringify(data) }),
    inspectMachine: (id: string, data: {
        problemDescription: string;
        estimatedCost: number;
        requiredParts?: Array<{ partId: string; quantity: number }>;
        notes?: string;
    }): Promise<any> =>
        request(`/maintenance-center/machines/${id}/inspect`, { method: 'POST', body: JSON.stringify(data) }),
    startRepair: (id: string, data: {
        repairType: 'FREE_NO_PARTS' | 'FREE_WITH_PARTS' | 'PAID_WITH_PARTS';
        parts?: Array<{ partId: string; name: string; quantity: number; cost: number }>;
        cost: number;
    }): Promise<any> =>
        request(`/maintenance-center/machines/${id}/repair`, { method: 'POST', body: JSON.stringify(data) }),
    requestRepairApproval: (id: string, data: {
        cost: number;
        parts: Array<{ partId: string; partName: string; quantity: number; cost: number }>;
        reason: string;
        notes?: string;
    }): Promise<any> =>
        request(`/maintenance-center/machines/${id}/request-approval`, { method: 'POST', body: JSON.stringify(data) }),
    markMachineRepaired: (id: string, data?: {
        repairNotes?: string;
        actionTaken?: string;
    }): Promise<any> =>
        request(`/maintenance-center/machines/${id}/mark-repaired`, { method: 'POST', body: JSON.stringify(data || {}) }),
    markMachineTotalLoss: (id: string, data?: {
        reason: string;
        notes?: string;
    }): Promise<any> =>
        request(`/maintenance-center/machines/${id}/mark-total-loss`, { method: 'POST', body: JSON.stringify(data || {}) }),
    returnMachineToBranch: (id: string, data?: {
        returnNotes?: string;
        waybillNumber?: string;
    }): Promise<any> =>
        request(`/maintenance-center/machines/${id}/return`, { method: 'POST', body: JSON.stringify(data || {}) }),
    getMaintenanceCenterStats: (): Promise<any> => request('/maintenance-center/stats'),
    getPendingApprovals: (): Promise<any[]> =>
        request('/maintenance-center/pending-approvals').then((res: any) => res.data || res),
    getBranchMachinesAtCenter: (branchId: string): Promise<any[]> =>
        request(`/maintenance-center/branch-machines/${branchId}`).then((res: any) => res.data || res),
    getBranchMachinesSummary: (branchId: string): Promise<any> => request(`/maintenance-center/branch-machines/${branchId}/summary`),
    getMachineStatusHistory: (id: string): Promise<any[]> =>
        request(`/maintenance-center/machines/${id}/history`).then((res: any) => res.data || res),
    getMachinesReadyForReturn: (params?: { page?: number; limit?: number; search?: string }): Promise<any[]> => {
        const query = new URLSearchParams();
        if (params?.page) query.append('page', params.page.toString());
        if (params?.limit) query.append('limit', params.limit.toString());
        if (params?.search) query.append('search', params.search);
        const queryStr = query.toString() ? `?${query.toString()}` : '';
        return request(`/maintenance-center/return/ready${queryStr}`).then((res: any) => res.data || res);
    },
    createReturnPackage: (data: {
        machineIds: string[];
        notes?: string;
        driverName?: string;
        driverPhone?: string;
    }): Promise<any> =>
        request('/maintenance-center/return/create', { method: 'POST', body: JSON.stringify(data) }),
    receiveShipment: (id: string): Promise<any> =>
        request(`/maintenance/shipments/${id}/receive`, { method: 'POST' }),
    getShipments: (params?: any): Promise<any[]> => {
        const query = new URLSearchParams();
        if (params?.status) query.append('status', params.status);
        return request(`/maintenance/shipments?${query.toString()}`);
    }
};
