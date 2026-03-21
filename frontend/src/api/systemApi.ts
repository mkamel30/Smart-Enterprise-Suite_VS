import { request } from './baseClient';

export const systemApi = {
    checkForUpdates: () => request('/system/update/check'),
    applyUpdate: () => request('/system/update/apply', { method: 'POST' }),
    getSyncStatus: () => request('/system/sync/status'),
    triggerSync: () => request('/system/sync/request-sync', { method: 'POST' }),
    getSyncLogs: (params?: { limit?: number; offset?: number; type?: string }) => {
        const query = new URLSearchParams();
        if (params?.limit) query.set('limit', String(params.limit));
        if (params?.offset) query.set('offset', String(params.offset));
        if (params?.type) query.set('type', params.type);
        const qs = query.toString();
        return request(`/system/sync/logs${qs ? '?' + qs : ''}`);
    },
};
