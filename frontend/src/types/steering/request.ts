/**
 * Request types for steering operations
 */

import { ChatMessage } from '../shared/message';

export interface InspectFeaturesRequest {
  messages: ChatMessage[];
  session_id: string;
  variant_id?: string;
}

export interface SteerFeatureRequest {
  session_id: string;
  variant_id?: string;
  feature_label: string;
  value: number;
}

export interface ClearFeatureRequest {
  session_id: string;
  variant_id?: string;
  feature_label: string;
}

export interface SearchFeaturesRequest {
  query: string;
  session_id: string;
  variant_id?: string;
  top_k?: number;
}

export interface ClearFeatureResponse {
  label: string;
} 