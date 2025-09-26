/**
 * Domain types - React-First design
 * 
 * These types represent the core business concepts of the application,
 * designed around React component needs rather than API contracts.
 * 
 * Key principles:
 * - Single source of truth for each concept
 * - Immutable operations with utility functions
 * - React-friendly patterns (pending state, etc.)
 * - Clear separation from API concerns
 */

// Core domain concepts
export * from './feature';
export * from './conversation';
export * from './steering';

// Export unified comparison types for convenience
export type { ComparisonResult, AppliedFeature } from './conversation';

// Re-export commonly used utility functions for convenience
export {
  createFeature,
  withPendingModification,
  confirmPendingModification,
  cancelPendingModification,
  clearFeatureModifications
} from './feature';

export {
  createConversation,
  addMessage,
  startStreaming,
  updateStreamingContent,
  completeStreaming,
  cancelStreaming,
  createChatMessage,
  generateMessageId
} from './conversation';

export {
  createVariantState,
  applyPendingFeature,
  confirmPendingModifications,
  cancelPendingModifications,
  startSteeringComparison,
  completeSteeringComparison,
  hasPendingModifications,
  getEffectiveFeatures
} from './steering';
