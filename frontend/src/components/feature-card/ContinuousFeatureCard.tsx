import { Card } from "../ui/card"
import { Slider } from "../ui/slider"
import { useState, useEffect } from "react"
import { createLogger } from "@/lib/logger"
import { featuresApi } from "@/lib/api"
import { FeatureCardProps } from "./variants"
import { useFeatureModifications } from "@/contexts/FeatureContext"

const logger = createLogger('ContinuousFeatureCard')

export function ContinuousFeatureCard({ 
  feature, 
  onSteer, 
  onFeatureModified,
  readOnly 
}: FeatureCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { getModification, setModification } = useFeatureModifications();
  
  // Initialize slider with existing modification or 0
  const [sliderValue, setSliderValue] = useState<number[]>(() => {
    const existingMod = getModification(feature.label);
    return [existingMod ?? 0];
  });

  // Update slider when modifications change externally
  useEffect(() => {
    const mod = getModification(feature.label);
    if (mod !== undefined && mod !== sliderValue[0]) {
      setSliderValue([mod]);
    }
  }, [feature.label, getModification]);

  const handleValueChange = async (newValue: number[]) => {
    setSliderValue(newValue);
  }

  const handleValueCommit = async (newValue: number[]) => {
    if (isLoading) return;

    setIsLoading(true);
    try {
      const steeringValue = newValue[0];
      logger.debug('Steering feature', { 
        feature: feature.label, 
        value: steeringValue 
      });

      const response = await featuresApi.steerFeature({
        session_id: "default_session",
        feature_label: feature.label,
        value: steeringValue
      });

      // Update global modification state
      setModification(feature.label, steeringValue);

      onSteer?.(response);
      onFeatureModified?.();
    } catch (error) {
      logger.error('Failed to steer feature:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const modification = getModification(feature.label);

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
            className={modification !== undefined ? "bg-blue-100" : ""}
          />
        )}
      </div>
    </Card>
  );
} 