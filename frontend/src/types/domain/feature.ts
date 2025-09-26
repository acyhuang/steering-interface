/**
 * Domain types for Feature management (React-First design)
 * 
 * This is the single source of truth for all feature-related state.
 * Designed around React component needs, not API contracts.
 */

/**
 * Core Feature interface - handles all feature states in one place
 * 
 * This replaces: FeatureActivation, ModifiedFeature, SteerFeatureResponse, etc.
 * React-friendly design with pending state for comparison workflow.
 */
export interface Feature {
  // Core identification
  label: string;
  uuid: string;
  indexInSae: number;
  
  // Current state
  activation: number;
  
  // Modification state (React-friendly pending pattern)
  modification: number;          // Current confirmed modification
  pendingModification?: number;  // Pending modification during comparison
  
  // Computed properties (readonly to prevent accidental mutation)
  readonly isModified: boolean;    // modification !== 0
  readonly hasPending: boolean;    // pendingModification !== undefined
}

/**
 * Feature cluster for organizing features in the UI
 * 
 * Used by feature list components for grouping and display
 */
export interface FeatureCluster {
  name: string;
  type: 'predefined' | 'dynamic';
  features: Feature[];
}

/**
 * Feature search result
 * 
 * Used when searching for features by semantic similarity
 */
export interface FeatureSearchResult {
  features: Feature[];
  query: string;
  totalFound: number;
}

/**
 * Utility functions for working with Features
 */

/**
 * Create a new Feature with default values
 */
export function createFeature(
  label: string,
  activation: number = 0,
  uuid: string = '',
  indexInSae: number = 0
): Feature {
  return {
    label,
    uuid,
    indexInSae,
    activation,
    modification: 0,
    isModified: false,
    hasPending: false
  };
}

/**
 * Apply a pending modification to a feature (immutable)
 */
export function withPendingModification(feature: Feature, value: number): Feature {
  return {
    ...feature,
    pendingModification: value,
    hasPending: true
  };
}

/**
 * Confirm pending modifications (immutable)
 */
export function confirmPendingModification(feature: Feature): Feature {
  if (!feature.hasPending) return feature;
  
  return {
    ...feature,
    modification: feature.pendingModification!,
    pendingModification: undefined,
    isModified: feature.pendingModification !== 0,
    hasPending: false
  };
}

/**
 * Cancel pending modifications (immutable)
 */
export function cancelPendingModification(feature: Feature): Feature {
  if (!feature.hasPending) return feature;
  
  return {
    ...feature,
    pendingModification: undefined,
    hasPending: false
  };
}

/**
 * Clear all modifications from a feature (immutable)
 */
export function clearFeatureModifications(feature: Feature): Feature {
  return {
    ...feature,
    modification: 0,
    pendingModification: undefined,
    isModified: false,
    hasPending: false
  };
}
