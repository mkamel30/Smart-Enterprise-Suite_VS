// Use shared mock helper
const { createMockPrismaClient } = require('../tests/helpers/mockPrismaClient');
const mockDb = createMockPrismaClient();
mockDb.user = { findUnique: jest.fn(), update: jest.fn(), findFirst: jest.fn() };

jest.doMock('../db', () => mockDb);

const authService = require('../services/authService');
const db = require('../db');

describe('authService', () => {
  afterEach(() => jest.clearAllMocks());

  test('getProfile returns profile when user exists', async () => {
    db.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b', displayName: 'A', role: 'USER', branchId: 'b1', branch: { type: 'CENTER' }, theme: 'dark', fontFamily: 'sans' });
    const profile = await authService.getProfile('u1');
    expect(profile).toHaveProperty('email', 'a@b');
    expect(profile).toHaveProperty('branchId', 'b1');
  });

  test('getProfile throws when not found', async () => {
    db.user.findUnique.mockResolvedValue(null);
    await expect(authService.getProfile('missing')).rejects.toThrow('User not found');
  });
});
