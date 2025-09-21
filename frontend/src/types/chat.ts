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

export interface ChatStreamChunk {
  type: 'chunk' | 'done' | 'error';
  content?: string;
  delta?: string;  // For incremental content
  variant_id?: string;
  auto_steered?: boolean;
  auto_steer_result?: AutoSteerResult;
  error?: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  variant_id: string;
  auto_steer?: boolean;
  stream?: boolean;  // Default to true in API client
}

export interface ChatResponse {
  content: string;
  variant_id: string;
  auto_steered?: boolean;
  auto_steer_result?: AutoSteerResult;
  variant_json?: string;
}

// Note: StreamingState and StreamingChatResponse types removed as they were unused 