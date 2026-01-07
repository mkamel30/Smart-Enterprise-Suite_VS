const movementService = require('../services/movementService');

test('movementService exports expected functions', () => {
  expect(typeof movementService.logMachineMovement).toBe('function');
  expect(typeof movementService.logSimMovement).toBe('function');
  expect(typeof movementService.logSystemAction).toBe('function');
});
