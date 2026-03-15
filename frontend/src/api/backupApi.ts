
import { request } from './baseClient';

export const backupApi = {
    createBackup: (): Promise<any> => request('/backup/create', { method: 'POST' }),
    listBackups: (): Promise<any[]> => request('/backup/list'),
    restoreBackup: (filename: string): Promise<any> => request(`/backup/restore/${filename}`, { method: 'POST' }),
    deleteBackup: (filename: string): Promise<any> => request(`/backup/delete/${filename}`, { method: 'DELETE' }),
    getLogs: (limit: number = 5): Promise<any[]> => request(`/backup/logs?limit=${limit}`),
    getAuditLogs: async (params: { entityType: string; entityId?: string }): Promise<any[]> => {
        const query = new URLSearchParams();
        query.append('entityType', params.entityType);
        if (params.entityId) query.append('entityId', params.entityId);
        const response = await request<any>(`/audit-logs?${query.toString()}`);
        return response.data || response;
    }
};
