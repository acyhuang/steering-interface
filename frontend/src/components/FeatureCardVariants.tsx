import { ComponentType } from 'react';
import { FeatureCard } from './FeatureCard';
import { ContinuousFeatureCard } from './ContinuousFeatureCard';
import { FeatureActivation, SteerFeatureResponse } from "@/types/features"
import { useVariant } from '@/lib/variants/useVariant';
import { VariantDefinition } from '@/lib/variants/types';

// Shared interface for both variants
export interface FeatureCardProps {
  feature: FeatureActivation;
  onSteer?: (response: SteerFeatureResponse) => void;
  onFeatureModified?: () => void;
  modification?: number;
  readOnly?: boolean;
}

// Define our variants
const discreteVariant: VariantDefinition<FeatureCardProps> = {
  id: 'discrete',
  name: 'Discrete Controls',
  component: FeatureCard
};

const continuousVariant: VariantDefinition<FeatureCardProps> = {
  id: 'continuous',
  name: 'Continuous Controls',
  component: ContinuousFeatureCard
};

export const featureCardVariants = {
  discrete: discreteVariant,
  continuous: continuousVariant
};

// Create a hook to use the feature card variant
export function useFeatureCardVariant(): ComponentType<FeatureCardProps> {
  const discreteComponent = useVariant('featureCard', discreteVariant);
  const continuousComponent = useVariant('featureCard', continuousVariant);
  
  // Return discrete as default
  return discreteComponent;
} 