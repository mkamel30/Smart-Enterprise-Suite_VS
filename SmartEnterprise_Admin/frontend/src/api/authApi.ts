
import { request } from './baseClient';

export const authApi = {
    login: (credentials: { email?: string; userId?: string; password?: string; branchId?: string; mfaToken?: string }) => {
        return request<any>('/auth/login', {
            method: 'POST',
            body: JSON.stringify(credentials),
        });
    },

    logout: () => {
        return request<any>('/auth/logout', {
            method: 'POST'
        });
    },

    changePassword: (data: any) => {
        return request<any>('/auth/change-password', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    updatePreferences: (data: { theme?: string; fontFamily?: string; themeVariant?: 'glass' | 'solid' }) => {
        return request<any>('/auth/preferences', {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },

    getMFAStatus: () => {
        return request<any>('/mfa/status');
    },

    setupMFA: () => {
        return request<any>('/mfa/setup', {
            method: 'POST'
        });
    },

    verifyMFASetup: (token: string) => {
        return request<any>('/mfa/verify-setup', {
            method: 'POST',
            body: JSON.stringify({ token })
        });
    },

    disableMFA: (token: string) => {
        return request<any>('/mfa/disable', {
            method: 'POST',
            body: JSON.stringify({ token })
        });
    },

    verifyMFALogin: (userId: string, token: string) => {
        return request<any>('/mfa/verify', {
            method: 'POST',
            body: JSON.stringify({ userId, token })
        });
    },

    generateMFARecoveryCodes: (token: string) => {
        return request<any>('/mfa/recovery-codes', {
            method: 'POST',
            body: JSON.stringify({ token })
        });
    },

    verifyMFARecovery: (userId: string, code: string) => {
        return request<any>('/mfa/verify-recovery', {
            method: 'POST',
            body: JSON.stringify({ userId, code })
        });
    }
};
