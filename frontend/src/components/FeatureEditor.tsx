import { useState, useEffect } from 'react'
import type { UnifiedFeature } from '@/types'
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"

interface FeatureEditorProps {
  feature: UnifiedFeature | null
  onSteer: (featureUuid: string, value: number) => Promise<void>
  isLoading: boolean
}

export default function FeatureEditor({
  feature,
  onSteer,
  isLoading
}: FeatureEditorProps) {
  // Convert modification (-1 to 1) to slider value (0-10)
  const modificationToSlider = (modification: number) => (modification / 0.2) + 5
  
  const [sliderValue, setSliderValue] = useState<number[]>([5]) // Default to 0.0 modification

  // Update slider when feature changes
  useEffect(() => {
    if (feature) {
      setSliderValue([modificationToSlider(feature.pending_modification !== null ? feature.pending_modification : feature.modification)])
    }
  }, [feature])

  if (!feature) {
    return (
      <div className="text-base text-center text-muted-foreground p-4">
        <div>No feature selected</div>
      </div>
    )
  }

  // Convert slider value (0-10) to actual value (-1 to 1)
  const actualValue = (sliderValue[0] - 5) * 0.2
  
  const handleSteer = async () => {
    await onSteer(feature.uuid, actualValue)
  }

  return (
    <div className="p-3 space-y-2">
      <div className="text-base font-medium">{feature.label}</div>
      {/* <div className="space-y-2 text-sm flex gap-4 text-muted-foreground">
        <p>Activation: {feature.activation !== null ? feature.activation.toFixed(1) : '-'}</p>
        <p>Current Modification: {feature.modification.toFixed(1)}</p>
        <p>Pending: {feature.pending_modification !== null ? feature.pending_modification.toFixed(1) : '-'}</p>
      </div> */}

      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium">
            Value: {actualValue.toFixed(1)}
          </label>
          <div className="mt-2">
            <Slider
              value={sliderValue}
              onValueChange={setSliderValue}
              max={10}
              min={0}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>-1.0</span>
              <span>0.0</span>
              <span>1.0</span>
            </div>
          </div>
        </div>

        <Button 
          onClick={handleSteer} 
          disabled={isLoading}
          variant="default"
          className="w-full"
        >
          {isLoading ? 'Steering...' : 'Steer Feature'}
        </Button>
      </div>
    </div>
  )
}
