/**
 * Loading state types for the UI domain
 */

/**
 * Chat component loading states
 */
export enum ChatLoadingState {
  IDLE = 'idle',             // Not loading anything
  SENDING = 'sending',       // Sending a new message
  REGENERATING = 'regenerating', // Regenerating the last message
  INSPECTING_FEATURES = 'inspecting_features', // Inspecting features after a message
}

/**
 * Variant context loading states used for the steering comparison flow
 */
export enum SteeringLoadingState {
  IDLE = 'idle',             // No steering operation in progress
  APPLYING_FEATURES = 'applying_features', // Applying features to the variant
  GENERATING_RESPONSE = 'generating_response', // Generating a steered response
  COMPARING = 'comparing',   // Comparing original and steered responses
  CONFIRMING = 'confirming', // Confirming the steered response
  CANCELING = 'canceling',   // Canceling the steering operation
}

/**
 * Controls component loading states
 */
export enum ControlsLoadingState {
  IDLE = 'idle',             // Not loading anything
  LOADING_FEATURES = 'loading_features', // Loading activated features
  LOADING_MODIFIED = 'loading_modified', // Loading modified features
  SEARCHING = 'searching',   // Searching for features
  STEERING = 'steering',     // Applying steering to a feature
}

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