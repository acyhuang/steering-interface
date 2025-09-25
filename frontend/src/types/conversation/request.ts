/**
 * Request types for conversation interactions
 */

import { ChatMessage } from '../shared/message';

export interface ChatRequest {
  messages: ChatMessage[];
  variant_id: string;
  auto_steer?: boolean;
  stream?: boolean;  // Default to true in API client
} 