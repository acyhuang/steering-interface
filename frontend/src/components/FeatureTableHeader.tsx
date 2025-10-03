import type { FilterOption, SortOption, SortOrder } from '@/types'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"

interface FeatureTableHeaderProps {
  filterBy: FilterOption
  sortBy: SortOption
  sortOrder: SortOrder
  onFilterChange: (filter: FilterOption) => void
  onSortChange: (sort: SortOption) => void
  onSortOrderChange: (order: SortOrder) => void
}

export default function FeatureTableHeader({
  filterBy,
  sortBy,
  sortOrder,
  onFilterChange,
  onSortChange,
  onSortOrderChange,
}: FeatureTableHeaderProps) {

  // Helper function to handle combined sort selection
  const handleSortChange = (value: string) => {
    switch (value) {
      case 'label-asc':
        onSortChange('label')
        onSortOrderChange('asc')
        break
      case 'label-desc':
        onSortChange('label')
        onSortOrderChange('desc')
        break
      case 'activation-desc':
        onSortChange('activation')
        onSortOrderChange('desc')
        break
      case 'activation-asc':
        onSortChange('activation')
        onSortOrderChange('asc')
        break
      case 'modification-desc':
        onSortChange('modification')
        onSortOrderChange('desc')
        break
      case 'modification-asc':
        onSortChange('modification')
        onSortOrderChange('asc')
        break
    }
  }

  // Helper function to get current combined sort value
  const getCurrentSortValue = () => {
    return `${sortBy}-${sortOrder}`
  }

  return (
    <div className="flex items-center gap-4">
      {/* Filter Tabs */}
      <Tabs value={filterBy} onValueChange={(value) => onFilterChange(value as FilterOption)} className="w-auto">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="activated">Activated</TabsTrigger>
          <TabsTrigger value="modified">Modified</TabsTrigger>
        </TabsList>
      </Tabs>

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
