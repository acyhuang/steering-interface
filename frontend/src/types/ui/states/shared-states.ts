/**
 * Shared loading state utilities
 */

/**
 * Structure for tracking loading states with additional metadata
 */
export interface LoadingStateInfo<T extends string = string> {
  state: T;
  error: Error | null;
  timestamp: number;
}

/**
 * Create a new loading state object
 */
export function createLoadingState<T extends string>(state: T, error: Error | null = null): LoadingStateInfo<T> {
  return {
    state,
    error,
    timestamp: Date.now(),
  };
}
