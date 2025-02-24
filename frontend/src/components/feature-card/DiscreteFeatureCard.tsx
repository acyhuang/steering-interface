import { Button } from "../ui/button"
import { Card } from "../ui/card"
import { ChevronsUp, ChevronUp, ChevronDown, ChevronsDown } from "lucide-react"
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

  // Helper function to determine button styling
  const getButtonStyle = (value: number) => {
    const isActive = modification === value;
    const isNegative = value < 0;
    
    return cn(
      "transition-colors",
      isActive && isNegative && "bg-red-100 hover:bg-red-200 border-red-200",
      isActive && !isNegative && "bg-green-100 hover:bg-green-200 border-green-200"
    );
  };

  // Helper function to determine icon styling
  const getIconStyle = (value: number) => {
    const isActive = modification === value;
    const isNegative = value < 0;
    
    return cn(
      "h-4 w-4",
      isActive && isNegative && "text-red-600",
      isActive && !isNegative && "text-green-600"
    );
  };

  return (
    <Card className="p-2.5 relative">
      <div className="flex justify-between items-start">
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
          <div className="flex flex-col gap-0.5 ml-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => handleSteer(0.8)}
              disabled={isLoading}
              className={cn(getButtonStyle(0.8), "h-7 w-7")}
            >
              <ChevronsUp className={cn(getIconStyle(0.8), "h-4 w-4")} />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => handleSteer(0.4)}
              disabled={isLoading}
              className={cn(getButtonStyle(0.4), "h-7 w-7")}
            >
              <ChevronUp className={cn(getIconStyle(0.4), "h-4 w-4")} />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => handleSteer(-0.4)}
              disabled={isLoading}
              className={cn(getButtonStyle(-0.4), "h-7 w-7")}
            >
              <ChevronDown className={cn(getIconStyle(-0.4), "h-4 w-4")} />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => handleSteer(-0.8)}
              disabled={isLoading}
              className={cn(getButtonStyle(-0.8), "h-7 w-7")}
            >
              <ChevronsDown className={cn(getIconStyle(-0.8), "h-4 w-4")} />
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            {modification && (
              modification > 0 ? (
                modification >= 0.8 ? (
                  <ChevronsUp className="h-4 w-4 text-green-600" />
                ) : (
                  <ChevronUp className="h-4 w-4 text-green-600" />
                )
              ) : (
                modification <= -0.8 ? (
                  <ChevronsDown className="h-4 w-4 text-red-600" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-red-600" />
                )
              )
            )}
          </div>
        )}
      </div>
    </Card>
  );
} 