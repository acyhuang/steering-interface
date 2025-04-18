/**
 * Core feature types for the steering domain
 */

export interface FeatureActivation {
  label: string;
  activation: number;
  modifiedActivation?: number;
}

export interface ModifiedFeature {
  label: string;
  value: number;
}

export interface SteerFeatureResponse {
  label: string;
  activation: number;
  modified_value: number;
} 