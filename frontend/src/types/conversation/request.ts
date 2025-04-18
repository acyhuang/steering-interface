/**
 * Request types for conversation interactions
 */

import { ChatMessage } from './message';

export interface ChatRequest {
  messages: ChatMessage[];
  variant_id: string;
  auto_steer?: boolean;
} 