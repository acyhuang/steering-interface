import { useState, useEffect } from "react";
import { Feature } from "@/types/domain";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { createLogger } from "@/lib/logger";
import { featuresApi } from "@/lib/api";
import { useVariant } from "@/hooks/useVariant";
import { X } from "lucide-react";

const logger = createLogger('FeatureEditor');

// Discrete values for the slider
const DISCRETE_VALUES = [-0.8, -0.4, 0, 0.4, 0.8];

interface FeatureEditorProps {
  feature: Feature | null;
  onSteer?: (steeredFeature: Feature) => void;
  onClose: () => void;
}

export function FeatureEditor({
  feature,
  onSteer,
  onClose
}: FeatureEditorProps) {
  const { variantId, applyPendingFeatures, getFeatureModification } = useVariant();
  const [isLoading, setIsLoading] = useState(false);
  
  // Initialize slider with modification value from context or 0
  const [sliderValue, setSliderValue] = useState<number[]>(() => {
    if (!feature) return [0];
    
    // Check context first, then fall back to component prop
    const contextValue = feature ? getFeatureModification(feature.label) : null;
    if (contextValue !== null) return [contextValue];
    
    return [feature.modification];
  });

  // Update slider when selected feature changes
  useEffect(() => {
    if (!feature) {
      setSliderValue([0]);
      return;
    }
    
    // Get modification from context first, then fall back to component prop
    const contextValue = getFeatureModification(feature.label);
    const value = contextValue !== null 
      ? contextValue
      : feature.modification;
    
    setSliderValue([value]);
  }, [feature, getFeatureModification]);

  if (!feature) return null;

  const handleValueChange = (newValue: number[]) => {
    // Find the closest discrete value
    const value = newValue[0];
    const closestDiscreteValue = DISCRETE_VALUES.reduce((prev, curr) => {
      return Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev;
    });
    
    setSliderValue([closestDiscreteValue]);
  };

  const handleSteer = async () => {
    if (isLoading || !feature) return;

    setIsLoading(true);
    try {
      const steeringValue = sliderValue[0];

      // First, apply the feature as a pending feature in VariantContext
      await applyPendingFeatures(feature.label, steeringValue);
      logger.debug('Applied pending feature for comparison', { 
        feature: feature.label, 
        value: steeringValue 
      });

      // If the slider is at 0, clear the feature
      if (steeringValue === 0) {
        await featuresApi.clearFeature(
          feature.label,
          "default_session",
          variantId
        );

        logger.debug('Feature cleared from the backend', { feature: feature.label });
        
        if (onSteer) {
          // Create updated feature with cleared modification
          const clearedFeature: Feature = {
            ...feature,
            modification: 0,
            isModified: false,
            hasPending: false
          };
          onSteer(clearedFeature);
        }
      } else {
        // Otherwise apply the new value to the backend
        const featureToSteer: Feature = {
          ...feature,
          pendingModification: steeringValue,
          hasPending: true
        };
        
        const steeredFeature = await featuresApi.steerFeature(
          featureToSteer,
          "default_session",
          variantId
        );

        logger.debug('Feature steered in the backend', { 
          feature: feature.label, 
          value: steeringValue 
        });
        
        if (onSteer) {
          onSteer(steeredFeature);
        }
      }
    } catch (error) {
      logger.error('Failed to modify feature:', { 
        error: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Get display value for current status from context first, then component prop
  const contextValue = getFeatureModification(feature.label);
  const currentValue = contextValue !== null 
    ? contextValue
    : feature.modification;

  return (
    <div className="pt-2 mt-1 border-t bg-inherit">
      <div className="space-y-3 px-2">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-medium">{feature.label}</h3>
              <div className="text-xs text-gray-500">
                Activation: {currentValue.toFixed(1)}
              </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="p-1 h-auto">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-500">
            <span>-0.8</span>
            <span>-0.4</span>
            <span>0</span>
            <span>0.4</span>
            <span>0.8</span>
          </div>
          <Slider 
            value={sliderValue}
            min={-0.8}
            max={0.8}
            step={0.05}
            onValueChange={handleValueChange}
            disabled={isLoading}
          />
        </div>

        <div className="flex justify-end">
          <Button 
            onClick={handleSteer} 
            disabled={isLoading || sliderValue[0] === currentValue}
            size="sm"
          >
            {isLoading ? "Applying..." : "Apply"}
          </Button>
        </div>
      </div>
    </div>
  );
} 