import { ComponentType } from 'react';
import { DiscreteFeatureCard } from './DiscreteFeatureCard';
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

const discreteVariant: VariantDefinition<FeatureCardProps> = {
  id: 'discrete',
  name: 'Discrete Controls',
  component: DiscreteFeatureCard
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

export function useFeatureCardVariant(): ComponentType<FeatureCardProps> {
  const discreteComponent = useVariant('featureCard', discreteVariant);
  const continuousComponent = useVariant('featureCard', continuousVariant);
  
  return discreteComponent;
} 