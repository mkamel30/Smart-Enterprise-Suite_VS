const requestService = require('../services/requestService');

test('requestService exports expected functions', () => {
  expect(typeof requestService.createRequest).toBe('function');
  expect(typeof requestService.closeRequest).toBe('function');
  expect(typeof requestService.updateStatus).toBe('function');
  expect(typeof requestService.receiveMachineToWarehouse).toBe('function');
});
