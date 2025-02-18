export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  model?: string;
  stream?: boolean;
  max_completion_tokens?: number;
  temperature?: number;
  top_p?: number;
}

export interface ChatResponse {
  content: string;
} 