import { ComponentType } from 'react';
import { DiscreteFeatureCard } from './DiscreteFeatureCard';
import { ContinuousFeatureCard } from './ContinuousFeatureCard';
import { FeatureActivation, SteerFeatureResponse } from "@/types/features"
import { useTestBench } from '@/lib/testbench/useTestBench';
import { TestDefinition } from '@/lib/testbench/types';

// Shared interface for both variants
export interface FeatureCardProps {
  feature: FeatureActivation;
  onSteer?: (response: SteerFeatureResponse) => void;
  onFeatureModified?: () => void;
  modification?: number;
  readOnly?: boolean;
  variantId?: string;  // For model behavior modifications
  testId?: string;     // Only used by TestBench for UI component testing
}

const discreteTest: TestDefinition<FeatureCardProps> = {
  id: 'discrete',
  name: 'Discrete Controls',
  component: DiscreteFeatureCard
};

const continuousTest: TestDefinition<FeatureCardProps> = {
  id: 'continuous',
  name: 'Continuous Controls',
  component: ContinuousFeatureCard
};

export const featureCardTests = {
  discrete: discreteTest,
  continuous: continuousTest
};

export function useFeatureCardVariant(): ComponentType<FeatureCardProps> {
  const discreteComponent = useTestBench('featureCard', discreteTest);
  const continuousComponent = useTestBench('featureCard', continuousTest);
  
  return discreteComponent;
} 