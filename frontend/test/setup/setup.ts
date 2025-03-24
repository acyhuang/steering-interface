import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { createLogger } from '@/lib/logger';

// Mock the logger
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Global setup
beforeAll(() => {
  // Add any global setup here
});

// Clean up after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Global teardown
afterAll(() => {
  // Add any global teardown here
}); 