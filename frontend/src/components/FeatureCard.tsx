import { Button } from "./ui/button"
import { Card } from "./ui/card"
import { FeatureActivation, SteerFeatureResponse } from "@/types/features"
import { featuresApi } from "@/lib/api"
import { useState } from "react"
import { Plus, Minus } from "lucide-react"
import { cn } from "@/lib/utils"

interface FeatureCardProps {
  feature: FeatureActivation;
  onSteer?: (response: SteerFeatureResponse) => void;
}

export function FeatureCard({ feature, onSteer }: FeatureCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [modification, setModification] = useState<number | null>(null);

  const handleSteer = async (value: number) => {
    if (isLoading) return;

    setIsLoading(true);
    try {
      const response = await featuresApi.steerFeature({
        session_id: "default_session", // TODO: Get from context
        feature_label: feature.label,
        value: value
      });

      setModification(value);
      onSteer?.(response);
    } catch (error) {
      console.error('Failed to steer feature:', error);
      // TODO: Add error handling UI
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card 
      className="p-4 relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => !modification && setIsHovered(false)}
    >
      <div className="flex justify-between items-center">
        <div className="flex-1">
          <div className="font-medium">{feature.label}</div>
          <div className="text-sm text-muted-foreground">
            Activation: {feature.activation.toFixed(2)}
          </div>
        </div>
        <div className={cn(
          "flex gap-2 transition-opacity duration-200",
          (!isHovered && !modification) && "opacity-0"
        )}>
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
      </div>
    </Card>
  );
} 