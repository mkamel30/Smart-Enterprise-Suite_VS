import type {
    Customer,
    MaintenanceRequest,
    Technician,
    SparePart,
    MachineParameter,
    ClientType,
    DashboardStats,
    Payment,
    PaymentStats
} from '../lib/types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

class ApiClient {
    private baseUrl: string;
    private token: string | null = null;

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl;
    }

    setToken(token: string | null) {
        this.token = token;
    }

    private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
        const headers: any = {
            ...(options?.headers || {}),
        };

        if (options?.body instanceof FormData) {
            // Let the browser set Content-Type with boundary for FormData
            delete headers['Content-Type'];
        } else if (!headers['Content-Type']) {
            headers['Content-Type'] = 'application/json';
        }

        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            ...options,
            headers,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `API Error: ${response.statusText}`);
        }

        return response.json();
    }

    // Generic helpers for flexible usage
    public async get<T>(endpoint: string): Promise<T> {
        return this.request<T>(endpoint);
    }

    public async post<T>(endpoint: string, data?: any): Promise<T> {
        return this.request<T>(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    // Auth
    async login(credentials: { email?: string; userId?: string; password?: string; branchId?: string }) {
        return this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify(credentials),
        });
    }

    async changePassword(data: any) {
        return this.request('/auth/change-password', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    // Customers
    async getCustomers(params?: { branchId?: string }): Promise<Customer[]> {
        const query = params?.branchId ? `?branchId=${params.branchId}` : '';
        return this.request(`/customers${query}`);
    }

    async getCustomersLite() {
        return this.request('/customers/lite');
    }

    // Inventory
    async getInventory(params?: { branchId?: string }): Promise<any[]> {
        const query = params?.branchId ? `?branchId=${params.branchId}` : '';
        return this.request(`/inventory${query}`);
    }

    async getStockMovements(params?: { branchId?: string }): Promise<any[]> {
        const query = params?.branchId ? `?branchId=${params.branchId}` : '';
        return this.request(`/inventory/movements${query}`);
    }

    async updateInventory(id: string, quantity: number) {
        return this.request(`/inventory/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ quantity })
        });
    }

    async importInventory(items: any[], branchId?: string) {
        return this.request('/inventory/import', {
            method: 'POST',
            body: JSON.stringify({ items, branchId })
        });
    }

    async getCustomer(id: string) {
        return this.request(`/customers/${id}`);
    }

    async getCustomerTemplate() {

        const headers: any = {};
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }


        const response = await fetch(`${this.baseUrl}/customers/template/download`, {
            method: 'GET',
            headers
        });



        if (!response.ok) throw new Error('Failed to download template: ' + response.statusText);

        const blob = await response.blob();


        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'customers_import.xlsx';
        document.body.appendChild(a);
        a.click();
        a.remove();

    }

    async importCustomers(file: File) {
        const formData = new FormData();
        formData.append('file', file);

        const headers: any = {};
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        const response = await fetch(`${this.baseUrl}/customers/import`, {
            method: 'POST',
            body: formData,
            headers
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Import failed');
        }

        return response.json();
    }

    async createCustomer(data: any) {
        return this.request('/customers', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async updateCustomer(id: string, data: any) {
        return this.request(`/customers/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    async deleteCustomer(id: string) {
        return this.request(`/customers/${id}`, {
            method: 'DELETE',
        });
    }

    async getCustomerMachines(id: string) {
        return this.request(`/customers/${id}/machines`);
    }



    // Requests
    async getRequests(params?: { branchId?: string }): Promise<MaintenanceRequest[]> {
        const query = params?.branchId ? `?branchId=${params.branchId}` : '';
        return this.request(`/requests${query}`);
    }

    async getRequest(id: string) {
        return this.request(`/requests/${id}`);
    }

    async createRequest(data: any) {
        return this.request('/requests', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async assignTechnician(id: string, technicianId: string) {
        return this.request(`/requests/${id}/assign`, {
            method: 'PUT',
            body: JSON.stringify({ technicianId }),
        });
    }

    async closeRequest(id: string, data: any) {
        return this.request(`/requests/${id}/close`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    async deleteRequest(id: string) {
        return this.request(`/requests/${id}`, {
            method: 'DELETE',
        });
    }

    // Users/Technicians
    async getUsers(params?: { branchId?: string }): Promise<any[]> {
        const query = params?.branchId ? `?branchId=${params.branchId}` : '';
        return this.request(`/users${query}`);
    }

    async getTechnicians(): Promise<Technician[]> {
        return this.request('/technicians');
    }

    async createUser(data: any) {
        return this.request('/users', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async updateUser(id: string, data: any) {
        return this.request(`/users/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    async deleteUser(id: string) {
        return this.request(`/users/${id}`, {
            method: 'DELETE',
        });
    }

    async resetUserPassword(id: string, newPassword: string) {
        return this.request(`/users/${id}/reset-password`, {
            method: 'POST',
            body: JSON.stringify({ newPassword }),
        });
    }

    // Settings
    async getBranchesLookup() {
        return this.request<any[]>('/branches-lookup');
    }

    async getMachineParameters(): Promise<MachineParameter[]> {
        return this.request('/machine-parameters');
    }

    async createMachineParameter(data: any) {
        return this.request('/machine-parameters', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async deleteMachineParameter(id: string) {
        return this.request(`/machine-parameters/${id}`, {
            method: 'DELETE',
        });
    }

    // Client Types
    async getClientTypes(): Promise<ClientType[]> {
        return this.request('/settings/client-types');
    }

    async createClientType(data: any) {
        return this.request('/settings/client-types', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async updateClientType(id: string, data: any) {
        return this.request(`/settings/client-types/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    async deleteClientType(id: string) {
        return this.request(`/settings/client-types/${id}`, {
            method: 'DELETE',
        });
    }

    async forceUpdateMachineModels() {
        return this.request('/force-update-models', {
            method: 'POST',
        });
    }

    // Warehouse
    async getSpareParts(): Promise<SparePart[]> {
        return this.request('/spare-parts');
    }

    async createSparePart(data: any) {
        return this.request('/spare-parts', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async updateSparePart(id: string, data: any) {
        return this.request(`/spare-parts/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    async deleteSparePart(id: string) {
        return this.request(`/spare-parts/${id}`, {
            method: 'DELETE',
        });
    }



    // Payments
    async getPayments(): Promise<Payment[]> {
        return this.request('/payments');
    }

    async getPaymentStats(): Promise<PaymentStats> {
        return this.request('/payments/stats');
    }

    async createPayment(data: any) {
        return this.request('/payments', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async deletePayment(id: string) {
        return this.request(`/payments/${id}`, {
            method: 'DELETE',
        });
    }

    async checkReceipt(number: string): Promise<{ exists: boolean }> {
        return this.request(`/payments/check-receipt?number=${encodeURIComponent(number)}`);
    }


    async getMonthlyRepairCount(serialNumber: string, date?: string): Promise<{ count: number }> {
        const url = `/requests/machine/${serialNumber}/monthly-count${date ? `?date=${encodeURIComponent(date)}` : ''}`;
        return this.request(url);
    }
    async getInventoryReport(params?: { branchId?: string }) {
        const query = params?.branchId ? `?branchId=${params.branchId}` : '';
        return this.request(`/reports/inventory${query}`);
    }

    async getMovementsReport(startDate?: string, endDate?: string, branchId?: string): Promise<any> {
        const query = new URLSearchParams();
        if (startDate) query.append('startDate', startDate);
        if (endDate) query.append('endDate', endDate);
        if (branchId) query.append('branchId', branchId);
        return this.request(`/reports/movements?${query.toString()}`);
    }

    async getPerformanceReport(startDate?: string, endDate?: string, branchId?: string): Promise<any> {
        const query = new URLSearchParams();
        if (startDate) query.append('startDate', startDate);
        if (endDate) query.append('endDate', endDate);
        if (branchId) query.append('branchId', branchId);
        return this.request(`/reports/performance?${query.toString()}`);
    }

    async getExecutiveReport(filters?: { startDate?: string; endDate?: string; branchId?: string }): Promise<any> {
        const query = new URLSearchParams();
        if (filters?.startDate) query.append('startDate', filters.startDate);
        if (filters?.endDate) query.append('endDate', filters.endDate);
        if (filters?.branchId) query.append('branchId', filters.branchId);
        return this.request(`/reports/executive?${query.toString()}`);
    }

    // Warehouse Machines
    async getWarehouseMachines(status?: string, branchId?: string): Promise<any> {
        const params = new URLSearchParams();
        if (status) params.append('status', status);
        if (branchId) params.append('branchId', branchId);
        const query = params.toString() ? `?${params.toString()}` : '';
        return this.request(`/warehouse-machines${query}`);
    }

    async getWarehouseMachineCounts(branchId?: string): Promise<Record<string, number>> {
        const query = branchId ? `?branchId=${branchId}` : '';
        return this.request(`/warehouse-machines/counts${query}`);
    }
    async transferInventory(data: {
        partId: string;
        quantity: number;
        fromBranchId: string;
        toBranchId: string;
        reason?: string;
    }): Promise<any> {
        return this.request('/inventory/transfer', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    // GET warehouse machine logs
    async getWarehouseLogs(branchId?: string): Promise<any[]> {
        const query = branchId ? `?branchId=${branchId}` : '';
        return this.request(`/warehouse-machines/logs${query}`);
    }

    // GET machine history (all activities for a specific machine)
    async getMachineHistory(serialNumber: string): Promise<any[]> {
        return this.request(`/machines/${serialNumber}/history`);
    }

    async addWarehouseMachine(data: any): Promise<any> {
        return this.request('/warehouse-machines', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async updateWarehouseMachine(id: string, data: any): Promise<any> {
        return this.request(`/warehouse-machines/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    async deleteWarehouseMachine(id: string): Promise<any> {
        return this.request(`/warehouse-machines/${id}`, {
            method: 'DELETE'
        });
    }



    async exchangeWarehouseMachine(data: any): Promise<any> {
        return this.request('/warehouse-machines/exchange', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async returnMachineToWarehouse(data: any): Promise<any> {
        return this.request('/warehouse-machines/return', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async updateMachinesByPrefix(prefix: string, data: { model: string; manufacturer: string }): Promise<any> {
        return this.request('/warehouse-machines/update-by-prefix', {
            method: 'PUT',
            body: JSON.stringify({ prefix, ...data })
        });
    }

    // Sales
    async createSale(data: any): Promise<any> {
        return this.request('/sales', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async getSales(): Promise<any> {
        return this.request('/sales');
    }

    async getInstallments(overdue: boolean = false): Promise<any> {
        return this.request(`/sales/installments?overdue=${overdue}`);
    }

    async deleteSale(id: string): Promise<any> {
        return this.request(`/sales/${id}`, {
            method: 'DELETE'
        });
    }

    async payInstallment(id: string): Promise<any> {
        return this.request(`/sales/installments/${id}/pay`, { method: 'POST' });
    }

    async payInstallmentWithDetails(id: string, amount: number, receiptNumber: string, paymentPlace: string): Promise<any> {
        return this.request(`/sales/installments/${id}/pay`, {
            method: 'POST',
            body: JSON.stringify({ amount, receiptNumber, paymentPlace })
        });
    }

    async recalculateInstallments(saleId: string, newCount: number): Promise<any> {
        return this.request(`/sales/${saleId}/recalculate`, {
            method: 'PUT',
            body: JSON.stringify({ newCount })
        });
    }

    // Dashboard
    async getDashboardStats(params?: { branchId?: string }): Promise<DashboardStats> {
        const query = params?.branchId ? `?branchId=${params.branchId}` : '';
        return this.request(`/dashboard${query}`);
    }

    // Executive Dashboard (High Management)
    async getExecutiveDashboard(params?: { startDate?: string; endDate?: string; branchId?: string }): Promise<any> {
        const query = new URLSearchParams();
        if (params?.startDate) query.append('startDate', params.startDate);
        if (params?.endDate) query.append('endDate', params.endDate);
        if (params?.branchId) query.append('branchId', params.branchId);
        const queryStr = query.toString() ? `?${query.toString()}` : '';
        return this.request(`/executive-dashboard${queryStr}`);
    }

    async getExecutiveBranchDetail(branchId: string): Promise<any> {
        return this.request(`/executive-dashboard/branch/${branchId}`);
    }


    async getAiModels(): Promise<string[]> {
        return this.request('/ai/models');
    }

    async askAi(prompt: string, model?: string): Promise<{ answer: string }> {
        return this.request('/ai/query', {
            method: 'POST',
            body: JSON.stringify({ prompt, model })
        });
    }

    // Backup
    async createBackup(): Promise<any> {
        return this.request('/backup/create', { method: 'POST' });
    }

    async listBackups(): Promise<any[]> {
        return this.request('/backup/list');
    }

    async restoreBackup(filename: string): Promise<any> {
        return this.request(`/backup/restore/${filename}`, { method: 'POST' });
    }

    async deleteBackup(filename: string): Promise<any> {
        return this.request(`/backup/delete/${filename}`, { method: 'DELETE' });
    }

    // SimCards
    async getSimCardTemplate(): Promise<Blob> {
        const headers: any = {};
        if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
        const response = await fetch(`${this.baseUrl}/simcards/template`, { headers });
        return response.blob();
    }

    async importSimCards(file: File): Promise<any> {
        const formData = new FormData();
        formData.append('file', file);

        const headers: any = {};
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        const response = await fetch(`${this.baseUrl}/simcards/import`, {
            method: 'POST',
            body: formData,
            headers
        });

        if (!response.ok) {
            throw new Error('Import failed');
        }

        return response.json();
    }

    async exportSimCards(): Promise<Blob> {
        const headers: any = {};
        if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
        const response = await fetch(`${this.baseUrl}/simcards/export`, { headers });
        return response.blob();
    }

    async getAllSimCards(): Promise<any[]> {
        return this.request('/simcards');
    }

    // Machines
    async getMachineTemplate(): Promise<Blob> {
        const headers: any = {};
        if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
        const response = await fetch(`${this.baseUrl}/machines/template`, { headers });
        return response.blob();
    }

    async importMachines(file: File): Promise<any> {
        const formData = new FormData();
        formData.append('file', file);

        const headers: any = {};
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        const response = await fetch(`${this.baseUrl}/machines/import`, {
            method: 'POST',
            body: formData,
            headers
        });

        if (!response.ok) {
            throw new Error('Import failed');
        }

        return response.json();
    }

    async exportMachines(): Promise<Blob> {
        const headers: any = {};
        if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
        const response = await fetch(`${this.baseUrl}/machines/export`, { headers });
        return response.blob();
    }

    async getWarehouseMachineTemplate(): Promise<Blob> {
        const headers: any = {};
        if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
        const response = await fetch(`${this.baseUrl}/warehouse-machines/template`, { headers });
        return response.blob();
    }

    async importWarehouseMachines(machines: any[], branchId: string, performedBy: string): Promise<any> {
        return this.request('/warehouse-machines/import', {
            method: 'POST',
            body: JSON.stringify({
                machines,
                branchId,
                performedBy
            })
        });
    }



    async applyMachineParameters(): Promise<any> {
        return this.request('/machines/apply-parameters', { method: 'POST' });
    }

    // Warehouse Machine Operations
    async returnMachineToCustomer(data: {
        machineId: string;
        customerId: string;
        notes?: string;
        performedBy?: string;
    }): Promise<any> {
        return this.request('/warehouse-machines/return-to-customer', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async repairMachineToStandby(data: {
        machineId: string;
        notes?: string;
        performedBy?: string;
    }): Promise<any> {
        return this.request('/warehouse-machines/repair-to-standby', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    // ===================== WAREHOUSE SIMS =====================
    async getWarehouseSims(branchId?: string): Promise<any[]> {
        const query = branchId ? `?branchId=${branchId}` : '';
        return this.request(`/warehouse-sims${query}`);
    }

    async getWarehouseSimCounts(branchId?: string): Promise<any> {
        const query = branchId ? `?branchId=${branchId}` : '';
        return this.request(`/warehouse-sims/counts${query}`);
    }

    async createWarehouseSim(data: { serialNumber: string; type?: string; status?: string; notes?: string }): Promise<any> {
        return this.request('/warehouse-sims', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async updateWarehouseSim(id: string, data: any): Promise<any> {
        return this.request(`/warehouse-sims/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    async deleteWarehouseSim(id: string): Promise<any> {
        return this.request(`/warehouse-sims/${id}`, {
            method: 'DELETE'
        });
    }

    async getWarehouseSimTemplate(): Promise<Blob> {
        const headers: any = {
            'Authorization': `Bearer ${this.token}`
        };
        const response = await fetch(`${this.baseUrl}/warehouse-sims/template`, { headers });
        return response.blob();
    }

    async importWarehouseSims(file: File, branchId?: string): Promise<any> {
        const formData = new FormData();
        formData.append('file', file);
        if (branchId) {
            formData.append('branchId', branchId);
        }

        const headers: any = {};
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        const response = await fetch(`${this.baseUrl}/warehouse-sims/import`, {
            method: 'POST',
            body: formData,
            headers
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Import failed');
        }

        return response.json();
    }

    async exportWarehouseSims(): Promise<Blob> {
        const headers: any = {
            'Authorization': `Bearer ${this.token}`
        };
        const response = await fetch(`${this.baseUrl}/warehouse-sims/export`, { headers });
        return response.blob();
    }

    async transferWarehouseSims(data: { simIds: string[]; targetBranchId: string; notes?: string }): Promise<any> {
        return this.request('/warehouse-sims/transfer', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    // New Helpers for Transfer Orders
    async getAvailableWarehouseMachines(branchId?: string): Promise<any[]> {
        const query = branchId ? `&branchId=${branchId}` : '';
        // Status: NEW = New machines, STANDBY = Repaired/Ready machines
        return this.request(`/warehouse-machines?status=NEW&status=STANDBY${query}`).then(res => {
            // Backend might filter by one status if passed multiple times in query string depending on array handling
            // Let's rely on backend filtering logic or client side.
            // Based on my review of warehouse-machines.js, it takes `status` query param.
            // If I want multiple statues, I might need to update backend to support comma separated or array?
            // Line 25 in warehouse-machines.js: whereClause.status = status;
            // It doesn't seem to split by comma. 
            // Let's fetch all and filter client side OR fetch twice?
            // Or better: update backend to support comma separated (it supports it for CLIENT_REPAIR group).
            // Actually, let's just fetch all machines for the branch and filter on client side for now to be safe, 
            // OR send no status and filter client side.
            return this.request(`/warehouse-machines?${query ? query.substring(1) : ''}`);
        });
    }

    async getAvailableWarehouseSims(branchId?: string): Promise<any[]> {
        const query = branchId ? `?branchId=${branchId}&status=ACTIVE` : '?status=ACTIVE';
        return this.request(`/warehouse-sims${query}`);
    }

    // ===================== SIM OPERATIONS =====================
    async assignSimToCustomer(data: {
        customerId: string;
        simId: string;
        cost?: number;
        receiptNumber?: string;
        paymentPlace?: string;
        performedBy?: string;
    }): Promise<any> {
        return this.request('/warehouse-sims/assign', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async exchangeSim(data: {
        customerId: string;
        returningSimSerial: string;
        newSimId: string;
        returningStatus: string;
        returningType?: string;
        cost?: number;
        receiptNumber?: string;
        paymentPlace?: string;
        notes?: string;
        performedBy?: string;
    }): Promise<any> {
        return this.request('/warehouse-sims/exchange', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async returnSimToWarehouse(data: {
        customerId: string;
        simSerial: string;
        status: string;
        type?: string;
        notes?: string;
        performedBy?: string;
    }): Promise<any> {
        return this.request('/warehouse-sims/return', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async getCustomerSimCards(customerId: string): Promise<any[]> {
        return this.request(`/customers/${customerId}/simcards`);
    }

    async getCustomerSimHistory(customerId: string): Promise<any[]> {
        return this.request(`/customers/${customerId}/sim-history`);
    }

    async getSimMovements(serialNumber?: string): Promise<any[]> {
        const query = serialNumber ? `?serialNumber=${serialNumber}` : '';
        return this.request(`/warehouse-sims/movements${query}`);
    }

    // ==================== Branches ====================
    async getBranches(): Promise<any[]> {
        return this.request('/branches');
    }

    async getActiveBranches(): Promise<any[]> {
        return this.request('/branches/active');
    }

    async getBranch(id: string): Promise<any> {
        return this.request(`/branches/${id}`);
    }

    async createBranch(data: { code: string; name: string; address?: string }): Promise<any> {
        return this.request('/branches', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async updateBranch(id: string, data: { code?: string; name?: string; address?: string; isActive?: boolean }): Promise<any> {
        return this.request(`/branches/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    async deleteBranch(id: string): Promise<any> {
        return this.request(`/branches/${id}`, { method: 'DELETE' });
    }

    // Get branches by type
    async getBranchesByType(type: string): Promise<any[]> {
        return this.request(`/branches/type/${type}`);
    }

    // Get maintenance centers with their serviced branches
    async getMaintenanceCenters(): Promise<any[]> {
        return this.request('/branches/centers/with-branches');
    }

    // Get branches serviced by a specific center
    async getCenterBranches(centerId: string): Promise<any[]> {
        return this.request(`/branches/center/${centerId}/branches`);
    }

    // ==================== Notifications ====================
    async getNotifications(params?: { branchId?: string; userId?: string; unreadOnly?: boolean }): Promise<any[]> {
        const query = new URLSearchParams();
        if (params?.branchId) query.append('branchId', params.branchId);
        if (params?.userId) query.append('userId', params.userId);
        if (params?.unreadOnly) query.append('unreadOnly', 'true');
        const queryStr = query.toString();
        return this.request(`/notifications${queryStr ? '?' + queryStr : ''}`);
    }

    async getNotificationCount(params?: { branchId?: string; userId?: string }): Promise<{ count: number }> {
        const query = new URLSearchParams();
        if (params?.branchId) query.append('branchId', params.branchId);
        if (params?.userId) query.append('userId', params.userId);
        const queryStr = query.toString();
        return this.request(`/notifications/count${queryStr ? '?' + queryStr : ''}`);
    }

    async markNotificationRead(id: string): Promise<any> {
        return this.request(`/notifications/${id}/read`, { method: 'PUT' });
    }

    async markAllNotificationsRead(params?: { branchId?: string; userId?: string }): Promise<any> {
        return this.request('/notifications/read-all', {
            method: 'PUT',
            body: JSON.stringify(params || {})
        });
    }

    // ==================== Transfer Orders ====================
    async getTransferOrders(params?: { branchId?: string; status?: string; type?: string; q?: string }): Promise<any[]> {
        const query = new URLSearchParams();
        if (params?.branchId) query.append('branchId', params.branchId);
        if (params?.status) query.append('status', params.status);
        if (params?.type) query.append('type', params.type);
        if (params?.q) query.append('q', params.q);
        return this.request(`/transfer-orders?${query.toString()}`);
    }

    async getPendingTransferOrders(branchId?: string): Promise<any[]> {
        const query = branchId ? `?branchId=${branchId}` : '';
        return this.request(`/transfer-orders/pending${query}`);
    }

    async getPendingTransferSerials(branchId?: string, type?: string): Promise<string[]> {
        const params = new URLSearchParams();
        if (branchId) params.append('branchId', branchId);
        if (type) params.append('type', type);
        const query = params.toString();
        return this.request(`/transfer-orders/pending-serials${query ? '?' + query : ''}`);
    }

    async getTransferOrder(id: string): Promise<any> {
        return this.request(`/transfer-orders/${id}`);
    }

    async createTransferOrder(data: {
        branchId?: string;
        fromBranchId?: string;
        toBranchId?: string;
        type: 'SIM' | 'MACHINE' | 'SPARE_PART';
        items: Array<{ serialNumber: string; type?: string; manufacturer?: string; notes?: string }>;
        notes?: string;
        createdBy?: string;
        createdByName?: string;
    }): Promise<any> {
        return this.request('/transfer-orders', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async importTransferOrder(formData: FormData): Promise<any> {
        return this.request('/transfer-orders/import', {
            method: 'POST',
            body: formData
        });
    }

    async receiveTransferOrder(id: string, data: {
        receivedBy?: string;
        receivedByName?: string;
        receivedItems?: string[];
    }): Promise<any> {
        return this.request(`/transfer-orders/${id}/receive`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async rejectTransferOrder(id: string, data: {
        rejectionReason?: string;
        receivedBy?: string;
        receivedByName?: string;
    }): Promise<any> {
        return this.request(`/transfer-orders/${id}/reject`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async cancelTransferOrder(id: string): Promise<any> {
        return this.request(`/transfer-orders/${id}/cancel`, {
            method: 'POST'
        });
    }

    async getTransferOrderStats(params?: { branchId?: string }): Promise<any> {
        const query = params?.branchId ? `?branchId=${params.branchId}` : '';
        return this.request(`/transfer-orders/stats/summary${query}`);
    }

    // ==================== Maintenance Approvals ====================
    async getApprovalByRequest(requestId: string): Promise<any> {
        return this.request(`/approvals/request/${requestId}`);
    }

    async createApproval(data: { requestId: string; cost: number; parts: any[]; notes?: string }): Promise<any> {
        return this.request('/approvals', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async respondToApproval(id: string, data: { status: 'APPROVED' | 'REJECTED'; responseNotes?: string }): Promise<any> {
        return this.request(`/approvals/${id}/respond`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    // ==================== External Repair (صيانة خارجية) ====================

    // Withdraw machine for external repair
    async withdrawMachineForRepair(data: {
        serialNumber: string;
        customerId: string;
        customerName?: string;
        requestId?: string;
        notes?: string;
    }): Promise<any> {
        return this.request('/warehouse-machines/external-repair/withdraw', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    // Get external repair machines
    async getExternalRepairMachines(status?: string): Promise<any> {
        const query = status ? `?status=${status}` : '';
        return this.request(`/warehouse-machines/external-repair${query}`);
    }

    // Mark machine as ready for pickup
    async markMachineReadyForPickup(id: string): Promise<any> {
        return this.request(`/warehouse-machines/external-repair/${id}/ready`, {
            method: 'PUT'
        });
    }

    // Deliver machine to customer
    async deliverMachineToCustomer(id: string): Promise<any> {
        return this.request(`/warehouse-machines/external-repair/${id}/deliver`, {
            method: 'POST'
        });
    }

    // Get ready for pickup count
    async getReadyForPickupCount(): Promise<{ count: number }> {
        return this.request('/warehouse-machines/external-repair/ready-count');
    }

    // Bulk transfer machines to maintenance center
    async bulkTransferMachines(data: {
        serialNumbers: string[];
        toBranchId: string;
        waybillNumber?: string;
        notes?: string;
        performedBy?: string;
    }): Promise<any> {
        return this.request('/warehouse-machines/bulk-transfer', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    // ===== DASHBOARD & ADMIN =====

    async getAdminSummary(): Promise<any> {
        return this.request('/dashboard/admin-summary');
    }

    async globalSearch(query: string): Promise<{ machines: any[]; customers: any[] }> {
        return this.request(`/dashboard/search?q=${encodeURIComponent(query)}`);
    }

    async updateSimCard(id: string, data: { type: string }): Promise<any> {
        return this.request(`/simcards/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    async getLogs(limit: number = 5): Promise<any[]> {
        return this.request(`/backup/logs?limit=${limit}`);
    }

    async updatePreferences(data: { theme?: string; fontFamily?: string; themeVariant?: 'glass' | 'solid' }): Promise<any> {
        return this.request('/auth/preferences', {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    // ===== PERMISSIONS =====

    // Get all permissions matrix
    async getPermissions(): Promise<{
        pages: Record<string, Record<string, boolean>>;
        actions: Record<string, Record<string, boolean>>;
        roles: string[];
    }> {
        return this.request('/permissions');
    }

    // Update a single permission
    async updatePermission(data: {
        role: string;
        permissionType: 'PAGE' | 'ACTION';
        permissionKey: string;
        isAllowed: boolean;
    }): Promise<any> {
        return this.request('/permissions', {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    // Bulk update permissions
    async bulkUpdatePermissions(permissions: Array<{
        role: string;
        permissionType: 'PAGE' | 'ACTION';
        permissionKey: string;
        isAllowed: boolean;
    }>): Promise<{ updated: number }> {
        return this.request('/permissions/bulk', {
            method: 'POST',
            body: JSON.stringify({ permissions })
        });
    }

    // Reset permissions to defaults
    async resetPermissions(): Promise<{ message: string }> {
        return this.request('/permissions/reset', {
            method: 'POST'
        });
    }

    // Check if current user has permission
    async checkPermission(type: 'PAGE' | 'ACTION', key: string): Promise<{ allowed: boolean }> {
        return this.request(`/permissions/check?type=${type}&key=${encodeURIComponent(key)}`);
    }
}


export const api = new ApiClient(API_BASE_URL);
