import { request } from './baseClient';

export const adminStoreApi = {
    // --- Item Type Management ---
    getItemTypes: (): Promise<any[]> => request('/admin-store/settings/types'),
    createItemType: (data: any) => request('/admin-store/settings/types', {
        method: 'POST',
        body: JSON.stringify(data)
    }),
    updateItemType: (id: string, data: any) => request(`/admin-store/settings/types/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    }),

    // --- Asset Management ---
    getAdminInventory: (params: any = {}): Promise<any[]> => {
        const query = new URLSearchParams();
        if (params.itemTypeCode) query.append('itemTypeCode', params.itemTypeCode);
        if (params.status) query.append('status', params.status);
        if (params.branchId) query.append('branchId', params.branchId);
        if (params.search) query.append('search', params.search);
        return request(`/admin-store/inventory?${query.toString()}`);
    },
    getAdminAssetHistory: (id: string): Promise<any[]> => request(`/admin-store/assets/${id}/history`),
    createAdminAssetManual: (data: any) => request('/admin-store/assets/manual', {
        method: 'POST',
        body: JSON.stringify(data)
    }),
    importAdminAssets: (assets: any[]) => request('/admin-store/assets/import', {
        method: 'POST',
        body: JSON.stringify({ assets })
    }),

    // --- Carton Management ---
    getAdminCartons: (params: any = {}): Promise<any[]> => {
        const query = new URLSearchParams();
        if (params.search) query.append('search', params.search);
        return request(`/admin-store/cartons?${query.toString()}`);
    },
    createAdminCarton: (data: any) => request('/admin-store/cartons', {
        method: 'POST',
        body: JSON.stringify(data)
    }),

    // --- Transfers ---
    transferAdminAsset: (data: { assetId: string, targetBranchId: string, notes?: string }) =>
        request('/admin-store/transfers/asset', {
            method: 'POST',
            body: JSON.stringify(data)
        }),
    transferAdminCarton: (data: { cartonId: string, targetBranchId: string, notes?: string }) =>
        request('/admin-store/transfers/carton', {
            method: 'POST',
            body: JSON.stringify(data)
        }),
    transferAdminStock: (data: { itemTypeCode: string, quantity: number, toBranchId: string, notes?: string }) =>
        request('/admin-store/transfers/stock', {
            method: 'POST',
            body: JSON.stringify(data)
        }),
    transferAdminBulk: (data: { assetIds?: string[], cartonCodes?: string[], targetBranchId: string, notes?: string }) =>
        request('/admin-store/transfers/bulk', {
            method: 'POST',
            body: JSON.stringify(data)
        }),

    // --- Stock Management ---
    getAdminStocks: (branchId?: string): Promise<any[]> => {
        const query = branchId ? `?branchId=${branchId}` : '';
        return request(`/admin-store/stocks${query}`);
    },
};
