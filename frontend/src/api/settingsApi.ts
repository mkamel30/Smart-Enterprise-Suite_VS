
import { request } from './baseClient';
import type { MachineParameter, ClientType } from '../lib/types';

export const settingsApi = {
    // Machine Parameters
    getMachineParameters: (): Promise<MachineParameter[]> => request('/machine-parameters'),
    createMachineParameter: (data: any) => request('/machine-parameters', { method: 'POST', body: JSON.stringify(data) }),
    updateMachineParameter: (id: string, data: any) => request(`/machine-parameters/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteMachineParameter: (id: string) => request(`/machine-parameters/${id}`, { method: 'DELETE' }),
    applyMachineParameters: () => request('/machines/apply-parameters', { method: 'POST' }),
    forceUpdateMachineModels: () => request('/force-update-models', { method: 'POST' }),

    // Client Types
    getClientTypes: (): Promise<ClientType[]> => request('/settings/client-types'),
    createClientType: (data: any) => request('/settings/client-types', { method: 'POST', body: JSON.stringify(data) }),
    updateClientType: (id: string, data: any) => request(`/settings/client-types/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteClientType: (id: string) => request(`/settings/client-types/${id}`, { method: 'DELETE' }),
};
