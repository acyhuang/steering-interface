/**
 * Domain ↔ API Transformation Functions
 * 
 * These functions handle conversion between domain types (React-First)
 * and API DTOs (backend contracts). This keeps domain logic separate
 * from API implementation details.
 * 
 * Updated to use domain ChatMessage as the canonical message representation.
 */

import { 
  Feature, 
  ChatMessage, 
  ComparisonResult,
  FeatureCluster,
  FeatureSearchResult,
  createChatMessage
} from '../domain';

import {
  ApiChatRequest,
  ApiInspectFeaturesRequest,
  ApiSteerFeatureRequest,
  ApiClearFeatureRequest,
  ApiSearchFeaturesRequest
} from './requests';

import {
  ApiChatResponse,
  ApiChatStreamChunk,
  ApiFeature,
  ApiFeatureCluster,
  ApiClusteredFeaturesResponse,
  ApiComparisonResult
} from './responses';

/**
 * Utility Functions
 */

/**
 * Extract API-compatible message from domain ChatMessage
 * 
 * The backend only needs role and content. Domain ChatMessage includes
 * additional frontend-specific fields (auto-generated id, timestamp) that
 * should be stripped when sending to the backend.
 */
export function extractApiMessage(message: ChatMessage): { role: string; content: string } {
  return {
    role: message.role,
    content: message.content
    // Note: id and timestamp are frontend-only, not sent to backend
  };
}

/**
 * Extract API-compatible messages from domain ChatMessage array
 */
export function extractApiMessages(messages: ChatMessage[]): { role: string; content: string }[] {
  return messages.map(extractApiMessage);
}

/**
 * Domain → API Transformations (for outgoing requests)
 */

export function chatToApiRequest(
  messages: ChatMessage[],
  variantId: string,
  options?: {
    sessionId?: string;
    autoSteer?: boolean;
    stream?: boolean;
    maxTokens?: number;
    temperature?: number;
    topP?: number;
  }
): ApiChatRequest {
  return {
    messages: messages, // Now directly using ChatMessage[] as API expects it
    session_id: options?.sessionId,
    variant_id: variantId,
    stream: options?.stream ?? true,
    auto_steer: options?.autoSteer ?? false,
    max_completion_tokens: options?.maxTokens,
    temperature: options?.temperature,
    top_p: options?.topP
  };
}

export function inspectFeaturesToApiRequest(
  messages: ChatMessage[],
  sessionId: string,
  variantId?: string
): ApiInspectFeaturesRequest {
  return {
    messages: messages, // Now directly using ChatMessage[] as API expects it
    session_id: sessionId,
    variant_id: variantId
  };
}

export function steerFeatureToApiRequest(
  feature: Feature,
  sessionId: string,
  variantId?: string
): ApiSteerFeatureRequest {
  return {
    session_id: sessionId,
    variant_id: variantId,
    feature_label: feature.label, // Labels are the primary identifier in Goodfire SDK
    value: feature.pendingModification ?? feature.modification
  };
}

/**
 * Alternative: Steer by label only (for cases where you don't have full Feature object)
 */
export function steerFeatureLabelToApiRequest(
  featureLabel: string,
  value: number,
  sessionId: string,
  variantId?: string
): ApiSteerFeatureRequest {
  return {
    session_id: sessionId,
    variant_id: variantId,
    feature_label: featureLabel,
    value: value
  };
}

export function clearFeatureToApiRequest(
  featureLabel: string,
  sessionId: string,
  variantId?: string
): ApiClearFeatureRequest {
  return {
    session_id: sessionId,
    variant_id: variantId,
    feature_label: featureLabel
  };
}

export function searchFeaturesToApiRequest(
  query: string,
  sessionId: string,
  variantId?: string,
  maxResults?: number
): ApiSearchFeaturesRequest {
  return {
    query,
    session_id: sessionId,
    variant_id: variantId,
    top_k: maxResults
  };
}

/**
 * API → Domain Transformations (for incoming responses)
 */

/**
 * Convert unified API feature to domain Feature
 * 
 * Handles all API feature types (activation, steering, auto-steer) consistently.
 */
export function apiFeatureToFeature(
  apiFeature: ApiFeature,
  uuid: string = '',
  indexInSae: number = 0
): Feature {
  const modification = apiFeature.modified_value ?? 0;
  
  return {
    label: apiFeature.label,
    uuid,
    indexInSae,
    activation: apiFeature.activation,
    modification,
    isModified: modification !== 0,
    hasPending: false
  };
}


/**
 * Convert API comparison result to domain ComparisonResult
 */
export function apiComparisonResultToComparisonResult(
  apiResult: ApiComparisonResult
): ComparisonResult {
  return {
    originalContent: apiResult.original_content,
    steeredContent: apiResult.steered_content,
    appliedFeatures: apiResult.applied_features.map(f => ({
      label: f.label,
      value: f.modified_value ?? 0,
      category: f.category
    })),
    source: apiResult.source
  };
}

export function apiChatResponseToComparisonResult(
  apiResponse: ApiChatResponse
): ComparisonResult | null {
  // Use unified comparison_result field
  if (apiResponse.comparison_result) {
    return apiComparisonResultToComparisonResult(apiResponse.comparison_result);
  }
  
  return null;
}


export function apiStreamChunkToComparisonResult(
  apiChunk: ApiChatStreamChunk
): ComparisonResult | null {
  // Use unified comparison_result field
  if (apiChunk.comparison_result) {
    return apiComparisonResultToComparisonResult(apiChunk.comparison_result);
  }
  
  return null;
}


export function apiClusterResponseToFeatureCluster(
  apiCluster: ApiFeatureCluster
): FeatureCluster {
  return {
    name: apiCluster.name,
    type: 'dynamic', // API doesn't distinguish, assume dynamic
    features: apiCluster.features.map(f => 
      apiFeatureToFeature(f)
    )
  };
}

export function apiClusteredResponseToFeatureClusters(
  apiResponse: ApiClusteredFeaturesResponse
): FeatureCluster[] {
  return apiResponse.clusters.map(apiClusterResponseToFeatureCluster);
}

export function apiFeatureActivationsToSearchResult(
  apiFeatures: ApiFeature[],
  query: string
): FeatureSearchResult {
  return {
    features: apiFeatures.map(f => apiFeatureToFeature(f)),
    query,
    totalFound: apiFeatures.length
  };
}

/**
 * Utility functions for common transformations
 */

/**
 * Extract features from various API responses and convert to domain Features
 */
export function extractFeaturesFromApiResponse(
  response: ApiFeature[] | ApiClusteredFeaturesResponse
): Feature[] {
  if (Array.isArray(response)) {
    // Handle ApiFeature[]
    return response.map((item, index) => 
      apiFeatureToFeature(item, `${item.label}_${index}`, index)
    );
  } else {
    // ApiClusteredFeaturesResponse
    return response.clusters.flatMap(cluster => 
      cluster.features.map((f, index) => 
        apiFeatureToFeature(f, `${f.label}_${index}`, index)
      )
    );
  }
}

/**
 * Create a ChatMessage from API response content
 */
export function createChatMessageFromApiResponse(
  apiResponse: ApiChatResponse
): ChatMessage {
  return createChatMessage('assistant', apiResponse.content);
}
