import { useFeatureCardVariant } from '../feature-card';
import { FeatureListProps } from './variants';

export function UnclusteredFeatureList({ 
  features,
  onSteer, 
  variantId 
}: FeatureListProps) {
  const FeatureCardVariant = useFeatureCardVariant();
  
  if (!features || features.length === 0) {
    return (
      <div className="text-sm text-gray-500 p-4">
        No features available.
      </div>
    );
  }

  return (
    <div className="space-y-2 pr-4">
      {features.map((feature, index) => (
        <FeatureCardVariant
          key={index} 
          feature={feature}
          onSteer={onSteer}
          variantId={variantId}
        />
      ))}
    </div>
  );
} 