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