/**
 * Types for auto-steering functionality
 */

import { SteerFeatureResponse } from './feature';

export interface AutoSteerResult {
  original_content: string;
  steered_content: string;
  applied_features: SteerFeatureResponse[];
}
