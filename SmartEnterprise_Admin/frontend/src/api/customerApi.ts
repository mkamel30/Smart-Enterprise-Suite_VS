
import { request, downloadFile } from './baseClient';
import type { Customer } from '../lib/types';

export const customerApi = {
    getCustomers: (params?: { branchId?: string }): Promise<Customer[]> => {
        const query = params?.branchId ? `?branchId=${params.branchId}` : '';
        return request(`/customers${query}`);
    },

    getCustomersLite: (search?: string) => {
        const query = search ? `?search=${encodeURIComponent(search)}` : '';
        return request<any[]>(`/customers/lite${query}`);
    },

    getCustomer: (id: string) => {
        return request<Customer>(`/customers/${id}`);
    },

    createCustomer: (data: any) => {
        return request<Customer>('/customers', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    updateCustomer: (id: string, data: any) => {
        return request<Customer>(`/customers/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    },

    deleteCustomer: (id: string) => {
        return request<any>(`/customers/${id}`, {
            method: 'DELETE',
        });
    },

    getCustomerMachines: (id: string) => {
        return request<any[]>(`/customers/${id}/machines`);
    },

    getCustomerSimCards: (customerId: string): Promise<any[]> => {
        return request(`/customers/${customerId}/simcards`);
    },

    getCustomerSimHistory: (customerId: string): Promise<any[]> => {
        return request(`/customers/${customerId}/sim-history`);
    },

    getCustomerTemplate: () => {
        return downloadFile('/customers/template/download', 'customers_import.xlsx');
    },

    importCustomers: (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        return request<any>('/customers/import', {
            method: 'POST',
            body: formData,
        });
    },

    exportCustomers: () => {
        return downloadFile('/customers/export', 'customers_export.xlsx');
    }
};
