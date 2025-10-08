import type { UnifiedFeature } from '@/types'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface FeatureTableProps {
  features: UnifiedFeature[]
  selectedFeature: UnifiedFeature | null
  onFeatureSelect: (feature: UnifiedFeature) => void
  isLoading: boolean
}

export default function FeatureTable({
  features,
  selectedFeature,
  onFeatureSelect,
  isLoading
}: FeatureTableProps) {
  if (isLoading) {
    return (
      <div className="h-full p-4">
        <div>Loading features...</div>
      </div>
    )
  }

  if (features.length === 0) {
    return (
      <div className="h-full p-4 text-center text-muted-foreground justify-center">
        <div>No features available</div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto">
      <Table className="table-fixed w-full">
        <TableHeader className="sticky top-0 z-10 bg-muted border-b border-border">
          <TableRow className="text-xs hover:bg-transparent">
            <TableHead className="w-auto">Label</TableHead>
            <TableHead className="w-24 text-right">Activation</TableHead>
            <TableHead className="w-24 text-right">Modification</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {features.map((feature) => (
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
              <TableCell className="font-mono text-right w-20">
                {feature.activation !== null ? feature.activation.toFixed(1) : '-'}
              </TableCell>
              <TableCell className={`font-mono text-right w-20${feature.modification !== 0 ? " font-bold text-foreground" : ""}`}>
                {feature.modification.toFixed(1)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
