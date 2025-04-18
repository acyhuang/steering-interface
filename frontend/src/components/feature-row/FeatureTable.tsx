import { useState, useEffect } from "react";
import { FeatureActivation, SteerFeatureResponse } from "@/types/steering/feature";
import { FeatureCluster } from "@/types/steering/cluster";
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
          <div key={cluster.name} >
            <div 
              className="flex items-center justify-between p-2 bg-gray-100 hover:bg-gray-200 cursor-pointer rounded-md"
              onClick={() => toggleCluster(cluster.name)}
            >
              <div className="text-xs uppercase font-medium text-gray-500">{cluster.name}</div>
              <div className="flex items-center">
                <div className="text-xs text-gray-400 mr-1">
                  {cluster.features.length}
                </div>
                {expandedClusters[cluster.name] ? (
                  <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
                )}
              </div>
            </div>
            
            {expandedClusters[cluster.name] && (
              <div className="mt-1 space-y-0.5">
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
    <div className="space-y-0.5">
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