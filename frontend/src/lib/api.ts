// Domain types (React-First)
import { 
  Feature, 
  ChatMessage, 
  ComparisonResult,
  FeatureCluster,
  FeatureSearchResult,
  createChatMessage
} from '@/types/domain';

// Note: Legacy ComparisonService removed - functionality now in VariantContext

// API transformation functions
import {
  chatToApiRequest,
  inspectFeaturesToApiRequest,
  steerFeatureToApiRequest,
  clearFeatureToApiRequest,
  searchFeaturesToApiRequest,
  apiFeatureToFeature,
  apiChatResponseToComparisonResult,
  apiStreamChunkToComparisonResult,
  apiClusteredResponseToFeatureClusters,
  apiFeatureActivationsToSearchResult,
  createChatMessageFromApiResponse
} from '@/types/api/transforms';

// API types (internal to API layer) - ApiChatRequest is used in transforms, not directly here

import type {
  ApiChatResponse,
  ApiChatStreamChunk,
  ApiFeature,
  ApiClearFeatureResponse,
  ApiClusteredFeaturesResponse
} from '@/types/api/responses';

import { createLogger } from './logger';

const logger = createLogger('api');

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');

// Add API version prefix
export const API_V1_URL = `${API_BASE_URL}/api/v1`;

export const chatApi = {

  // For components that want to handle streaming themselves
  createStreamingChatCompletionWithCallback: async (
    messages: ChatMessage[],
    variantId: string,
    options: {
      sessionId?: string;
      autoSteer?: boolean;
      stream?: boolean;
      maxTokens?: number;
      temperature?: number;
      topP?: number;
    } = {},
    onChunk: (chunk: { delta: string; comparisonResult?: ComparisonResult }) => void,
    onComplete: (message: ChatMessage, comparisonResult?: ComparisonResult) => void,
    onError: (error: Error) => void
  ): Promise<void> => {
    try {
      logger.debug('Creating streaming chat completion with callback', {
        messageCount: messages.length,
        variantId,
        autoSteer: options.autoSteer
      });

      // Transform domain types to API request
      const apiRequest = chatToApiRequest(messages, variantId, {
        ...options,
        stream: true
      });
      
      const response = await fetch(`${API_V1_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(apiRequest),
      });

      if (!response.ok) {
        throw new Error(`Streaming request failed: ${response.status} ${response.statusText}`);
      }

      // Check if we got a streaming response
      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('text/plain')) {
        // Not a streaming response, parse as regular JSON and call onComplete
        const apiResponse = await response.json() as ApiChatResponse;
        logger.debug('Got regular response instead of streaming');
        
        const chatMessage = createChatMessageFromApiResponse(apiResponse);
        const comparisonResult = apiChatResponseToComparisonResult(apiResponse);
        onComplete(chatMessage, comparisonResult || undefined);
        return;
      }

      // Parse streaming response
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body reader available');
      }

      let fullContent = '';
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const jsonData = line.slice(6); // Remove 'data: ' prefix
                if (jsonData.trim()) {
                  const apiChunk = JSON.parse(jsonData) as ApiChatStreamChunk;
                  
                  if (apiChunk.type === 'chunk' && apiChunk.delta) {
                    fullContent += apiChunk.delta;
                    const comparisonResult = apiStreamChunkToComparisonResult(apiChunk);
                    onChunk({ 
                      delta: apiChunk.delta, 
                      comparisonResult: comparisonResult || undefined 
                    });
                  } else if (apiChunk.type === 'done') {
                    // Create final chat message from accumulated content
                    const chatMessage = createChatMessage('assistant', fullContent);
                    const comparisonResult = apiStreamChunkToComparisonResult(apiChunk);
                    onComplete(chatMessage, comparisonResult || undefined);
                    return;
                  } else if (apiChunk.type === 'error') {
                    throw new Error(apiChunk.error || 'Streaming error occurred');
                  }
                }
              } catch (parseError) {
                logger.warn('Failed to parse streaming chunk', { line, error: parseError });
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      onError(error instanceof Error ? error : new Error(String(error)));
    }
  },

  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/health`);
      return response.ok;
    } catch (error: unknown) {
      logger.error('Health check failed:', { 
        error: error instanceof Error 
          ? { message: error.message, name: error.name } 
          : { rawError: String(error) }
      });
      return false;
    }
  },
};

// Interface declarations for the API responses
interface CreateVariantResponse {
  variant_id: string;
  model: string;
}

export const featuresApi = {
  inspectFeatures: async (
    messages: ChatMessage[],
    sessionId: string,
    variantId?: string
  ): Promise<Feature[]> => {
    const apiRequest = inspectFeaturesToApiRequest(messages, sessionId, variantId);
    
    const response = await fetch(`${API_V1_URL}/features/inspect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(apiRequest),
    });

    if (!response.ok) {
      throw new Error('Failed to inspect features');
    }

    const apiFeatures = await response.json() as ApiFeature[];
    return apiFeatures.map((f, index) => 
      apiFeatureToFeature(f, `${f.label}_${index}`, index)
    );
  },

  steerFeature: async (
    feature: Feature,
    sessionId: string,
    variantId?: string
  ): Promise<Feature> => {
    const apiRequest = steerFeatureToApiRequest(feature, sessionId, variantId);
    
    const response = await fetch(`${API_V1_URL}/features/steer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(apiRequest),
    });

    if (!response.ok) {
      throw new Error('Failed to steer feature');
    }

    const apiResponse = await response.json() as ApiFeature;
    return apiFeatureToFeature(apiResponse, feature.uuid, feature.indexInSae);
  },

  getModifiedFeatures: async (sessionId: string, variantId?: string): Promise<Record<string, unknown>> => {
    const effectiveVariantId = variantId || sessionId;
    const url = `${API_V1_URL}/features/modified?session_id=${sessionId}&variant_id=${effectiveVariantId}`;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch modified features');
      
      const rawData = await response.json();
      // Handle potential null or non-object responses
      return (rawData && typeof rawData === 'object') 
        ? rawData as Record<string, unknown> 
        : {};
    } catch (error) {
      console.error('Error in getModifiedFeatures:', error);
      return {};
    }
  },

  clearFeature: async (
    featureLabel: string,
    sessionId: string,
    variantId?: string
  ): Promise<void> => {
    const apiRequest = clearFeatureToApiRequest(featureLabel, sessionId, variantId);
    
    const response = await fetch(`${API_V1_URL}/features/clear`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(apiRequest),
    });

    if (!response.ok) {
      throw new Error('Failed to clear feature');
    }

    // Clear operation doesn't need to return data in domain layer
    await response.json() as ApiClearFeatureResponse;
  },

  searchFeatures: async (
    query: string,
    sessionId: string,
    variantId?: string,
    maxResults?: number
  ): Promise<FeatureSearchResult> => {
    const apiRequest = searchFeaturesToApiRequest(query, sessionId, variantId, maxResults);
    
    const response = await fetch(`${API_V1_URL}/features/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(apiRequest),
    });

    if (!response.ok) {
      throw new Error('Failed to search features');
    }

    const apiFeatures = await response.json() as ApiFeature[];
    return apiFeatureActivationsToSearchResult(apiFeatures, query);
  },

  clusterFeatures: async (
    features: Feature[],
    sessionId: string,
    variantId?: string,
    forceRefresh: boolean = false
  ): Promise<FeatureCluster[]> => {
    const effectiveVariantId = variantId || sessionId;
    
    // Convert domain Features to API format for clustering request
    const apiFeatures: ApiFeature[] = features.map(f => ({
      label: f.label,
      activation: f.activation
    }));
    
    const response = await fetch(`${API_V1_URL}/features/cluster`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        features: apiFeatures,
        session_id: sessionId,
        variant_id: effectiveVariantId,
        force_refresh: forceRefresh
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to cluster features');
    }

    const apiResponse = await response.json() as ApiClusteredFeaturesResponse;
    return apiClusteredResponseToFeatureClusters(apiResponse);
  },

  createVariant: async (
    sessionId: string, 
    baseVariantId?: string,
  ): Promise<CreateVariantResponse> => {
    const response = await fetch(`${API_V1_URL}/features/variants`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_id: sessionId,
        base_variant_id: baseVariantId,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create variant');
    }

    const data = await response.json() as CreateVariantResponse;
    return data;
  },
};

// Legacy ComparisonServiceImpl removed - functionality now handled by VariantContext
// All comparison operations (generateSteeredResponse, confirmSteeredResponse, cancelSteering)
// are available through the VariantContext hook. 