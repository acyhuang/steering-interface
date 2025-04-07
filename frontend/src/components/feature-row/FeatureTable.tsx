import { useState, useEffect } from "react";
import { FeatureActivation, FeatureCluster, SteerFeatureResponse } from "@/types/features";
import { FeatureRow } from "./FeatureRow";
import { ChevronDown, ChevronRight } from "lucide-react";

interface FeatureTableProps {
  features: FeatureActivation[];
  clusters?: FeatureCluster[];
  selectedFeature: FeatureActivation | null;
  onSelectFeature: (feature: FeatureActivation) => void;
  onSteer?: (response: SteerFeatureResponse) => void;
}

export function FeatureTable({
  features,
  clusters,
  selectedFeature,
  onSelectFeature,
  onSteer
}: FeatureTableProps) {
  // Track which clusters are expanded
  const [expandedClusters, setExpandedClusters] = useState<Record<string, boolean>>({});

  // By default, expand all clusters
  useEffect(() => {
    if (clusters && clusters.length > 0) {
      const initialExpanded: Record<string, boolean> = {};
      clusters.forEach(cluster => {
        initialExpanded[cluster.name] = true; // Start with all expanded
      });
      setExpandedClusters(initialExpanded);
    }
  }, [clusters]);

  const toggleCluster = (clusterName: string) => {
    setExpandedClusters(prev => ({
      ...prev,
      [clusterName]: !prev[clusterName]
    }));
  };

  // If clusters are provided, render in clustered view
  if (clusters && clusters.length > 0) {
    return (
      <div className="space-y-1">
        {clusters.map((cluster) => (
          <div key={cluster.name} className="border rounded-md overflow-hidden">
            <div 
              className="flex items-center p-2 bg-gray-50 cursor-pointer"
              onClick={() => toggleCluster(cluster.name)}
            >
              {expandedClusters[cluster.name] ? (
                <ChevronDown className="h-4 w-4 mr-2" />
              ) : (
                <ChevronRight className="h-4 w-4 mr-2" />
              )}
              <div className="font-medium">{cluster.name}</div>
              <div className="ml-2 text-xs text-gray-500">
                ({cluster.features.length})
              </div>
            </div>
            
            {expandedClusters[cluster.name] && (
              <div className="border-t divide-y divide-gray-100">
                {cluster.features.map((feature) => (
                  <FeatureRow
                    key={feature.label}
                    feature={feature}
                    isSelected={selectedFeature?.label === feature.label}
                    onSelect={onSelectFeature}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  // Otherwise render flat list
  return (
    <div className="border rounded-md overflow-hidden divide-y divide-gray-100">
      {features.map((feature) => (
        <FeatureRow
          key={feature.label}
          feature={feature}
          isSelected={selectedFeature?.label === feature.label}
          onSelect={onSelectFeature}
        />
      ))}
    </div>
  );
} 