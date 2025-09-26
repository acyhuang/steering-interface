/**
 * API Response DTOs - Minimal data transfer objects
 * 
 * These types represent the exact shape of data received from the backend API.
 * They are kept minimal and focused on data transfer, not business logic.
 * Use transformation functions to convert to domain types.
 */

/**
 * Unified API comparison result
 * 
 * Used for both automatic and manual steering results in API responses.
 */
export interface ApiComparisonResult {
  original_content: string;
  steered_content: string;
  applied_features: ApiFeature[];
  source: 'manual' | 'automatic';
}

/**
 * Chat completion response
 */
export interface ApiChatResponse {
  content: string;
  variant_id: string;
  auto_steered?: boolean;
  comparison_result?: ApiComparisonResult; // Unified comparison result for all steering operations
  variant_json?: string;
}

/**
 * Streaming chat chunk
 */
export interface ApiChatStreamChunk {
  type: 'chunk' | 'done' | 'error';
  content?: string;
  delta?: string;
  variant_id?: string;
  auto_steered?: boolean;
  comparison_result?: ApiComparisonResult; // Unified comparison result for all steering operations
  error?: string;
}

/**
 * Unified API feature representation
 * 
 * Consolidates all feature-related API responses into a single type.
 * Different endpoints may populate different optional fields.
 */
export interface ApiFeature {
  label: string;
  activation: number;
  modified_value?: number; // Present for steered features
  category?: string;       // Present in auto-steer responses
}


/**
 * Feature clearing response
 */
export interface ApiClearFeatureResponse {
  label: string;
}

/**
 * Feature cluster response
 */
export interface ApiFeatureCluster {
  name: string;
  features: ApiFeature[];
}

export interface ApiClusteredFeaturesResponse {
  clusters: ApiFeatureCluster[];
}

/**
 * Query analysis response
 */
export interface ApiQueryAnalysisResponse {
  persona: {
    role: string;
    style: string;
    approach: string;
  };
  features: {
    style: { label: string; importance: number }[];
    reasoning: { label: string; importance: number }[];
    knowledge: { label: string; importance: number }[];
  };
}

/**
 * Auto-steer response
 */
export interface ApiAutoSteerResponse {
  applied_features: {
    label: string;
    value: number;
    category: string;
  }[];
  variant_id: string;
  variant_json: string;
}

/**
 * Generic API error response
 */
export interface ApiErrorResponse {
  detail: string;
  code?: string;
  context?: Record<string, any>;
}
