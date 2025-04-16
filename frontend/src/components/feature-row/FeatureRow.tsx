import { FeatureActivation } from "@/types/features"
import { useVariant } from "@/hooks/useVariant";

interface FeatureRowProps {
  feature: FeatureActivation;
  isSelected: boolean;
  onSelect: (feature: FeatureActivation) => void;
}

export function FeatureRow({ 
  feature,
  isSelected,
  onSelect
}: FeatureRowProps) {
  const { getFeatureModification } = useVariant();
  
  // Get modification value from context or fall back to feature's value or 0
  const modificationValue = getFeatureModification(feature.label);
  const displayValue = modificationValue !== null 
    ? modificationValue 
    : (feature.modifiedActivation !== undefined ? feature.modifiedActivation : 0);

  return (
    <div 
      className={`flex justify-between items-center p-2 hover:bg-gray-100 cursor-pointer rounded-md ${
        isSelected ? 'bg-blue-50' : ''
      } gap-4`}
      onClick={() => onSelect(feature)}
      data-feature-id={feature.label}
    >
      <div className="text-sm text-gray-700">{feature.label}</div>
      <div className={`text-sm ${displayValue !== 0 ? 'text-blue-600 font-medium' : 'text-gray-500'}`}>
        {displayValue.toFixed(1)}
      </div>
    </div>
  );
} 