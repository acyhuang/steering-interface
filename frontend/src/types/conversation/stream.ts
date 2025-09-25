/**
 * Streaming types for conversation interactions
 */

import { AutoSteerResult } from '../steering/autoSteer';

export interface ChatStreamChunk {
  type: 'chunk' | 'done' | 'error';
  content?: string;
  delta?: string;  // For incremental content
  variant_id?: string;
  auto_steered?: boolean;
  auto_steer_result?: AutoSteerResult;
  error?: string;
}
