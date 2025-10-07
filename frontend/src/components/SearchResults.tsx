import type { UnifiedFeature } from '@/types'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"

interface SearchResultsProps {
  results: UnifiedFeature[]
  selectedFeature: UnifiedFeature | null
  onFeatureSelect: (feature: UnifiedFeature) => void
  onClose: () => void
  isLoading: boolean
  query: string
}

export default function SearchResults({
  results,
  selectedFeature,
  onFeatureSelect,
  onClose,
  isLoading,
  query
}: SearchResultsProps) {
  if (isLoading) {
    return (
      <div className="h-full p-4">
        <div>Searching for "{query}"</div>
      </div>
    )
  }

  if (results.length === 0) {
    return (
      <div className="h-full p-4">
        <div className="text-muted-foreground">
          No features found for "{query}". Try a different search term.
        </div>
      </div>
    )
  }

  return (
    <div className="h-full">
      <div className="h-full overflow-auto">
        <Table className="table-fixed w-full">
          <TableHeader className="sticky top-0 z-10 bg-muted border-b border-border">
            <TableRow className="text-xs hover:bg-transparent">
              <TableHead className="w-auto">Top {results.length} search results for "{query}"</TableHead>
              {/* <TableHead className="w-24 text-right">Activation</TableHead>
              <TableHead className="w-24 text-right">Modification</TableHead> */}
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((feature) => (
              <TableRow
                key={feature.uuid}
                className={`cursor-pointer hover:bg-muted/50 text-sm text-muted-foreground ${
                  selectedFeature?.uuid === feature.uuid ? 'bg-muted' : ''
                }`}
                onClick={() => onFeatureSelect(feature)}
              >
                <TableCell className="truncate max-w-0" title={feature.label}>
                  {feature.label}
                </TableCell>
                {/* <TableCell className="font-mono text-right w-20">
                  {feature.activation !== null ? feature.activation.toFixed(1) : '-'}
                </TableCell>
                <TableCell className={`font-mono text-right w-20${feature.modification !== 0 ? " font-medium text-foreground" : ""}`}>
                  {feature.modification.toFixed(1)}
                </TableCell> */}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
