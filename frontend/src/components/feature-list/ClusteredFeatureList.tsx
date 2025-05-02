import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { FeatureListProps } from './variants';

export function ClusteredFeatureList({ 
  clusters, 
}: FeatureListProps) {
  // Create a simple replacement for the missing component
  const FeatureCardVariant = ({ feature }: any) => (
    <div className="p-2 border rounded">
      {feature.label || 'Unnamed feature'}
    </div>
  );
  
  // If there are no clusters, show a message
  if (!clusters || clusters.length === 0) {
    return (
      <div className="text-sm text-gray-500 p-4">
        No features available.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Accordion type="multiple">
        {clusters.map((cluster) => (
          <AccordionItem 
            key={cluster.name} 
            value={cluster.name}
            className="border rounded-md overflow-hidden mb-2"
          >
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{cluster.name}</span>
                  <Badge variant={cluster.type === "predefined" ? "default" : "secondary"}>
                    {cluster.features.length}
                  </Badge>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-3 pt-1">
              <div className="space-y-2">
                {cluster.features.map((feature, idx) => (
                  <FeatureCardVariant
                    key={`${cluster.name}-${idx}`}
                    feature={feature}
                  />
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
} 