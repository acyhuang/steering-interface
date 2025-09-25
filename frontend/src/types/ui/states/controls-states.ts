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
