import { Button } from "../ui/button"
import { Card } from "../ui/card"
import { ChevronsUp, ChevronUp, ChevronDown, ChevronsDown } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { featuresApi } from "@/lib/api"
import { createLogger } from "@/lib/logger"
import { FeatureCardProps } from "./variants"
import { useFeatureActivations } from "@/contexts/FeatureActivationContext"
import { useVariant } from "@/contexts/VariantContext"

const logger = createLogger('DiscreteFeatureCard')

export function DiscreteFeatureCard({ 
  feature, 
  onSteer, 
  onFeatureModified, 
  readOnly,
}: FeatureCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { getFeatureActivation, activeFeatures, setActiveFeatures } = useFeatureActivations();
  const { variantId } = useVariant();
  const [modification, setModification] = useState<number | undefined>(undefined);
  
  // Get the current activation value for this feature
  const activation = getFeatureActivation(feature.label);

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
          value: value
        });

        // Update local modification state
        setModification(value);
        
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
      logger.error('Failed to modify feature:', { error: error instanceof Error ? error.message : String(error) });
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