import { useState } from 'react'
import type { UnifiedFeature, FilterOption, SortOption, SortOrder, SearchState } from '@/types'
import FeatureTable from './FeatureTable'
import FeatureEditor from './FeatureEditor'
import FeatureTableHeader from './FeatureTableHeader'
import SearchInput from './SearchInput'
import SearchResults from './SearchResults'
import { variantApi } from '@/services/api'
import { Switch } from './ui/switch'

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
  currentVariantId: string | null
  isAutoSteerEnabled: boolean
  onAutoSteerToggle: (enabled: boolean) => void
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
  onSortOrderChange,
  currentVariantId,
  isAutoSteerEnabled,
  onAutoSteerToggle
}: ControlsProps) {
  // Search state
  const [searchState, setSearchState] = useState<SearchState>({
    isSearching: false,
    query: '',
    results: [],
    isLoading: false
  })

  // Search functionality
  const handleSearchClick = () => {
    setSearchState(prev => ({
      ...prev,
      isSearching: true
    }))
  }

  const handleSearch = async (query: string) => {
    if (!currentVariantId) {
      console.error('No variant ID available for search')
      return
    }

    setSearchState(prev => ({ ...prev, query, isLoading: true }))

    try {
      // Always use API search
      const results = await variantApi.searchFeatures(currentVariantId, query, 20)
      setSearchState(prev => ({ ...prev, results, isLoading: false }))
    } catch (error) {
      console.error('Search failed:', error)
      setSearchState(prev => ({ ...prev, results: [], isLoading: false }))
    }
  }

  const handleSearchClose = () => {
    setSearchState({
      isSearching: false,
      query: '',
      results: [],
      isLoading: false
    })
  }
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
        <div className="items-center space-y-2">
          <div className="text-base font-mono uppercase font-medium">Controls</div>

          <div className={`flex items-center gap-2 border rounded-md p-2 transition-colors ${
            isAutoSteerEnabled 
              ? 'border-blue-200 bg-blue-50' 
              : 'border-border bg-muted/30'
          }`}>
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={isAutoSteerEnabled}
                onCheckedChange={onAutoSteerToggle}
              />
              <div className="">
                <span className={`text-sm font-medium pr-2 ${isAutoSteerEnabled ? 'text-blue-900' : 'text-muted-foreground'}`}>Auto-steer</span>
                <span className={`text-sm ${isAutoSteerEnabled ? 'text-blue-900' : 'text-muted-foreground'}`}> Automatically suggest features to steer based on query</span>
              </div>
            </label>
          </div>
        </div>
      </div>
      
      <div className="flex-1 flex flex-col overflow-hidden p-2">
        {/* Unified Table Container */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Search Input - replaces header when searching */}
          {searchState.isSearching ? (
            <div className="pb-2">
              <SearchInput
                onSearch={handleSearch}
                onClose={handleSearchClose}
                placeholder="Search across all features in the model"
                isLoading={searchState.isLoading}
              />
            </div>
          ) : (
            /* Feature Table Header - only show when not searching */
            <div className="pb-2">
              <FeatureTableHeader
                filterBy={filterBy}
                sortBy={sortBy}
                sortOrder={sortOrder}
                onFilterChange={onFilterChange}
                onSortChange={onSortChange}
                onSortOrderChange={onSortOrderChange}
                onSearchClick={handleSearchClick}
                isSearching={searchState.isSearching}
              />
            </div>
          )}
          
          {/* Feature Table or Search Results */}
          <div className="flex-1 overflow-auto rounded-md border border-border">
            {searchState.isSearching ? (
              <SearchResults
                results={searchState.results}
                selectedFeature={selectedFeature}
                onFeatureSelect={onFeatureSelect}
                onClose={handleSearchClose}
                isLoading={searchState.isLoading}
                query={searchState.query}
              />
            ) : (
              <FeatureTable
                features={features}
                selectedFeature={selectedFeature}
                onFeatureSelect={onFeatureSelect}
                isLoading={isLoading}
              />
            )}
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
