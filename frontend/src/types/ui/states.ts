/**
 * UI State Management - Consolidated loading states and UI concerns
 * 
 * All component loading states consolidated into a single, comprehensive enum.
 * This replaces the scattered state enums across multiple files.
 */

/**
 * Comprehensive application loading states
 * 
 * Organized by functional area for clarity, but all in one enum
 * for consistency and easier state machine management.
 */
export enum AppLoadingState {
  // Global states
  IDLE = 'idle',
  ERROR = 'error',
  
  // Chat states
  CHAT_SENDING = 'chat_sending',
  CHAT_STREAMING = 'chat_streaming',
  CHAT_REGENERATING = 'chat_regenerating',
  CHAT_INSPECTING_FEATURES = 'chat_inspecting_features',
  
  // Steering states
  STEERING_APPLYING_FEATURES = 'steering_applying_features',
  STEERING_GENERATING_RESPONSE = 'steering_generating_response',
  STEERING_COMPARING = 'steering_comparing',
  STEERING_CONFIRMING = 'steering_confirming',
  STEERING_CANCELING = 'steering_canceling',
  
  // Feature management states
  FEATURES_LOADING = 'features_loading',
  FEATURES_SEARCHING = 'features_searching',
  FEATURES_CLUSTERING = 'features_clustering',
  FEATURES_INSPECTING = 'features_inspecting',
  FEATURES_STEERING = 'features_steering',
  FEATURES_CLEARING = 'features_clearing',
  
  // Controls states
  CONTROLS_LOADING_MODIFIED = 'controls_loading_modified',
  CONTROLS_REFRESHING = 'controls_refreshing',
  
  // Auto-steer states
  AUTO_STEER_ANALYZING = 'auto_steer_analyzing',
  AUTO_STEER_APPLYING = 'auto_steer_applying'
}

/**
 * Loading state information with metadata
 * 
 * Enhanced version of the previous LoadingStateInfo with better typing
 */
export interface LoadingStateInfo<T extends string = AppLoadingState> {
  state: T;
  error: Error | null;
  timestamp: number;
  metadata?: Record<string, any>; // For additional context
}

/**
 * Create a new loading state object
 */
export function createLoadingState<T extends string = AppLoadingState>(
  state: T, 
  error: Error | null = null,
  metadata?: Record<string, any>
): LoadingStateInfo<T> {
  return {
    state,
    error,
    timestamp: Date.now(),
    metadata
  };
}

/**
 * Check if a state represents a loading condition
 */
export function isLoadingState(state: AppLoadingState): boolean {
  return state !== AppLoadingState.IDLE && state !== AppLoadingState.ERROR;
}

/**
 * Check if a state represents an error condition
 */
export function isErrorState(state: AppLoadingState): boolean {
  return state === AppLoadingState.ERROR;
}

/**
 * Get the functional area of a loading state
 */
export function getStateCategory(state: AppLoadingState): string {
  if (state.startsWith('chat_')) return 'chat';
  if (state.startsWith('steering_')) return 'steering';
  if (state.startsWith('features_')) return 'features';
  if (state.startsWith('controls_')) return 'controls';
  if (state.startsWith('auto_steer_')) return 'auto_steer';
  return 'global';
}

/**
 * State transition helpers for common patterns
 */
export const StateTransitions = {
  /**
   * Start a loading operation
   */
  startLoading: <T extends string>(
    currentState: LoadingStateInfo<T>,
    newState: T,
    metadata?: Record<string, any>
  ): LoadingStateInfo<T> => {
    return createLoadingState(newState, null, metadata);
  },

  /**
   * Complete a loading operation successfully
   */
  completeLoading: <T extends string>(
    currentState: LoadingStateInfo<T>,
    metadata?: Record<string, any>
  ): LoadingStateInfo<T> => {
    return createLoadingState(AppLoadingState.IDLE as T, null, metadata);
  },

  /**
   * Fail a loading operation with an error
   */
  failLoading: <T extends string>(
    currentState: LoadingStateInfo<T>,
    error: Error,
    metadata?: Record<string, any>
  ): LoadingStateInfo<T> => {
    return createLoadingState(AppLoadingState.ERROR as T, error, metadata);
  }
};

/**
 * LEGACY: Individual state enums have been removed
 * 
 * Use AppLoadingState instead for all loading state management.
 * This provides a consolidated, comprehensive set of states for
 * the entire application while maintaining clear functional areas.
 */
