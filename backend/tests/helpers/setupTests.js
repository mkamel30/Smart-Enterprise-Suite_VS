/**
 * Jest setup file for backend tests
 * Automatically runs before all tests to set up common environment
 */

// Ensure JWT_SECRET is set so middleware doesn't abort tests
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test-jwt-secret-for-testing';
}

// Optional: Add any other test environment setup here
// e.g., suppress console warnings, set timezone, configure global test timeouts
