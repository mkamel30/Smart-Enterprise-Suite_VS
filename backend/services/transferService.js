const coreService = require('./transfer/coreService');
const orderService = require('./transfer/orderService');
const bulkService = require('./transfer/bulkService');

/**
 * Transfer Service Facade
 * Delegates calls to specialized sub-services for better maintainability.
 */

module.exports = {
    // Core / Retrieval
    applyTransferBranchFilter: coreService.applyTransferBranchFilter,
    generateOrderNumber: coreService.generateOrderNumber,
    listTransferOrders: coreService.listTransferOrders,
    getPendingOrders: coreService.getPendingOrders,
    getPendingSerials: coreService.getPendingSerials,
    getTransferOrderById: coreService.getTransferOrderById,
    getStatsSummary: coreService.getStatsSummary,

    // Order Lifecycle
    createTransferOrder: orderService.createTransferOrder,
    receiveTransferOrder: orderService.receiveTransferOrder,
    rejectOrder: orderService.rejectOrder,
    cancelOrder: orderService.cancelOrder,

    // Bulk Operations
    createBulkTransfer: bulkService.createBulkTransfer,
    importTransferFromExcel: bulkService.importTransferFromExcel
};
