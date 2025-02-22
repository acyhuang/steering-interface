import { Card } from "../ui/card"
import { Slider } from "../ui/slider"
import { useState } from "react"
import { createLogger } from "@/lib/logger"
import { featuresApi } from "@/lib/api"
import { FeatureCardProps } from "./variants"

const logger = createLogger('ContinuousFeatureCard')

export function ContinuousFeatureCard({ 
  feature, 
  onSteer, 
  onFeatureModified 
}: FeatureCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [sliderValue, setSliderValue] = useState([0]); // Start at neutral position

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

      onSteer?.(response);
      onFeatureModified?.();
    } catch (error) {
      logger.error('Failed to steer feature:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div>
          <div className="font-medium">{feature.label}</div>
          <div className="text-sm text-muted-foreground">
            Activation: {feature.activation.toFixed(2)}
          </div>
          {sliderValue[0] !== 0 && (
            <div className="text-sm text-muted-foreground">
              Steering: {sliderValue[0].toFixed(2)}
            </div>
          )}
        </div>
        <Slider 
          value={sliderValue}
          min={-1}
          max={1}
          step={0.01}
          onValueChange={handleValueChange}
          onValueCommit={handleValueCommit}
          disabled={isLoading}
        />
      </div>
    </Card>
  );
} 