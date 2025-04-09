import { vi } from 'vitest';

// Create mock functions
export const mockFeaturesApi = {
  getModifiedFeatures: vi.fn(),
  steerFeature: vi.fn(),
  clearFeature: vi.fn(),
};

export const mockChatApi = {
  createChatCompletion: vi.fn(),
};

// Mock the API modules
vi.mock('@/lib/api', () => ({
  featuresApi: mockFeaturesApi,
  chatApi: mockChatApi,
}));

// Mock the logger to prevent console spam during tests
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
})); 