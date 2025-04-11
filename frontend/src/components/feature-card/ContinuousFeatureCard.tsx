import { Card } from "../ui/card"
import { Slider } from "../ui/slider"
import { useState, useEffect } from "react"
import { createLogger } from "@/lib/logger"
import { featuresApi } from "@/lib/api"
import { FeatureCardProps } from "./variants"
import { useFeatureActivations } from "@/contexts/ActivatedFeatureContext"
import { useVariant } from "@/contexts/VariantContext"

const logger = createLogger('ContinuousFeatureCard')

export function ContinuousFeatureCard({ 
  feature, 
  onSteer, 
  onFeatureModified,
  readOnly
}: FeatureCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { getFeatureActivation, activeFeatures, setActiveFeatures } = useFeatureActivations();
  const { variantId } = useVariant();
  const [modification, setModification] = useState<number | undefined>(undefined);
  
  // Initialize slider with existing activation or 0 (neutral position)
  const [sliderValue, setSliderValue] = useState<number[]>(() => {
    const existingActivation = getFeatureActivation(feature.label);
    return [existingActivation ?? 0]; // Default to 0 if no activation exists
  });

  // Update slider when activations change externally
  useEffect(() => {
    const activation = getFeatureActivation(feature.label);
    if (activation !== undefined) {
      setSliderValue([activation]);
      setModification(activation);
    } else {
      setSliderValue([0]); // Reset to neutral position when activation is not found
      setModification(undefined);
    }
  }, [feature.label, getFeatureActivation]);

  const handleValueChange = async (newValue: number[]) => {
    setSliderValue(newValue);
  }

  const handleValueCommit = async (newValue: number[]) => {
    if (isLoading) return;

    setIsLoading(true);
    try {
      const steeringValue = newValue[0];
      logger.debug('Committing feature value', { 
        feature: feature.label, 
        value: steeringValue,
        variantId
      });

      // If the slider is at 0, clear the feature
      if (steeringValue === 0) {
        const response = await featuresApi.clearFeature({
          session_id: "default_session",
          variant_id: variantId,
          feature_label: feature.label
        });

        // Clear the modification in local state
        setModification(undefined);
        
        // Update the active features list by removing or updating this feature
        setActiveFeatures(
          activeFeatures.map(f => 
            f.label === feature.label 
              ? { ...f, activation: 0 } 
              : f
          )
        );
        
        onSteer?.({ 
          label: response.label,
          activation: 0,
          modified_value: 0
        });
      } else {
        // Otherwise apply the new value
        const response = await featuresApi.steerFeature({
          session_id: "default_session",
          variant_id: variantId,
          feature_label: feature.label,
          value: steeringValue
        });

        // Update local modification state
        setModification(steeringValue);
        
        // Update active features list with the new value
        const updatedFeatures = [...activeFeatures];
        const existingIndex = updatedFeatures.findIndex(f => f.label === feature.label);
        
        if (existingIndex >= 0) {
          updatedFeatures[existingIndex] = {
            ...updatedFeatures[existingIndex],
            activation: response.activation
          };
        } else {
          updatedFeatures.push({
            label: feature.label,
            activation: response.activation
          });
        }
        
        setActiveFeatures(updatedFeatures);
        onSteer?.(response);
      }

      onFeatureModified?.();
    } catch (error) {
      // Fix the logger.error call to properly handle unknown error type
      logger.error('Failed to modify feature:', { error: error instanceof Error ? error.message : String(error) });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div>
          <div className="font-medium">{feature.label}</div>
          {!readOnly ? (
            <>
              <div className="text-sm text-muted-foreground">
                Base Activation: {feature.activation.toFixed(2)}
              </div>
              {modification !== undefined && (
                <div className="text-sm text-blue-600">
                  Modified: {modification.toFixed(2)}
                </div>
              )}
            </>
          ) : (
            <div className="text-sm text-blue-600">
              Value: {feature.activation.toFixed(2)}
            </div>
          )}
        </div>
        {!readOnly && (
          <Slider 
            value={sliderValue}
            min={-1}
            max={1}
            step={0.05}
            onValueChange={handleValueChange}
            onValueCommit={handleValueCommit}
            disabled={isLoading}
          />
        )}
      </div>
    </Card>
  );
} 