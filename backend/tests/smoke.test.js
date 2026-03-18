const request = require('supertest');

// Mock security before requiring server
jest.mock('../utils/security', () => ({
  validateMachineBinding: jest.fn().mockResolvedValue(true),
  getHWID: jest.fn().mockReturnValue('TEST_HWID')
}));

const { app, server } = require('../server');

afterAll(async () => {
  if (server && server.close) {
    await new Promise(resolve => server.close(resolve));
  }
});

describe('Main System Smoke Tests', () => {
  test('Base Health Check', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('status');
  });

  test('API Health Check', async () => {
    const res = await request(app).get('/api/health');
    expect(res.statusCode).toBe(200);
  });

  test('Public Modules Check (Auth)', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    if (![400, 401, 403].includes(res.statusCode)) {
      console.log('Main Auth Failure Code:', res.statusCode, res.body);
    }
    expect([400, 401, 403]).toContain(res.statusCode);
  });

  test('Static Files Check (if prod)', async () => {
    // Just verifying the middleware doesn't crash
    if (process.env.NODE_ENV === 'production') {
      const res = await request(app).get('/');
      expect(res.statusCode).toBe(200);
    }
  });
});
