const inventoryService = require('../services/inventoryService');

test('inventoryService exports expected functions', () => {
  expect(typeof inventoryService.addStock).toBe('function');
  expect(typeof inventoryService.deductParts).toBe('function');
  expect(typeof inventoryService.getCurrentStock).toBe('function');
  expect(typeof inventoryService.getLowStockItems).toBe('function');
});
