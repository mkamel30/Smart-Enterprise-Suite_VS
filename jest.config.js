module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js', '**/__tests__/**/*.test.js'],
  setupFilesAfterEnv: ['<rootDir>/backend/tests/helpers/setupTests.js'],
  collectCoverageFrom: [
    'backend/**/*.js',
    '!backend/tests/**',
    '!backend/__tests__/**',
    '!backend/node_modules/**'
  ]
};
