import type { UnifiedFeature } from '@/types'
import FeatureTable from './FeatureTable'
import FeatureEditor from './FeatureEditor'

interface ControlsProps {
  features: UnifiedFeature[]
  selectedFeature: UnifiedFeature | null
  onFeatureSelect: (feature: UnifiedFeature) => void
  onSteer: (featureUuid: string, value: number) => Promise<void>
  isLoading: boolean
}

export default function Controls({
  features,
  selectedFeature,
  onFeatureSelect,
  onSteer,
  isLoading
}: ControlsProps) {
  return (
    <div className="h-full flex flex-col bg-background">
      <div className="p-4 border-b border-border">
        <div className="text-lg font-medium">Controls</div>
        <div className="text-sm text-muted-foreground">
          Features: {features.length} | Selected: {selectedFeature?.label || 'None'}
        </div>
      </div>
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Feature Table */}
        <div className="flex-1 overflow-hidden">
          <FeatureTable
            features={features}
            selectedFeature={selectedFeature}
            onFeatureSelect={onFeatureSelect}
            isLoading={isLoading}
          />
        </div>
        
        {/* Feature Editor */}
        <div className="border-t border-border">
          <FeatureEditor
            feature={selectedFeature}
            onSteer={onSteer}
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  )
}
