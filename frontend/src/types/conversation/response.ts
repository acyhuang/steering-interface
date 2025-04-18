/**
 * Response types for conversation interactions
 */

import { AutoSteerResult } from './autoSteer';

export interface ChatResponse {
  content: string;
  variant_id: string;
  auto_steered?: boolean;
  auto_steer_result?: AutoSteerResult;
  variant_json?: string;
} 