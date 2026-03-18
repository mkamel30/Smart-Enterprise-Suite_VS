import { request } from './baseClient';

export const systemApi = {
    checkForUpdates: () => request('/system/update/check'),
    applyUpdate: () => request('/system/update/apply', { method: 'POST' }),
    getSyncStatus: () => request('/system/sync/status'),
    triggerSync: () => request('/system/sync/request-sync', { method: 'POST' }),
};
