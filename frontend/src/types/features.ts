import { ChatMessage } from './chat';

export interface ModifiedFeature {
  label: string;
  value: number;
}

export interface FeatureActivation {
  label: string;
  activation: number;
  modifiedActivation?: number;
}

export interface InspectFeaturesRequest {
  messages: { role: string; content: string }[];
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

export interface ClearFeatureRequest {
  session_id: string;
  variant_id?: string;
  feature_label: string;
}

export interface ClearFeatureResponse {
  label: string;
}

export interface SearchFeaturesRequest {
  query: string;
  session_id: string;
  variant_id?: string;
  top_k?: number;
}

export interface FeatureCluster {
  name: string;
  type: "predefined" | "dynamic";
  features: FeatureActivation[];
}

export interface ClusteredFeaturesResponse {
  clusters: FeatureCluster[];
} 