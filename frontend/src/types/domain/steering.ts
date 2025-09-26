/**
 * Domain types for Steering operations (React-First design)
 * 
 * Handles steering comparison workflow, variant state, and steering operations.
 * Designed around React component needs and the comparison workflow.
 */

import { Feature } from './feature';
import { ComparisonResult } from './conversation';

/**
 * Steering comparison state
 * 
 * Manages the manual steering comparison workflow.
 * Contains workflow state separate from the actual comparison data.
 */
export interface SteeringComparison {
  result: ComparisonResult | null; // The actual comparison data
  isActive: boolean;
  isGenerating: boolean;
  error: Error | null;
}

/**
 * Variant state for React components
 * 
 * Encapsulates all variant-related state and operations
 */
export interface VariantState {
  variantId: string;
  sessionId: string;
  
  // Feature management
  features: Map<string, Feature>;           // All known features
  modifiedFeatures: Map<string, Feature>;   // Features with confirmed modifications
  pendingFeatures: Map<string, Feature>;    // Features with pending modifications
  
  // Comparison workflow
  comparison: SteeringComparison;
  
  // Auto-steering
  autoSteerEnabled: boolean;
  
  // Metadata
  lastConfirmedState: string | null; // JSON snapshot of last confirmed variant
}

/**
 * Steering operation types
 */
export type SteeringOperation = 
  | { type: 'APPLY_PENDING'; featureLabel: string; value: number }
  | { type: 'CONFIRM_STEERING' }
  | { type: 'CANCEL_STEERING' }
  | { type: 'CLEAR_FEATURE'; featureLabel: string }
  | { type: 'TOGGLE_AUTO_STEER' };

/**
 * Steering operation result
 */
export interface SteeringOperationResult {
  success: boolean;
  error?: Error;
  updatedFeatures?: Feature[];
  comparisonResult?: ComparisonResult;
}

/**
 * Feature search parameters
 */
export interface FeatureSearchParams {
  query: string;
  maxResults?: number;
  categories?: string[];
}

/**
 * Utility functions for working with Steering
 */

/**
 * Create initial variant state
 */
export function createVariantState(
  variantId: string = 'default',
  sessionId: string = 'default_session'
): VariantState {
  return {
    variantId,
    sessionId,
    features: new Map(),
    modifiedFeatures: new Map(),
    pendingFeatures: new Map(),
    comparison: {
      result: null,
      isActive: false,
      isGenerating: false,
      error: null
    },
    autoSteerEnabled: false,
    lastConfirmedState: null
  };
}

/**
 * Apply a pending feature modification (immutable)
 */
export function applyPendingFeature(
  state: VariantState,
  featureLabel: string,
  value: number
): VariantState {
  const feature = state.features.get(featureLabel);
  if (!feature) return state;

  const updatedFeature = {
    ...feature,
    pendingModification: value,
    hasPending: true
  };

  return {
    ...state,
    pendingFeatures: new Map(state.pendingFeatures).set(featureLabel, updatedFeature)
  };
}

/**
 * Confirm all pending modifications (immutable)
 */
export function confirmPendingModifications(state: VariantState): VariantState {
  const newModifiedFeatures = new Map(state.modifiedFeatures);
  const clearedPendingFeatures = new Map<string, Feature>();

  // Move pending features to modified features
  for (const [label, feature] of state.pendingFeatures) {
    if (feature.pendingModification !== undefined) {
      const confirmedFeature = {
        ...feature,
        modification: feature.pendingModification,
        pendingModification: undefined,
        isModified: feature.pendingModification !== 0,
        hasPending: false
      };
      newModifiedFeatures.set(label, confirmedFeature);
    }
  }

  return {
    ...state,
    modifiedFeatures: newModifiedFeatures,
    pendingFeatures: clearedPendingFeatures,
    comparison: {
      ...state.comparison,
      result: null,
      isActive: false,
      error: null
    }
  };
}

/**
 * Cancel all pending modifications (immutable)
 */
export function cancelPendingModifications(state: VariantState): VariantState {
  return {
    ...state,
    pendingFeatures: new Map(),
    comparison: {
      ...state.comparison,
      result: null,
      isActive: false,
      error: null
    }
  };
}

/**
 * Start steering comparison (immutable)
 */
export function startSteeringComparison(
  state: VariantState,
  originalContent: string
): VariantState {
  return {
    ...state,
    comparison: {
      ...state.comparison,
      result: state.comparison.result ? {
        ...state.comparison.result,
        originalContent
      } : {
        originalContent,
        steeredContent: '',
        appliedFeatures: [],
        source: 'manual'
      },
      isActive: true,
      isGenerating: true,
      error: null
    }
  };
}

/**
 * Complete steering comparison (immutable)
 */
export function completeSteeringComparison(
  state: VariantState,
  steeredContent: string,
  appliedFeatures: { label: string; value: number; category?: string }[] = []
): VariantState {
  if (!state.comparison.result) {
    throw new Error('Cannot complete comparison without starting it first');
  }

  return {
    ...state,
    comparison: {
      ...state.comparison,
      result: {
        ...state.comparison.result,
        steeredContent,
        appliedFeatures
      },
      isGenerating: false,
      error: null
    }
  };
}

/**
 * Check if variant has any pending modifications
 */
export function hasPendingModifications(state: VariantState): boolean {
  return state.pendingFeatures.size > 0;
}

/**
 * Get all features with their current effective values
 */
export function getEffectiveFeatures(state: VariantState): Feature[] {
  const allFeatures = new Map<string, Feature>();

  // Start with base features
  for (const [label, feature] of state.features) {
    allFeatures.set(label, feature);
  }

  // Apply confirmed modifications
  for (const [label, feature] of state.modifiedFeatures) {
    allFeatures.set(label, feature);
  }

  // Apply pending modifications
  for (const [label, feature] of state.pendingFeatures) {
    allFeatures.set(label, feature);
  }

  return Array.from(allFeatures.values());
}
