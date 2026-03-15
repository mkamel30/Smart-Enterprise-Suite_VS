const coreService = require('./maintenance/coreService');
const workflowService = require('./maintenance/workflowService');
const disposalService = require('./maintenance/disposalService');

// Threshold for automatic approval creation (in currency)
const APPROVAL_COST_THRESHOLD = 500;

module.exports = {
  // Core / Retrieval
  getMachines: coreService.getMachines,
  getMachineById: coreService.getMachineById,
  getStats: coreService.getStats,
  getPendingApprovals: coreService.getPendingApprovals,
  getBranchMachinesAtCenter: coreService.getBranchMachinesAtCenter,
  getBranchMachinesSummary: coreService.getBranchMachinesSummary,

  // Workflow / Actions
  assignTechnician: workflowService.assignTechnician,
  inspectMachine: workflowService.inspectMachine,
  startRepair: workflowService.startRepair,
  requestApproval: workflowService.requestApproval,
  markRepaired: workflowService.markRepaired,

  // Disposal / Returns
  markTotalLoss: disposalService.markTotalLoss,
  returnToBranch: disposalService.returnToBranch,
  getMachinesReadyForReturn: disposalService.getMachinesReadyForReturn,
  createReturnPackage: disposalService.createReturnPackage,

  // Constants
  APPROVAL_COST_THRESHOLD
};
