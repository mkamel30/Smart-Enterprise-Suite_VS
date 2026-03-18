
import { request } from './baseClient';
import type { MachineParameter, ClientType } from '../lib/types';

export const settingsApi = {
    // Machine Parameters
    getMachineParameters: (): Promise<MachineParameter[]> => request('/pos-parameters'),
    createMachineParameter: (data: any) => request('/pos-parameters', { method: 'POST', body: JSON.stringify(data) }),
    deleteMachineParameter: (id: string) => request(`/pos-parameters/${id}`, { method: 'DELETE' }),
    applyMachineParameters: () => request('/pos-parameters/broadcast', { method: 'POST' }),
    forceUpdateMachineModels: () => request('/pos-parameters/broadcast', { method: 'POST' }),
    broadcastMachineParameters: () => request('/pos-parameters/broadcast', { method: 'POST' }),

    // Global Parameters
    getGlobalParameters: () => request('/parameters'),
    updateGlobalParameter: (id: string, data: any) => request(`/parameters/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    broadcastGlobalParameters: () => request('/parameters/broadcast', { method: 'POST' }),

    // Master Spare Parts
    getSpareParts: (): Promise<any[]> => request('/spare-parts'),
    createSparePart: (data: any) => request('/spare-parts', { method: 'POST', body: JSON.stringify(data) }),
    updateSparePart: (id: string, data: any) => request(`/spare-parts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteSparePart: (id: string) => request(`/spare-parts/${id}`, { method: 'DELETE' }),
    broadcastSpareParts: () => request('/spare-parts/broadcast', { method: 'POST' }),

    // Client Types
    getClientTypes: (): Promise<ClientType[]> => request('/settings/client-types'),
    createClientType: (data: any) => request('/settings/client-types', { method: 'POST', body: JSON.stringify(data) }),
    updateClientType: (id: string, data: any) => request(`/settings/client-types/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteClientType: (id: string) => request(`/settings/client-types/${id}`, { method: 'DELETE' }),
};
