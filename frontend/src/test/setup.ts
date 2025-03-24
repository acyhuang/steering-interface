import '@testing-library/jest-dom';
import { vi } from 'vitest';
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