import { FeatureListProps } from './variants';

export function UnclusteredFeatureList({ 
  features
}: FeatureListProps) {
  const FeatureCardVariant = ({ feature }: any) => (
    <div className="p-2 border rounded">
      {feature.label || 'Unnamed feature'}
    </div>
  );
  
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
        />
      ))}
    </div>
  );
} 