import { ChatMessage, ChatResponse, ChatRequest } from './chat';

export interface PendingFeature {
  featureId: string;
  featureLabel: string;
  value: number;
  status: 'pending' | 'applied' | 'confirmed';
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