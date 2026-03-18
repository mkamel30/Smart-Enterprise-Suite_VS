
import { request } from './baseClient';

export const permissionApi = {
    getPermissions: (): Promise<{
        pages: Record<string, Record<string, boolean>>;
        actions: Record<string, Record<string, boolean>>;
        roles: string[];
    }> => request('/permissions'),

    bulkUpdatePermissions: (permissions: Array<{
        role: string;
        permissionType: 'PAGE' | 'ACTION';
        permissionKey: string;
        isAllowed: boolean;
    }>) => request('/permissions/bulk', { method: 'POST', body: JSON.stringify({ permissions }) }),

    resetPermissions: () => request('/permissions/reset', { method: 'POST' }),

    checkPermission: (type: 'PAGE' | 'ACTION', key: string): Promise<{ allowed: boolean }> =>
        request(`/permissions/check?type=${type}&key=${encodeURIComponent(key)}`),
};
