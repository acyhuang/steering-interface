import { ComponentType } from 'react';
import { FeatureActivation, SteerFeatureResponse } from "@/types/steering/feature";
import { FeatureCluster } from "@/types/steering/cluster";
import { useTestBench } from '@/lib/testbench/useTestBench';
import { TestDefinition } from '@/lib/testbench/types';
import { ClusteredFeatureList } from './ClusteredFeatureList';
import { UnclusteredFeatureList } from './UnclusteredFeatureList';

// Shared interface for both variants
export interface FeatureListProps {
  features: FeatureActivation[];
  clusters?: FeatureCluster[];
  onSteer?: (response: SteerFeatureResponse) => void;
  variantId?: string;
}

const clusteredTest: TestDefinition<FeatureListProps> = {
  id: 'clustered',
  name: 'Clustered View',
  component: ClusteredFeatureList
};

const uncluseredTest: TestDefinition<FeatureListProps> = {
  id: 'unclustered',
  name: 'Flat List View',
  component: UnclusteredFeatureList
};

export const featureListTests = {
  clustered: clusteredTest,
  unclustered: uncluseredTest
};

export function useFeatureListVariant(): ComponentType<FeatureListProps> {
  const clusteredComponent = useTestBench('featureList', clusteredTest);
  const uncluseredComponent = useTestBench('featureList', uncluseredTest);
  
  return clusteredComponent;
} 