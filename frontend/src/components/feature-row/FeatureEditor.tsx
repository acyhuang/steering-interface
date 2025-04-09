import { useState, useEffect } from "react";
import { FeatureActivation, SteerFeatureResponse } from "@/types/features";
import { Slider } from "../ui/slider";
import { Button } from "../ui/button";
import { createLogger } from "@/lib/logger";
import { featuresApi } from "@/lib/api";
import { useVariant } from "@/contexts/VariantContext";
import { X } from "lucide-react";

const logger = createLogger('FeatureEditor');

// Declare the global window interface for regenerateLastMessage
declare global {
  interface Window {
    regenerateLastMessage: () => Promise<void>;
  }
}

// Discrete values for the slider
const DISCRETE_VALUES = [-0.8, -0.4, 0, 0.4, 0.8];

interface FeatureEditorProps {
  feature: FeatureActivation | null;
  onSteer?: (response: SteerFeatureResponse) => void;
  onClose: () => void;
}

export function FeatureEditor({
  feature,
  onSteer,
  onClose
}: FeatureEditorProps) {
  const { variantId, applyPendingFeatures } = useVariant();
  const [isLoading, setIsLoading] = useState(false);
  
  // Initialize slider with modifiedActivation or 0
  const [sliderValue, setSliderValue] = useState<number[]>(() => {
    if (!feature) return [0];
    return feature.modifiedActivation !== undefined ? [feature.modifiedActivation] : [0];
  });

  // Update slider when selected feature changes
  useEffect(() => {
    if (!feature) {
      setSliderValue([0]);
      return;
    }
    
    const value = feature.modifiedActivation !== undefined ? feature.modifiedActivation : 0;
    setSliderValue([value]);
  }, [feature]);

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
        const response = await featuresApi.clearFeature({
          session_id: "default_session",
          variant_id: variantId,
          feature_label: feature.label
        });

        logger.debug('Feature cleared from the backend', { feature: feature.label });
        
        if (onSteer) {
          onSteer({ 
            label: response.label,
            activation: 0,
            modified_value: 0
          });
        }
      } else {
        // Otherwise apply the new value to the backend
        const response = await featuresApi.steerFeature({
          session_id: "default_session",
          variant_id: variantId,
          feature_label: feature.label,
          value: steeringValue
        });

        logger.debug('Feature steered in the backend', { 
          feature: feature.label, 
          value: steeringValue 
        });
        
        if (onSteer) {
          onSteer(response);
        }
      }

      // Trigger regeneration to get the steered response
      if (window.regenerateLastMessage) {
        logger.debug('Triggering regeneration for comparison');
        await window.regenerateLastMessage();
      }
    } catch (error) {
      logger.error('Failed to modify feature:', { 
        error: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Get display value for current status
  const currentValue = feature.modifiedActivation !== undefined ? feature.modifiedActivation : 0;

  return (
    <div className="pt-2 mt-1 border-t bg-background">
      <div className="space-y-3 px-2">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-medium">{feature.label}</h3>
              <div className="text-xs text-gray-500">
                Activation: {(feature.modifiedActivation ?? 0).toFixed(1)}
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