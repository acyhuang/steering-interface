import type { UnifiedFeature, FilterOption, SortOption, SortOrder } from '@/types'
import FeatureTable from './FeatureTable'
import FeatureEditor from './FeatureEditor'
import FeatureTableHeader from './FeatureTableHeader'

interface ControlsProps {
  features: UnifiedFeature[]
  selectedFeature: UnifiedFeature | null
  onFeatureSelect: (feature: UnifiedFeature) => void
  onSteer: (featureUuid: string, value: number) => Promise<void>
  isLoading: boolean
  isDeveloperMode: boolean
  filterBy: FilterOption
  sortBy: SortOption
  sortOrder: SortOrder
  onFilterChange: (filter: FilterOption) => void
  onSortChange: (sort: SortOption) => void
  onSortOrderChange: (order: SortOrder) => void
}

export default function Controls({
  features,
  selectedFeature,
  onFeatureSelect,
  onSteer,
  isLoading,
  isDeveloperMode,
  filterBy,
  sortBy,
  sortOrder,
  onFilterChange,
  onSortChange,
  onSortOrderChange
}: ControlsProps) {
  return (
    <div className="h-full flex flex-col bg-background relative">
      {/* Debug Overlay */}
      {isDeveloperMode && (
        <div className="absolute top-2 right-2 z-10 bg-background/50 backdrop-blur-sm border rounded-lg p-2 text-xs text-muted-foreground shadow-sm">
          <div className="space-y-1">
            <div><strong>Features:</strong> {features.length}</div>
            <div><strong>Selected:</strong> {selectedFeature?.label || 'None'}</div>
            <div><strong>Loading:</strong> {isLoading ? 'Yes' : 'No'}</div>
            <div>
              <strong>Steering:</strong>{' '}
              {selectedFeature
                ? selectedFeature.pending_modification !== null
                  ? 'Pending'
                  : 'None'
                : 'None'}
            </div>
          </div>
        </div>
      )}
      
      <div className="p-3 border-b border-border">
        <div className="text-base font-mono uppercase font-medium">Controls</div>
      </div>
      
      <div className="flex-1 flex flex-col overflow-hidden p-2">
        {/* Unified Table Container */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Feature Table Header */}
          <div className="pb-2">
            <FeatureTableHeader
              filterBy={filterBy}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onFilterChange={onFilterChange}
              onSortChange={onSortChange}
              onSortOrderChange={onSortOrderChange}
            />
          </div>
          
          {/* Feature Table */}
          <div className="flex-1 overflow-auto rounded-md border border-border">
            <FeatureTable
              features={features}
              selectedFeature={selectedFeature}
              onFeatureSelect={onFeatureSelect}
              isLoading={isLoading}
            />
          </div>
          {/* Feature Editor */}
          <div className="border border-border rounded-md mt-2">
            <FeatureEditor
              feature={selectedFeature}
              onSteer={onSteer}
              isLoading={isLoading}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
