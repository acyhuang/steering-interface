/**
 * Error types for the UI domain - Simplified React-First approach
 */

/**
 * Base retryable error pattern
 */
export interface RetryableError {
  retryable: boolean;
  retryAfter?: number; // milliseconds to wait before retry
}

/**
 * General operation error (API calls, features, etc.)
 * Replaces ApiError and FeatureError with unified approach
 */
export interface OperationError extends RetryableError {
  operation: string; // 'chat', 'steer_feature', 'search_features', etc.
  message: string;
  userMessage: string; // Always provide user-friendly message
  context?: Record<string, any>; // Optional context for debugging
}

/**
 * Component error for React error boundaries
 */
export interface ComponentError {
  componentName: string;
  error: Error;
  recoverable: boolean;
  timestamp: number;
}

/**
 * Form validation error
 */
export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

/**
 * Utility functions for error handling
 */

/**
 * Create an operation error (replaces createApiError and createFeatureError)
 */
export function createOperationError(
  operation: string,
  message: string,
  userMessage?: string,
  options?: {
    retryable?: boolean;
    retryAfter?: number;
    context?: Record<string, any>;
  }
): OperationError {
  return {
    operation,
    message,
    userMessage: userMessage || message,
    retryable: options?.retryable ?? true,
    retryAfter: options?.retryAfter,
    context: options?.context
  };
}

/**
 * Create a component error for error boundaries
 */
export function createComponentError(
  componentName: string,
  error: Error,
  recoverable: boolean = true
): ComponentError {
  return {
    componentName,
    error,
    recoverable,
    timestamp: Date.now()
  };
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: any): boolean {
  return error?.retryable === true;
}

/**
 * Get user-friendly error message
 */
export function getUserErrorMessage(error: any): string {
  if (error?.userMessage) return error.userMessage;
  if (error?.message) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred';
}
