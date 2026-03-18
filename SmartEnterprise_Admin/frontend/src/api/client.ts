
import { setApiToken, getApiToken, request } from './baseClient';

import { authApi } from './authApi';
import { customerApi } from './customerApi';
import { inventoryApi } from './inventoryApi';
import { requestApi } from './requestApi';
import { userApi } from './userApi';
import { settingsApi } from './settingsApi';
import { permissionApi } from './permissionApi';
import { branchApi } from './branchApi';
import { simApi } from './simApi';
import { machineApi } from './machineApi';
import { warehouseApi } from './warehouseApi';
import { transferApi } from './transferApi';
import { paymentApi } from './paymentApi';
import { notificationApi } from './notificationApi';
import { dashboardApi } from './dashboardApi';
import { aiApi } from './aiApi';
import { backupApi } from './backupApi';
import { maintenanceApi } from './maintenanceApi';
import { reportApi } from './reportApi';

import { adminStoreApi } from './adminStoreApi';

// The ApiClient remains for state management and aggregate access
// to maintain backward compatibility with existing code.
class ApiClient {
    public setToken(token: string | null) {
        setApiToken(token);
    }

    public getToken() {
        return getApiToken();
    }

    public get = <T>(endpoint: string) => request<T>(endpoint);
    public post = <T>(endpoint: string, body?: any) => request<T>(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined
    });
    public put = <T>(endpoint: string, body?: any) => request<T>(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined
    });
    public patch = <T>(endpoint: string, body?: any) => request<T>(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined
    });
    public delete = <T>(endpoint: string) => request<T>(endpoint, {
        method: 'DELETE'
    });

    // Admin Store
    getAdminItemTypes = adminStoreApi.getItemTypes;
    getItemTypes = adminStoreApi.getItemTypes;
    createAdminItemType = adminStoreApi.createItemType;
    createItemType = adminStoreApi.createItemType;
    updateAdminItemType = adminStoreApi.updateItemType;
    updateItemType = adminStoreApi.updateItemType;
    getAdminInventory = adminStoreApi.getAdminInventory;
    getAdminAssetHistory = adminStoreApi.getAdminAssetHistory;
    createAdminAssetManual = adminStoreApi.createAdminAssetManual;
    importAdminAssets = adminStoreApi.importAdminAssets;
    getAdminCartons = adminStoreApi.getAdminCartons;
    createAdminCarton = adminStoreApi.createAdminCarton;
    transferAdminAsset = adminStoreApi.transferAdminAsset;
    transferAdminCarton = adminStoreApi.transferAdminCarton;
    transferAdminStock = adminStoreApi.transferAdminStock;
    transferAdminBulk = adminStoreApi.transferAdminBulk;
    getAdminStocks = adminStoreApi.getAdminStocks;

    // Auth
    login = authApi.login;
    changePassword = authApi.changePassword;
    updatePreferences = authApi.updatePreferences;
    getMFAStatus = authApi.getMFAStatus;
    setupMFA = authApi.setupMFA;
    verifyMFASetup = authApi.verifyMFASetup;
    disableMFA = authApi.disableMFA;
    verifyMFALogin = authApi.verifyMFALogin;
    generateMFARecoveryCodes = authApi.generateMFARecoveryCodes;
    verifyMFARecovery = authApi.verifyMFARecovery;
    logout = authApi.logout;

    // Customers
    getCustomers = customerApi.getCustomers;
    getCustomersLite = customerApi.getCustomersLite;
    getCustomer = customerApi.getCustomer;
    createCustomer = customerApi.createCustomer;
    updateCustomer = customerApi.updateCustomer;
    deleteCustomer = customerApi.deleteCustomer;
    getCustomerMachines = customerApi.getCustomerMachines;
    getCustomerSimCards = customerApi.getCustomerSimCards;
    getCustomerSimHistory = customerApi.getCustomerSimHistory;
    getCustomerTemplate = customerApi.getCustomerTemplate;
    importCustomers = customerApi.importCustomers;
    exportCustomers = customerApi.exportCustomers;

    // Inventory
    getInventory = inventoryApi.getInventory;
    getInventoryLite = inventoryApi.getInventoryLite;
    getStockMovements = inventoryApi.getStockMovements;
    updateInventory = inventoryApi.updateInventory;
    importInventory = inventoryApi.importInventory;
    getInventoryReport = inventoryApi.getInventoryReport;
    transferInventory = inventoryApi.transferInventory;

    // Requests
    getRequests = requestApi.getRequests;
    getRequest = requestApi.getRequest;
    createRequest = requestApi.createRequest;
    assignTechnician = requestApi.assignTechnician;
    closeRequest = requestApi.closeRequest;
    deleteRequest = requestApi.deleteRequest;
    getRequestStats = requestApi.getRequestStats;
    exportRequests = requestApi.exportRequests;

    // Users
    getUsers = userApi.getUsers;
    getTechnicians = userApi.getTechnicians;
    createUser = userApi.createUser;
    updateUser = userApi.updateUser;
    deleteUser = userApi.deleteUser;
    resetUserPassword = userApi.resetUserPassword;
    importUsers = userApi.importUsers;
    exportUsers = userApi.exportUsers;

    // Settings & Configuration
    getMachineParameters = settingsApi.getMachineParameters;
    createMachineParameter = settingsApi.createMachineParameter;
    deleteMachineParameter = settingsApi.deleteMachineParameter;
    applyMachineParameters = settingsApi.applyMachineParameters;
    forceUpdateMachineModels = settingsApi.forceUpdateMachineModels;
    broadcastMachineParameters = settingsApi.broadcastMachineParameters;
    broadcastGlobalParameters = settingsApi.broadcastGlobalParameters;
    broadcastSpareParts = settingsApi.broadcastSpareParts;
    getGlobalParameters = settingsApi.getGlobalParameters;
    updateGlobalParameter = settingsApi.updateGlobalParameter;
    getClientTypes = settingsApi.getClientTypes;
    createClientType = settingsApi.createClientType;
    updateClientType = settingsApi.updateClientType;
    deleteClientType = settingsApi.deleteClientType;

    // Permissions
    getPermissions = permissionApi.getPermissions;
    bulkUpdatePermissions = permissionApi.bulkUpdatePermissions;
    resetPermissions = permissionApi.resetPermissions;
    checkPermission = permissionApi.checkPermission;

    // Branches
    getBranches = branchApi.getBranches;
    getActiveBranches = branchApi.getActiveBranches;
    getBranch = branchApi.getBranch;
    createBranch = branchApi.createBranch;
    updateBranch = branchApi.updateBranch;
    deleteBranch = branchApi.deleteBranch;
    getBranchesByType = branchApi.getBranchesByType;
    getMaintenanceCenters = branchApi.getMaintenanceCenters;
    getCenterBranches = branchApi.getCenterBranches;
    getBranchesLookup = branchApi.getBranchesLookup;
    getAuthorizedBranches = branchApi.getAuthorizedBranches;
    getSystemHwid = branchApi.getSystemHwid;

    // Sims
    getAllSimCards = simApi.getAllSimCards;
    updateSimCard = simApi.updateSimCard;
    getSimCardTemplate = simApi.getSimCardTemplate;
    importSimCards = simApi.importSimCards;
    exportSimCards = simApi.exportSimCards;
    getWarehouseSims = simApi.getWarehouseSims;
    getWarehouseSimCounts = simApi.getWarehouseSimCounts;
    createWarehouseSim = simApi.createWarehouseSim;
    updateWarehouseSim = simApi.updateWarehouseSim;
    deleteWarehouseSim = simApi.deleteWarehouseSim;
    transferWarehouseSims = simApi.transferWarehouseSims;
    getAvailableWarehouseSims = simApi.getAvailableWarehouseSims;
    assignSimToCustomer = simApi.assignSimToCustomer;
    exchangeSim = simApi.exchangeSim;
    returnSimToWarehouse = simApi.returnSimToWarehouse;
    getSimMovements = simApi.getSimMovements;
    getWarehouseSimTemplate = simApi.getWarehouseSimTemplate;
    importWarehouseSims = simApi.importWarehouseSims;
    exportWarehouseSims = simApi.exportWarehouseSims;

    // Machines
    getMachineTemplate = machineApi.getMachineTemplate;
    importMachines = machineApi.importMachines;
    exportMachines = machineApi.exportMachines;
    getWarehouseMachines = machineApi.getWarehouseMachines;
    getWarehouseMachineCounts = machineApi.getWarehouseMachineCounts;
    addWarehouseMachine = machineApi.addWarehouseMachine;
    updateWarehouseMachine = machineApi.updateWarehouseMachine;
    deleteWarehouseMachine = machineApi.deleteWarehouseMachine;
    getWarehouseLogs = machineApi.getWarehouseLogs;
    getMachineHistory = machineApi.getMachineHistory;
    exchangeWarehouseMachine = machineApi.exchangeWarehouseMachine;
    returnMachineToWarehouse = machineApi.returnMachineToWarehouse;
    updateMachinesByPrefix = machineApi.updateMachinesByPrefix;
    getAvailableWarehouseMachines = machineApi.getAvailableWarehouseMachines;
    getWarehouseMachineTemplate = machineApi.getWarehouseMachineTemplate;
    importWarehouseMachines = machineApi.importWarehouseMachines;
    exportWarehouseMachines = machineApi.exportWarehouseMachines;
    returnMachineToCustomer = machineApi.returnMachineToCustomer;
    repairMachineToStandby = machineApi.repairMachineToStandby;
    transitionMachineState = machineApi.transitionMachineState;

    // Warehouse (Parts & External)
    getSpareParts = warehouseApi.getSpareParts;
    createSparePart = warehouseApi.createSparePart;
    updateSparePart = warehouseApi.updateSparePart;
    deleteSparePart = warehouseApi.deleteSparePart;
    withdrawMachineForRepair = warehouseApi.withdrawMachineForRepair;
    getExternalRepairMachines = warehouseApi.getExternalRepairMachines;
    markMachineReadyForPickup = warehouseApi.markMachineReadyForPickup;
    deliverMachineToCustomer = warehouseApi.deliverMachineToCustomer;
    getReadyForPickupCount = warehouseApi.getReadyForPickupCount;
    bulkTransferMachines = warehouseApi.bulkTransferMachines;
    importSpareParts = warehouseApi.importSpareParts;
    exportSpareParts = warehouseApi.exportSpareParts;
    downloadSparePartsTemplate = warehouseApi.downloadTemplate;

    // Transfers
    getTransferOrders = transferApi.getTransferOrders;
    getPendingTransferOrders = transferApi.getPendingTransferOrders;
    getPendingTransferSerials = transferApi.getPendingTransferSerials;
    getTransferOrder = transferApi.getTransferOrder;
    createTransferOrder = transferApi.createTransferOrder;
    importTransferOrder = transferApi.importTransferOrder;
    receiveTransferOrder = transferApi.receiveTransferOrder;
    rejectTransferOrder = transferApi.rejectTransferOrder;
    cancelTransferOrder = transferApi.cancelTransferOrder;
    getTransferOrderStats = transferApi.getTransferOrderStats;

    // Payments & Sales
    getPayments = paymentApi.getPayments;
    getPaymentStats = paymentApi.getPaymentStats;
    createPayment = paymentApi.createPayment;
    deletePayment = paymentApi.deletePayment;
    checkReceipt = paymentApi.checkReceipt;
    getMonthlyRepairCount = paymentApi.getMonthlyRepairCount;
    getInstallments = paymentApi.getInstallments;
    payInstallment = paymentApi.payInstallment;
    payInstallmentWithDetails = paymentApi.payInstallmentWithDetails;
    recalculateInstallments = paymentApi.recalculateInstallments;
    createSale = paymentApi.createSale;
    getSales = paymentApi.getSales;
    deleteSale = paymentApi.deleteSale;

    // Notifications
    getNotifications = notificationApi.getNotifications;
    getNotificationCount = notificationApi.getNotificationCount;
    markNotificationRead = notificationApi.markNotificationRead;
    markAllNotificationsRead = notificationApi.markAllNotificationsRead;

    // Dashboard
    getDashboardStats = dashboardApi.getDashboardStats;
    getInstallmentStats = dashboardApi.getInstallmentStats;
    getExecutiveDashboard = dashboardApi.getExecutiveDashboard;
    getExecutiveBranchDetail = dashboardApi.getExecutiveBranchDetail;
    getAdminSummary = dashboardApi.getAdminSummary;
    getAdminAffairsSummary = dashboardApi.getAdminAffairsSummary;
    globalSearch = dashboardApi.globalSearch;

    // AI
    getAiModels = aiApi.getAiModels;
    askAi = aiApi.askAi;

    // Backup & Audit
    createBackup = backupApi.createBackup;
    listBackups = backupApi.listBackups;
    restoreBackup = backupApi.restoreBackup;
    deleteBackup = backupApi.deleteBackup;
    getLogs = backupApi.getLogs;
    getAuditLogs = backupApi.getAuditLogs;

    // Maintenance Center
    getApprovalByRequest = maintenanceApi.getApprovalByRequest;
    createApproval = maintenanceApi.createApproval;
    respondToApproval = maintenanceApi.respondToApproval;
    getApprovalStats = maintenanceApi.getApprovalStats;
    getMaintenanceCenterMachines = maintenanceApi.getMaintenanceCenterMachines;
    getMaintenanceCenterMachine = maintenanceApi.getMaintenanceCenterMachine;
    getMaintenanceCenterMachineBySerial = maintenanceApi.getMaintenanceCenterMachineBySerial;
    assignTechnicianToMachine = maintenanceApi.assignTechnicianToMachine;
    inspectMachine = maintenanceApi.inspectMachine;
    startRepair = maintenanceApi.startRepair;
    requestRepairApproval = maintenanceApi.requestRepairApproval;
    markMachineRepaired = maintenanceApi.markMachineRepaired;
    markMachineTotalLoss = maintenanceApi.markMachineTotalLoss;
    returnMachineToBranch = maintenanceApi.returnMachineToBranch;
    getMaintenanceCenterStats = maintenanceApi.getMaintenanceCenterStats;
    getPendingApprovals = maintenanceApi.getPendingApprovals;
    getBranchMachinesAtCenter = maintenanceApi.getBranchMachinesAtCenter;
    getBranchMachinesSummary = maintenanceApi.getBranchMachinesSummary;
    getMachineStatusHistory = maintenanceApi.getMachineStatusHistory;
    getMachinesReadyForReturn = maintenanceApi.getMachinesReadyForReturn;
    createReturnPackage = maintenanceApi.createReturnPackage;
    receiveShipment = maintenanceApi.receiveShipment;
    getShipments = maintenanceApi.getShipments;

    // Aliases for MaintenanceMachineDetail

    getMaintenanceCenterInventory = inventoryApi.getInventory;
    assignMaintenanceTechnician = maintenanceApi.assignTechnicianToMachine;
    inspectMaintenanceMachine = maintenanceApi.inspectMachine;
    startMaintenanceRepair = maintenanceApi.startRepair;
    requestMaintenanceApproval = maintenanceApi.requestRepairApproval;
    returnMachineToOrigin = maintenanceApi.returnMachineToBranch;

    // Reports
    getMovementsReport = reportApi.getMovementsReport;
    getPerformanceReport = reportApi.getPerformanceReport;
    getExecutiveReport = reportApi.getExecutiveReport;
    getTechnicianConsumptionReport = reportApi.getTechnicianConsumptionReport;
    getPosStock = reportApi.getPosStock;
    getPosSalesMonthly = reportApi.getPosSalesMonthly;
    getPosSalesDaily = reportApi.getPosSalesDaily;
    getMonthlyClosing = reportApi.getMonthlyClosing;
}

export const api = new ApiClient();
