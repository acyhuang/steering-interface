export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  variant_id?: string;
}

export interface ChatResponse {
  content: string;
  variant_id: string;
  variant_json?: string;
} 