import axios from 'axios';
import type { 
  ChatMessage, 
  ConversationCreateResponse, 
  UnifiedFeature 
} from '@/types';

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// API Service Layer - matches backend endpoints
export const conversationApi = {
  create: async (variantId?: string): Promise<ConversationCreateResponse> => {
    const response = await apiClient.post('/conversations', {
      variant_id: variantId,
    });
    return response.data;
  },

  sendMessage: async (
    conversationId: string, 
    messages: ChatMessage[]
  ): Promise<ReadableStream> => {
    const response = await fetch(`${API_BASE_URL}/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.body!;
  },

  getFeatures: async (conversationId: string): Promise<UnifiedFeature[]> => {
    const response = await apiClient.get(`/conversations/${conversationId}/features`);
    return response.data;
  },

  getTableFeatures: async (conversationId: string): Promise<UnifiedFeature[]> => {
    const response = await apiClient.get(`/conversations/${conversationId}/table-features`);
    return response.data;
  },
};

export const variantApi = {
  create: async (label: string, baseModel?: string) => {
    const response = await apiClient.post('/variants', {
      label,
      base_model: baseModel,
    });
    return response.data;
  },

  steerFeature: async (
    variantId: string, 
    featureUuid: string, 
    value: number
  ) => {
    const response = await apiClient.post(
      `/variants/${variantId}/features/${featureUuid}/steer`,
      { value }
    );
    return response.data;
  },

  commitChanges: async (variantId: string) => {
    const response = await apiClient.post(`/variants/${variantId}/commit-changes`);
    return response.data;
  },

  rejectChanges: async (variantId: string) => {
    const response = await apiClient.post(`/variants/${variantId}/reject-changes`);
    return response.data;
  },

  searchFeatures: async (
    variantId: string,
    query: string,
    topK: number = 10
  ): Promise<UnifiedFeature[]> => {
    const response = await apiClient.get(`/variants/${variantId}/features/search`, {
      params: {
        query,
        top_k: topK
      }
    });
    return response.data.features;
  },

  autoSteer: async (
    variantId: string,
    query: string,
    conversationContext: string[]
  ): Promise<{ success: boolean; search_keywords: string[]; suggested_features: UnifiedFeature[] }> => {
    const response = await apiClient.post(`/variants/${variantId}/auto-steer`, {
      query,
      current_variant_id: variantId,
      conversation_context: conversationContext
    });
    return response.data;
  },
};

