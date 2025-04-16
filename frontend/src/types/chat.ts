import { SteerFeatureResponse } from './features';

export interface ChatMessage {
  role: string;
  content: string;
}

export interface AutoSteerResult {
  original_content: string;
  steered_content: string;
  applied_features: SteerFeatureResponse[];
}

export interface ChatRequest {
  messages: ChatMessage[];
  variant_id: string;
  auto_steer?: boolean;
}

export interface ChatResponse {
  content: string;
  variant_id: string;
  auto_steered?: boolean;
  auto_steer_result?: AutoSteerResult;
  variant_json?: string;
} 