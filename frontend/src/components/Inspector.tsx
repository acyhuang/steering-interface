import { Input } from "./ui/input"
import { Card } from "./ui/card"
import { ScrollArea } from "./ui/scroll-area"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs"
import { useState, useEffect, useCallback } from "react"
import { Search } from "lucide-react"
import { Button } from "./ui/button"
import { 
  FeatureActivation, 
  SteerFeatureResponse, 
  FeatureCluster,
  ClusteredFeaturesResponse 
} from "@/types/features"
import { featuresApi } from "@/lib/api"
import { useFeatureCardVariant } from './feature-card'
import { useFeatureListVariant } from './feature-list'
import { useLogger } from '@/lib/logger'

interface InspectorProps {
  features?: FeatureActivation[];
  isLoading?: boolean;
  variantId?: string;
}

interface FeatureEdit {
  feature_id: string;
  feature_label: string;
  index_in_sae: number;
  value: number;
}

interface VariantResponse {
  base_model: string;
  edits: FeatureEdit[];
  scopes: any[];
}

export function Inspector({ features, isLoading, variantId = "default" }: InspectorProps) {
  const logger = useLogger('Inspector')
  const [searchQuery, setSearchQuery] = useState("")
  const [localFeatures, setLocalFeatures] = useState(features || [])
  const [variantJson, setVariantJson] = useState<VariantResponse | null>(null)
  const [modifiedFeatures, setModifiedFeatures] = useState<FeatureActivation[]>([])
  const [isLoadingModified, setIsLoadingModified] = useState(false)
  const [selectedTab, setSelectedTab] = useState("activated")
  const [searchResults, setSearchResults] = useState<FeatureActivation[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [clusters, setClusters] = useState<FeatureCluster[]>([])
  const [isClusteringLoading, setIsClusteringLoading] = useState(false)
  
  const FeatureCardVariant = useFeatureCardVariant();
  const FeatureListVariant = useFeatureListVariant();

  // Log initial mount
  useEffect(() => {
    logger.debug('Inspector component mounted');
    return () => {
      logger.debug('Inspector component unmounted');
    };
  }, [logger]);

  // Log feature changes
  useEffect(() => {
    if (features) {
      logger.debug('Features updated', { 
        count: features.length,
        hasClusters: clusters.length > 0
      });
    }
  }, [features, clusters.length, logger]);

  // Log tab changes
  useEffect(() => {
    logger.debug('Tab changed', { selectedTab, variantId });
  }, [selectedTab, variantId, logger]);

  const fetchClusters = useCallback(async () => {
    if (!localFeatures || localFeatures.length === 0) return;
    
    setIsClusteringLoading(true);
    try {
      logger.debug('Fetching clusters for features', { featureCount: localFeatures.length });
      const response = await featuresApi.clusterFeatures(
        localFeatures,
        variantId,
        variantId,
        false
      );
      
      const clusteredFeatures = response?.clusters || [];
      setClusters(clusteredFeatures);
      
      logger.debug('Clusters updated', {
        count: clusteredFeatures.length,
        featuresCount: localFeatures.length
      });
    } catch (error) {
      logger.error('Failed to fetch clusters', { error });
      setClusters([]);
    } finally {
      setIsClusteringLoading(false);
    }
  }, [localFeatures, variantId, logger]);

  useEffect(() => {
    setLocalFeatures(features || [])
    
    // Only fetch clusters if we don't already have them for these features
    if (features && features.length > 0 && (!clusters || clusters.length === 0)) {
      fetchClusters();
    }
  }, [features, fetchClusters, clusters])

  const fetchVariantJson = useCallback(async () => {
    setIsLoadingModified(true)
    logger.debug('Fetching modified features for variant', { variantId });
    try {
      const response = await featuresApi.getModifiedFeatures(variantId);
      logger.debug('Received variant state', { response });
      setVariantJson(response);
      
      // Transform variant JSON into FeatureActivation format
      if (response && Array.isArray(response.edits)) {
        const features: FeatureActivation[] = response.edits.map((edit: FeatureEdit) => ({
          label: edit.feature_label,
          activation: typeof edit.value === 'number' ? edit.value : 0
        }));
        setModifiedFeatures(features);
      } else {
        setModifiedFeatures([]);
      }
    } catch (error) {
      logger.error('Failed to fetch variant state', { error });
      setModifiedFeatures([]);
    } finally {
      setIsLoadingModified(false)
    }
  }, [variantId, logger]);

  useEffect(() => {
    logger.debug('Tab or variant changed', { selectedTab, variantId });
    if (selectedTab === "modified") {
      fetchVariantJson();
    }
  }, [selectedTab, fetchVariantJson]);

  const handleSteer = async (response: SteerFeatureResponse) => {
    logger.debug('Handling steer response', { response });
    
    const steerRequest = {
      session_id: variantId,
      variant_id: variantId,
      feature_label: response.label,
      value: response.activation
    };
    logger.debug('Making steer request', { request: steerRequest });
    
    setLocalFeatures(current => 
      current.map(f => 
        f.label === response.label 
          ? { ...f, activation: response.activation }
          : f
      )
    );

    if (selectedTab === "modified") {
      logger.debug('On modified tab, fetching updated variant state');
      await fetchVariantJson();
    }

    // Regenerate the last message after steering
    // @ts-ignore
    if (window.regenerateLastMessage) {
      // @ts-ignore
      await window.regenerateLastMessage();
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    setShowSearchResults(true);
    
    try {
      logger.debug("Searching for features with query", { query: searchQuery });
      const results = await featuresApi.searchFeatures({
        query: searchQuery,
        session_id: variantId,
        variant_id: variantId,
        top_k: 10
      });
      
      logger.debug("Search results", { results });
      setSearchResults(results);
    } catch (error) {
      logger.error("Error searching features", { error });
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }

  const closeSearchResults = () => {
    setShowSearchResults(false);
  }

  const renderActivatedFeatures = () => {
    if (isLoading || isClusteringLoading) {
      return <div className="text-sm text-gray-500">Loading features...</div>;
    }

    if (!localFeatures || localFeatures.length === 0) {
      return (
        <div className="text-sm text-gray-500">
          No activated features. Start a conversation to see features in use.
        </div>
      );
    }

    return (
      <FeatureListVariant
        features={localFeatures}
        clusters={clusters}
        onSteer={handleSteer}
        variantId={variantId}
      />
    );
  };

  return (
    <Card className="h-full p-4">
      <div className="flex flex-col h-full gap-4">
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Feature Inspector</h2>
          <div className="flex gap-2">
            <Input
              placeholder="Search features..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearch()
                }
              }}
            />
            <Button onClick={handleSearch} type="submit">
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {showSearchResults && (
          <div className="relative">
            <Card className="absolute z-10 w-full shadow-lg flex flex-col" 
                  style={{ 
                    maxHeight: 'calc(100vh - 200px)', 
                    height: 'min(600px, 70vh)' 
                  }}>
              <div className="flex justify-between items-center p-4 border-b">
                <h3 className="font-medium">Search Results</h3>
                <Button variant="ghost" size="sm" onClick={closeSearchResults}>
                  ✕
                </Button>
              </div>
              
              <div className="flex-1 overflow-hidden">
                {isSearching ? (
                  <div className="text-sm text-gray-500 p-4">Searching...</div>
                ) : searchResults.length > 0 ? (
                  <ScrollArea className="h-full">
                    <div className="space-y-2 p-4">
                      {searchResults.map((feature, index) => (
                        <FeatureCardVariant
                          key={index}
                          feature={feature}
                          onSteer={handleSteer}
                          variantId={variantId}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-sm text-gray-500 p-4">
                    No features found for "{searchQuery}"
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        <Tabs 
          defaultValue="activated" 
          className="flex-1 flex flex-col min-h-0"
          value={selectedTab}
          onValueChange={setSelectedTab}
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="activated">Activated</TabsTrigger>
            <TabsTrigger value="suggested">Suggested</TabsTrigger>
            <TabsTrigger value="modified">Modified</TabsTrigger>
          </TabsList>

          <div className="flex-1 min-h-0 mt-4">
            <ScrollArea className="h-[calc(100vh-280px)]">
              <TabsContent value="activated" className="m-0">
                {renderActivatedFeatures()}
              </TabsContent>

              <TabsContent value="suggested" className="m-0">
                <div className="text-sm text-gray-500">
                  No suggested features available yet.
                </div>
              </TabsContent>

              <TabsContent value="modified" className="m-0">
                {isLoadingModified ? (
                  <div className="text-sm text-gray-500">Loading variant state...</div>
                ) : modifiedFeatures.length > 0 ? (
                  <div className="space-y-2 pr-4">
                    {modifiedFeatures.map((feature, index) => (
                      <FeatureCardVariant
                        key={index}
                        feature={feature}
                        onSteer={handleSteer}
                        variantId={variantId}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">
                    No modified features available.
                  </div>
                )}
              </TabsContent>
            </ScrollArea>
          </div>
        </Tabs>
      </div>
    </Card>
  );
} 