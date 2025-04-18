/**
 * Types for comparison workflow in the variant domain
 */

import { ChatMessage } from '../conversation/message';
import { PendingFeature } from './pending';

export interface ComparisonState {
  originalResponse: string | null;
  steeredResponse: string | null;
  originalState: string | null;
  steeredState: string | null;
}

export interface ComparisonService {
  generateComparison(
    messages: ChatMessage[],
    pendingFeatures: PendingFeature[],
    variantId?: string
  ): Promise<{
    original: string;
    steered: string;
    originalState: string;
    steeredState: string;
  }>;
  
  applyPendingFeatures(
    features: PendingFeature[],
    variantId?: string
  ): Promise<void>;
  
  confirmComparison(variantId?: string): Promise<void>;
  
  rejectComparison(variantId?: string): Promise<void>;
} 