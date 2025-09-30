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
      <div className="h-full p-4">
        <div>No features available</div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <div className="text-lg font-medium">Features ({features.length})</div>
      </div>
      
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Label</TableHead>
              <TableHead>Activation</TableHead>
              <TableHead>Modification</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {features.map((feature) => (
              <TableRow
                key={feature.uuid}
                className={`cursor-pointer hover:bg-muted/50 text-xs text-muted-foreground ${
                  selectedFeature?.uuid === feature.uuid ? 'bg-muted' : ''
                }`}
                onClick={() => onFeatureSelect(feature)}
              >
                <TableCell className="">{feature.label}</TableCell>
                <TableCell>{feature.activation !== null ? feature.activation.toFixed(1) : '-'}</TableCell>
                <TableCell>{feature.modification.toFixed(1)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
