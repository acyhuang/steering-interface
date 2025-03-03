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
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"

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

  const fetchClusters = useCallback(async () => {
    if (!localFeatures || localFeatures.length === 0) return;
    
    setIsClusteringLoading(true);
    try {
      console.log('[INSPECTOR_DEBUG] Fetching clusters for features:', localFeatures.length);
      const response = await featuresApi.clusterFeatures(
        localFeatures,
        variantId,
        variantId,
        false
      );
      
      console.log('[INSPECTOR_DEBUG] Raw API response:', response);
      
      // Extract the clusters array from the response
      const clusteredFeatures = response?.clusters || [];
      
      console.log('[INSPECTOR_DEBUG] Extracted clusters:', {
        isArray: Array.isArray(clusteredFeatures),
        length: clusteredFeatures?.length,
        firstCluster: clusteredFeatures?.[0],
        hasFeatures: clusteredFeatures?.[0]?.features?.length > 0
      });
      
      setClusters(clusteredFeatures);
    } catch (error) {
      console.error('[INSPECTOR_DEBUG] Failed to fetch clusters:', error);
      setClusters([]);
    } finally {
      setIsClusteringLoading(false);
    }
  }, [localFeatures, variantId]);

  useEffect(() => {
    setLocalFeatures(features || [])
    
    // Fetch clusters whenever features change
    if (features && features.length > 0) {
      fetchClusters();
    }
  }, [features, fetchClusters])

  const fetchVariantJson = useCallback(async () => {
    setIsLoadingModified(true)
    console.log('[INSPECTOR_DEBUG] Fetching modified features for variant:', variantId);
    try {
      const response = await featuresApi.getModifiedFeatures(variantId);
      console.log('[INSPECTOR_DEBUG] Received variant state:', response);
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
      console.error('[INSPECTOR_DEBUG] Failed to fetch variant state:', error);
      setModifiedFeatures([]);
    } finally {
      setIsLoadingModified(false)
    }
  }, [variantId]);

  useEffect(() => {
    console.log('[INSPECTOR_DEBUG] Tab or variant changed - selectedTab:', selectedTab, 'variantId:', variantId);
    if (selectedTab === "modified") {
      fetchVariantJson();
    }
  }, [selectedTab, fetchVariantJson]);

  const handleSteer = async (response: SteerFeatureResponse) => {
    console.log('[INSPECTOR_DEBUG] Handling steer response:', response);
    
    const steerRequest = {
      session_id: variantId,
      variant_id: variantId,
      feature_label: response.label,
      value: response.activation
    };
    console.log('[INSPECTOR_DEBUG] Making steer request with:', steerRequest);
    
    setLocalFeatures(current => 
      current.map(f => 
        f.label === response.label 
          ? { ...f, activation: response.activation }
          : f
      )
    );

    if (selectedTab === "modified") {
      console.log('[INSPECTOR_DEBUG] On modified tab, fetching updated variant state');
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
      console.log("Searching for features with query:", searchQuery);
      const results = await featuresApi.searchFeatures({
        query: searchQuery,
        session_id: variantId,
        variant_id: variantId,
        top_k: 10
      });
      
      console.log("Search results:", results);
      setSearchResults(results);
    } catch (error) {
      console.error("Error searching features:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }

  const closeSearchResults = () => {
    setShowSearchResults(false);
  }

  const renderActivatedFeatures = () => {
    console.log('[INSPECTOR_DEBUG] Rendering activated features:', {
      isLoading,
      isClusteringLoading,
      hasClusters: clusters && clusters.length > 0,
      clustersLength: clusters?.length,
      localFeaturesLength: localFeatures?.length
    });

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

    if (clusters && clusters.length > 0) {
      console.log('[INSPECTOR_DEBUG] Rendering clusters view with:', {
        numClusters: clusters.length,
        clusterNames: clusters.map(c => c.name),
        totalFeatures: clusters.reduce((acc, c) => acc + c.features.length, 0)
      });
      return (
        <div className="space-y-2">
          <Accordion 
            type="multiple" 
            className="space-y-2"
          >
            {clusters.map((cluster) => (
              <AccordionItem 
                key={cluster.name} 
                value={cluster.name}
                className="border rounded-md overflow-hidden"
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
                        onSteer={handleSteer}
                        variantId={variantId}
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

    console.log('[INSPECTOR_DEBUG] Falling back to unclustered view:', {
      reason: 'Clusters condition failed',
      clusters,
      clustersLength: clusters?.length
    });
    
    // Fallback to unclustered view if clustering failed
    return (
      <div className="space-y-2 pr-4">
        {localFeatures.map((feature, index) => (
          <FeatureCardVariant
            key={index} 
            feature={feature}
            onSteer={handleSteer}
            variantId={variantId}
          />
        ))}
      </div>
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