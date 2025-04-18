/**
 * Feature clustering types for the steering domain
 */

import { FeatureActivation } from './feature';

export interface FeatureCluster {
  name: string;
  type: "predefined" | "dynamic";
  features: FeatureActivation[];
}

export interface ClusteredFeaturesResponse {
  clusters: FeatureCluster[];
} 