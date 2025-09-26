/**
 * API Request DTOs - Minimal data transfer objects
 * 
 * These types represent the exact shape of data sent to the backend API.
 * They now reference domain types where appropriate to maintain React-first approach.
 * Use transformation functions to convert from domain types.
 */

import { ChatMessage } from '../domain';

/**
 * Chat completion request
 */
export interface ApiChatRequest {
  messages: ChatMessage[];
  session_id?: string;
  variant_id: string;
  stream?: boolean;
  auto_steer?: boolean;
  max_completion_tokens?: number;
  temperature?: number;
  top_p?: number;
}

/**
 * Feature inspection request
 */
export interface ApiInspectFeaturesRequest {
  messages: ChatMessage[];
  session_id: string;
  variant_id?: string;
}

/**
 * Feature steering request
 */
export interface ApiSteerFeatureRequest {
  session_id: string;
  variant_id?: string;
  feature_label: string;
  value: number;
}

/**
 * Feature clearing request
 */
export interface ApiClearFeatureRequest {
  session_id: string;
  variant_id?: string;
  feature_label: string;
}

/**
 * Feature search request
 */
export interface ApiSearchFeaturesRequest {
  query: string;
  session_id: string;
  variant_id?: string;
  top_k?: number;
}

/**
 * Query analysis request (for auto-steering)
 */
export interface ApiQueryAnalysisRequest {
  query: string;
  session_id: string;
  variant_id?: string;
  context?: {
    previous_messages?: ChatMessage[];
  };
}

/**
 * Auto-steer request
 */
export interface ApiAutoSteerRequest {
  analysis: {
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
  };
  session_id: string;
  variant_id?: string;
  max_features?: number;
}

/**
 * Feature clustering request
 */
export interface ApiClusterFeaturesRequest {
  features: {
    label: string;
    activation: number;
  }[];
  session_id: string;
  variant_id?: string;
  force_refresh?: boolean;
}
