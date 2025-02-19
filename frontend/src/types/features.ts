import { ChatMessage } from './chat';

export interface FeatureActivation {
  label: string;
  activation: number;
}

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

export interface SteerFeatureResponse {
  label: string;
  activation: number;
  modified_value: number;
} 