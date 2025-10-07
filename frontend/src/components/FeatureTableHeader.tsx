import type { FilterOption, SortOption, SortOrder } from '@/types'
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Search } from "lucide-react"

interface FeatureTableHeaderProps {
  filterBy: FilterOption
  sortBy: SortOption
  sortOrder: SortOrder
  onFilterChange: (filter: FilterOption) => void
  onSortChange: (sort: SortOption) => void
  onSortOrderChange: (order: SortOrder) => void
  onSearchClick: () => void
  isSearching: boolean
}

export default function FeatureTableHeader({
  filterBy,
  sortBy: _sortBy,
  sortOrder: _sortOrder,
  onFilterChange,
  onSortChange: _onSortChange,
  onSortOrderChange: _onSortOrderChange,
  onSearchClick,
  isSearching,
}: FeatureTableHeaderProps) {


  return (
    <div className="flex items-center justify-between">
      {/* Filter Tabs */}
      <Tabs value={filterBy} onValueChange={(value) => onFilterChange(value as FilterOption)} className="w-auto">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger 
            value="activated"
            title="Features influencing the current conversation."
          >
            Activated
          </TabsTrigger>
          <TabsTrigger 
            value="modified"
            title="Features that are being strengthened or suppressed."
          >
            Modified
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Search Button */}
      <Button
        onClick={onSearchClick}
        variant="ghost"
        size="sm"
        disabled={isSearching}
      >
        <Search className="h-4 w-4" />
      </Button>

      {/* Combined Sort Select */}
      {/* <Select value={getCurrentSortValue()} onValueChange={handleSortChange}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Sort by..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="label-asc">Label (A-Z)</SelectItem>
          <SelectItem value="label-desc">Label (Z-A)</SelectItem>
          <SelectItem value="activation-desc">Activation (High)</SelectItem>
          <SelectItem value="activation-asc">Activation (Low)</SelectItem>
          <SelectItem value="modification-desc">Modification (High)</SelectItem>
          <SelectItem value="modification-asc">Modification (Low)</SelectItem>
        </SelectContent>
      </Select> */}
    </div>
  )
}
