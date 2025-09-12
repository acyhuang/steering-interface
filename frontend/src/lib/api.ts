import { ChatRequest, ChatResponse, ChatMessage } from '../types/chat';
import { ComparisonService, PendingFeature } from '../types/comparison';
import { FeatureActivation, InspectFeaturesRequest, SteerFeatureRequest, SteerFeatureResponse, ClearFeatureRequest, ClearFeatureResponse, SearchFeaturesRequest, ClusteredFeaturesResponse } from '../types/features';
import { createLogger } from './logger';

const logger = createLogger('api');

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');

// Add API version prefix
export const API_V1_URL = `${API_BASE_URL}/api/v1`;

export const chatApi = {
  createChatCompletion: async (request: ChatRequest): Promise<ChatResponse> => {
    logger.debug('Creating chat completion', {
      messageCount: request.messages.length,
      variantId: request.variant_id,
      autoSteer: request.auto_steer
    });
    
    const response = await fetch(`${API_V1_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error('Failed to create chat completion');
    }

    const data = await response.json() as ChatResponse;
    
    logger.debug('Chat completion response', {
      contentLength: data.content.length,
      variantId: data.variant_id,
      autoSteered: data.auto_steered,
      hasSteerResult: !!data.auto_steer_result
    });
    
    return data;
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
  inspectFeatures: async (request: InspectFeaturesRequest): Promise<FeatureActivation[]> => {
    const response = await fetch(`${API_V1_URL}/features/inspect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error('Failed to inspect features');
    }

    const data = await response.json() as FeatureActivation[];
    return data;
  },

  steerFeature: async (request: SteerFeatureRequest): Promise<SteerFeatureResponse> => {
    const response = await fetch(`${API_V1_URL}/features/steer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error('Failed to steer feature');
    }

    const data = await response.json() as SteerFeatureResponse;
    return data;
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

  clearFeature: async (request: ClearFeatureRequest): Promise<ClearFeatureResponse> => {
    const response = await fetch(`${API_V1_URL}/features/clear`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error('Failed to clear feature');
    }

    const data = await response.json() as ClearFeatureResponse;
    return data;
  },

  searchFeatures: async (request: SearchFeaturesRequest): Promise<FeatureActivation[]> => {
    const response = await fetch(`${API_V1_URL}/features/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error('Failed to search features');
    }

    const data = await response.json() as FeatureActivation[];
    return data;
  },

  clusterFeatures: async (
    features: FeatureActivation[],
    sessionId: string,
    variantId?: string,
    forceRefresh: boolean = false
  ): Promise<ClusteredFeaturesResponse> => {
    const effectiveVariantId = variantId || sessionId;
    const response = await fetch(`${API_V1_URL}/features/cluster`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        features,
        session_id: sessionId,
        variant_id: effectiveVariantId,
        force_refresh: forceRefresh
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to cluster features');
    }

    const data = await response.json() as ClusteredFeaturesResponse;
    return data;
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

/**
 * Implementation of ComparisonService for handling comparison operations
 */
export class ComparisonServiceImpl implements ComparisonService {
  private apiBase: string;
  private logger: ReturnType<typeof createLogger>;

  constructor(apiBase: string = API_V1_URL) {
    this.apiBase = apiBase;
    this.logger = createLogger('ComparisonService');
    this.logger.info('ComparisonService initialized', { apiBase });
  }

  /**
   * Generate comparison responses for original and steered variants
   */
  async generateComparison(
    messages: ChatMessage[],
    pendingFeatures: PendingFeature[],
    variantId?: string
  ): Promise<{
    original: string;
    steered: string;
    originalState: string;
    steeredState: string;
  }> {
    try {
      this.logger.debug('Generate comparison started', {
        messageCount: messages.length,
        messages: messages,
        pendingFeatures: pendingFeatures,
        variantId: variantId || 'none'
      });
      
      this.logger.info('Generating comparison', { 
        messageCount: messages.length,
        pendingFeatureCount: pendingFeatures.length,
        variantId
      });
      
      // Enhanced logging for pending features
      if (pendingFeatures.length > 0) {
        this.logger.info('Pending features details', {
          features: pendingFeatures.map(f => ({
            id: f.featureId,
            value: f.value,
            status: f.status
          }))
        });
      } else {
        this.logger.warn('No pending features provided to ComparisonService');
      }
      
      // Extract the last assistant message as the original response
      const lastAssistantMsg = [...messages].reverse().find(msg => msg.role === 'assistant');
      let originalResponse: string;
      let originalState: string = '{}';
      
      if (lastAssistantMsg) {
        this.logger.info('Using last assistant message as original response', {
          contentLength: lastAssistantMsg.content.length,
          contentPreview: lastAssistantMsg.content.substring(0, 50) + '...'
        });
        originalResponse = lastAssistantMsg.content;
        
        // Get current variant state
        try {
          const variantState = await featuresApi.getModifiedFeatures(
            'default_session', // Use a consistent session ID
            variantId || undefined
          ) as Record<string, unknown>;
          originalState = JSON.stringify(variantState);
        } catch (error) {
          this.logger.error('Failed to get variant state for original response', {
            error: this.formatError(error)
          });
        }
      } else {
        this.logger.warn('No existing assistant message found, generating new original response');
        // Generate original response if no existing message
        const originalReq: ChatRequest = {
          messages,
          variant_id: variantId || 'default'
        };
        const originalRes = await this.callChatCompletions(originalReq);
        originalResponse = originalRes.content;
        originalState = originalRes.variant_json || '{}';
      }

      // Initialize with all messages
      let messagesForSteeredResponse = [...messages];
      
      // Log original messages for debugging
      this.logger.debug('Original messages before filtering', {
        messageCount: messages.length,
        roles: messages.map(m => m.role),
        lastAssistantMsgFound: !!lastAssistantMsg
      });
      
      if (lastAssistantMsg) {
        // Find the index of the last assistant message
        const lastAssistantIndex = messages.findIndex(
          msg => msg.role === 'assistant' && 
          msg.content === lastAssistantMsg.content
        );
        
        if (lastAssistantIndex !== -1) {
          // Keep all messages up to but excluding the last assistant message
          messagesForSteeredResponse = [
            ...messages.slice(0, lastAssistantIndex)
          ];
        }
      }
      
      this.logger.debug('Preparing messages for steered response', {
        originalCount: messages.length,
        filteredCount: messagesForSteeredResponse.length,
        filteredRoles: messagesForSteeredResponse.map(m => m.role),
        removedAssistantMessage: lastAssistantMsg ? true : false
      });

      // Apply the pending features first before generating the steered response
      if (pendingFeatures && pendingFeatures.length > 0) {
        this.logger.info('Applying pending features before generating steered response', {
          featureCount: pendingFeatures.length
        });
        
        // Apply each feature using the steerFeature endpoint
        const applyPromises = pendingFeatures.map(async (feature) => {
          const url = `${this.apiBase}/features/steer`;
          this.logger.debug('Applying feature for steered response', { 
            feature_label: feature.featureLabel,
            value: feature.value
          });
          
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              session_id: 'default_session', // Use a consistent session ID
              variant_id: variantId,
              feature_label: feature.featureLabel,
              value: feature.value
            })
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to apply feature ${feature.featureLabel} for steered response: ${response.status} ${response.statusText} - ${errorText}`);
          }
          
          return await response.json();
        });
        
        // Wait for all features to be applied
        await Promise.all(applyPromises);
        this.logger.info('All pending features applied for steered response');
      }

      // Generate steered response with the features now applied to the variant
      const steeredReq: ChatRequest = {
        messages: messagesForSteeredResponse,
        variant_id: variantId || 'default'
      };
      
      this.logger.debug('Steered request about to be sent', {
        filteredMessagesCount: messagesForSteeredResponse.length,
        filteredMessages: messagesForSteeredResponse,
        variantId: variantId || 'none'
      });
      
      const steeredRes = await this.callChatCompletions(steeredReq);
      
      this.logger.debug('Comparison results', {
        originalResponse: originalResponse,
        steeredResponse: steeredRes.content,
        responsesIdentical: originalResponse === steeredRes.content
      });
      
      this.logger.info('Comparison generated successfully', {
        originalLength: originalResponse.length,
        originalPreview: originalResponse.substring(0, 50) + '...',
        steeredLength: steeredRes.content.length,
        steeredPreview: steeredRes.content.substring(0, 50) + '...'
      });

      return {
        original: originalResponse,
        steered: steeredRes.content,
        originalState: originalState,
        steeredState: steeredRes.variant_json || '{}'
      };
    } catch (error) {
      this.logger.error('Failed to generate comparison', { error: this.formatError(error) });
      throw new Error(error instanceof Error ? error.message : 'Failed to generate comparison');
    }
  }

  /**
   * Apply pending features to a variant
   */
  async applyPendingFeatures(
    features: PendingFeature[],
    variantId?: string
  ): Promise<void> {
    if (features.length === 0) {
      this.logger.info('No pending features to apply');
      return;
    }

    try {
      this.logger.info('Applying pending features', { 
        featureCount: features.length,
        variantId
      });

      // Process each feature individually using the steerFeature endpoint
      // which expects session_id, variant_id, feature_label, and value
      const promises = features.map(async (feature) => {
        const url = `${this.apiBase}/features/steer`;
        this.logger.debug('Applying feature', { 
          feature_label: feature.featureLabel,
          value: feature.value
        });
        
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            session_id: 'default_session', // Use a consistent session ID
            variant_id: variantId,
            feature_label: feature.featureLabel,
            value: feature.value
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to apply feature ${feature.featureLabel}: ${response.status} ${response.statusText} - ${errorText}`);
        }
        
        return await response.json();
      });

      // Wait for all feature applications to complete
      await Promise.all(promises);
      this.logger.info('Pending features applied successfully');
    } catch (error) {
      this.logger.error('Error applying pending features', { error: this.formatError(error) });
      throw new Error(error instanceof Error ? error.message : 'Failed to apply pending features');
    }
  }

  /**
   * Confirm a comparison (accept steered response)
   */
  async confirmComparison(variantId?: string): Promise<void> {
    try {
      this.logger.info('Confirming comparison', { variantId });

      // Use the /features/modified endpoint to save the current state since we don't have a direct confirm endpoint
      const url = `${this.apiBase}/features/modified`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          variant_id: variantId,
          action: 'confirm'
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to confirm comparison: ${response.status} ${response.statusText} - ${errorText}`);
      }

      this.logger.info('Comparison confirmed successfully');
    } catch (error) {
      this.logger.error('Error confirming comparison', { error: this.formatError(error) });
      throw new Error(error instanceof Error ? error.message : 'Failed to confirm comparison');
    }
  }

  /**
   * Reject a comparison (revert to original response)
   */
  async rejectComparison(variantId?: string): Promise<void> {
    try {
      this.logger.info('Rejecting comparison', { variantId });

      // Use the /features/clear endpoint to revert since we don't have a direct revert endpoint
      const url = `${this.apiBase}/features/clear`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          variant_id: variantId,
          all_features: true
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to reject comparison: ${response.status} ${response.statusText} - ${errorText}`);
      }

      this.logger.info('Comparison rejected successfully');
    } catch (error) {
      this.logger.error('Error rejecting comparison', { error: this.formatError(error) });
      throw new Error(error instanceof Error ? error.message : 'Failed to reject comparison');
    }
  }

  /**
   * Helper method to call chat completions API
   */
  private async callChatCompletions(request: ChatRequest): Promise<ChatResponse> {
    try {
      // Enhance logging with more details about the request
      this.logger.info('Calling chat completions API', { 
        messageCount: request.messages.length,
        variant_id: request.variant_id || 'none',
        hasLastAssistantMessage: request.messages.some((m: ChatMessage) => m.role === 'assistant'),
        lastMessageRole: request.messages.length > 0 ? request.messages[request.messages.length - 1].role : 'none',
        messageRoles: request.messages.map((m: ChatMessage) => m.role)
      });
      
      // Check if we have the last message as user to help debug
      if (request.messages.length > 0 && request.messages[request.messages.length - 1].role !== 'user') {
        this.logger.warn('Last message is not from user - this may cause unexpected behavior', {
          lastRole: request.messages[request.messages.length - 1].role
        });
      }
      
      // Log the current variant state to verify the steering is applied
      let activeFeatures: any[] = [];
      try {
        const variantState = await featuresApi.getModifiedFeatures(
          'default_session',
          request.variant_id || undefined
        );
        
        activeFeatures = Array.isArray(variantState.edits) ? variantState.edits : [];
        
        this.logger.debug('Variant state before chat completion', {
          variantId: request.variant_id || 'none',
          activeFeatures: activeFeatures,
          fullVariantState: variantState
        });
      } catch (error) {
        this.logger.error('Failed to fetch variant state before generating response', {
          error: this.formatError(error)
        });
      }
      
      this.logger.debug('Chat completion request', {
        requestBody: request
      });
      
      const response = await fetch(`${this.apiBase}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to generate chat completion: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json() as ChatResponse;
      
      // Add Chat component style logging for consistency
      this.logger.info('Response from API:', { 
        content: data.content.substring(0, 50),
        variant_id: data.variant_id,
        has_variant_json: !!data.variant_json
      });
      
      return data;
    } catch (error) {
      this.logger.error('Error in chat completions', { error: this.formatError(error) });
      throw new Error(error instanceof Error ? error.message : 'Failed to generate chat completion');
    }
  }

  /**
   * Format error object for logger
   */
  private formatError(error: unknown): Record<string, unknown> {
    if (error instanceof Error) {
      return {
        message: error.message,
        name: error.name,
        stack: error.stack
      };
    }
    return { rawError: String(error) };
  }
} 