import { Button } from "../ui/button"
import { Card } from "../ui/card"
import { Plus, Minus } from "lucide-react"
import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { featuresApi } from "@/lib/api"
import { createLogger } from "@/lib/logger"
import { FeatureCardProps } from "./variants"
import { useFeatureModifications } from "@/contexts/FeatureContext"

const logger = createLogger('DiscreteFeatureCard')

export function DiscreteFeatureCard({ 
  feature, 
  onSteer, 
  onFeatureModified, 
  readOnly,
  variantId = "default",
  testId  // Keep testId for TestBench but don't use it for model operations
}: FeatureCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { getModification, setModification, clearModification } = useFeatureModifications();
  const modification = getModification(feature.label);

  const handleSteer = async (value: number) => {
    if (isLoading) return;

    setIsLoading(true);
    try {
      logger.debug('Steering feature', { 
        feature: feature.label, 
        value,
        variantId,
        currentModification: modification
      });

      // If clicking the same button that's already active, clear the feature
      if (modification === value) {
        const response = await featuresApi.clearFeature({
          session_id: variantId,
          variant_id: variantId,
          feature_label: feature.label
        });

        // Clear the modification in global state
        clearModification(feature.label);
        
        onSteer?.({ 
          label: response.label,
          activation: 0,
          modified_value: 0
        });
      } else {
        // Otherwise apply the new value
        const response = await featuresApi.steerFeature({
          session_id: variantId,
          variant_id: variantId,
          feature_label: feature.label,
          value: value
        });

        // Update global modification state
        setModification(feature.label, value);
        onSteer?.(response);
      }

      onFeatureModified?.();
    } catch (error) {
      logger.error('Failed to modify feature:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="p-4 relative">
      <div className="flex justify-between items-center">
        <div className="flex-1">
          <div className="font-medium">{feature.label}</div>
          {!readOnly && (
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
          )}
        </div>
        {!readOnly ? (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => handleSteer(-0.4)}
              disabled={isLoading}
              className={cn(
                "transition-colors",
                modification === -0.4 && "bg-red-100 hover:bg-red-200 border-red-200"
              )}
            >
              <Minus className={cn(
                "h-4 w-4",
                modification === -0.4 && "text-red-600"
              )} />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => handleSteer(0.4)}
              disabled={isLoading}
              className={cn(
                "transition-colors",
                modification === 0.4 && "bg-green-100 hover:bg-green-200 border-green-200"
              )}
            >
              <Plus className={cn(
                "h-4 w-4",
                modification === 0.4 && "text-green-600"
              )} />
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            {modification && (
              modification > 0 ? (
                <Plus className="h-4 w-4 text-green-600" />
              ) : (
                <Minus className="h-4 w-4 text-red-600" />
              )
            )}
          </div>
        )}
      </div>
    </Card>
  );
} 