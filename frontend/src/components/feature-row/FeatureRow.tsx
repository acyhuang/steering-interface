import { FeatureActivation } from "@/types/features"

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
  // Use modifiedActivation with a fallback to 0
  const displayValue = feature.modifiedActivation !== undefined 
    ? feature.modifiedActivation 
    : 0;

  return (
    <div 
      className={`flex justify-between items-center p-2 hover:bg-gray-50 cursor-pointer ${
        isSelected ? 'bg-blue-50' : ''
      }`}
      onClick={() => onSelect(feature)}
      data-feature-id={feature.label}
    >
      <div className="text-sm">{feature.label}</div>
      <div className={`text-sm ${displayValue !== 0 ? 'text-blue-600 font-medium' : 'text-gray-500'}`}>
        {displayValue.toFixed(2)}
      </div>
    </div>
  );
} 