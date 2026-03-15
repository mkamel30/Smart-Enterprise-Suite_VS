
import { request } from './baseClient';

export const notificationApi = {
    getNotifications: async (params?: { branchId?: string; userId?: string; unreadOnly?: boolean }): Promise<any[]> => {
        const query = new URLSearchParams();
        if (params?.branchId) query.append('branchId', params.branchId);
        if (params?.userId) query.append('userId', params.userId);
        if (params?.unreadOnly) query.append('unreadOnly', 'true');
        const queryStr = query.toString();
        const response = await request<any>(`/notifications${queryStr ? '?' + queryStr : ''}`);
        return response.data || response;
    },

    getNotificationCount: (params?: { branchId?: string; userId?: string }): Promise<{ count: number }> => {
        const query = new URLSearchParams();
        if (params?.branchId) query.append('branchId', params.branchId);
        if (params?.userId) query.append('userId', params.userId);
        const queryStr = query.toString();
        return request(`/notifications/count${queryStr ? '?' + queryStr : ''}`);
    },

    markNotificationRead: (id: string): Promise<any> => request(`/notifications/${id}/read`, { method: 'PUT' }),

    markAllNotificationsRead: (params?: { branchId?: string; userId?: string }): Promise<any> =>
        request('/notifications/read-all', {
            method: 'PUT',
            body: JSON.stringify(params || {})
        }),
};
