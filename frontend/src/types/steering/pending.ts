/**
 * Types for pending feature modifications
 */

export interface PendingFeature {
  featureId: string;
  featureLabel: string;
  value: number;
  status: 'pending' | 'applied' | 'confirmed';
}

export interface PendingState {
  pendingFeatures: Map<string, PendingFeature>;
  lastConfirmedState: string | null;
}
