import { Input } from "./ui/input"
import { Card } from "./ui/card"
import { ScrollArea } from "./ui/scroll-area"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs"
import { useState, useEffect, useRef } from "react"
import { Search } from "lucide-react"
import { Button } from "./ui/button"
import { 
  FeatureActivation, 
  SteerFeatureResponse, 
  FeatureCluster
} from "@/types/features"
import { featuresApi } from "@/lib/api"
import { useFeatureCardVariant } from './feature-card'
import { useFeatureListVariant } from './feature-list'
import { useLogger } from '@/lib/logger'
import { useFeatureActivations } from '@/contexts/FeatureActivationContext'
import { useVariant } from '@/contexts/VariantContext'

interface ControlsProps {
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

export function Controls({ variantId = "default" }: ControlsProps) {
  const logger = useLogger('Controls')
  const { activeFeatures, featureClusters, isLoading } = useFeatureActivations();
  const { variantJson, refreshVariant } = useVariant();
  const [searchQuery, setSearchQuery] = useState("")
  const [modifiedFeatures, setModifiedFeatures] = useState<FeatureActivation[]>([])
  const [isLoadingModified, setIsLoadingModified] = useState(false)
  const [selectedTab, setSelectedTab] = useState("activated")
  const [searchResults, setSearchResults] = useState<FeatureActivation[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const refreshInProgressRef = useRef(false);
  
  const FeatureCardVariant = useFeatureCardVariant();
  const FeatureListVariant = useFeatureListVariant();

  // Process variantJson into modifiedFeatures when it changes
  useEffect(() => {
    if (variantJson) {
      setIsLoadingModified(true);
      
      try {
        // Transform variant JSON into FeatureActivation format
        if (variantJson && Array.isArray(variantJson.edits)) {
          const features: FeatureActivation[] = variantJson.edits.map((edit: FeatureEdit) => ({
            label: edit.feature_label,
            activation: typeof edit.value === 'number' ? edit.value : 0
          }));
          setModifiedFeatures(features);
        } else {
          setModifiedFeatures([]);
        }
      } catch (error) {
        logger.error('Failed to process variant JSON', { error });
        setModifiedFeatures([]);
      } finally {
        setIsLoadingModified(false);
        refreshInProgressRef.current = false;
      }
    }
  }, [variantJson, logger]);

  // Only refresh data when tab changes to "modified"
  useEffect(() => {
    const fetchData = async () => {
      if (selectedTab === "modified" && !refreshInProgressRef.current) {
        refreshInProgressRef.current = true;
        logger.debug('Loading modified features tab data');
        await refreshVariant();
      }
    };

    fetchData();
  }, [selectedTab]); // Deliberately exclude refreshVariant to prevent infinite loops

  const handleSteer = async (response: SteerFeatureResponse) => {
    logger.debug('Handling steer response', { response });
    
    const steerRequest = {
      session_id: "default_session",
      variant_id: variantId,
      feature_label: response.label,
      value: response.activation
    };
    logger.debug('Making steer request', { request: steerRequest });
    
    try {
      // Make the actual API call to steer the feature
      await featuresApi.steerFeature(steerRequest);
      logger.debug('Feature steering successful', { 
        feature: response.label, 
        value: response.activation 
      });
      
      if (selectedTab === "modified") {
        logger.debug('On modified tab, refreshing variant data');
        refreshInProgressRef.current = true;
        await refreshVariant();
      }

      // Regenerate the last message after steering
      // @ts-ignore
      if (window.regenerateLastMessage) {
        // @ts-ignore
        await window.regenerateLastMessage();
      }
    } catch (error) {
      logger.error('Failed to steer feature', { 
        error: error instanceof Error ? error.message : String(error),
        feature: response.label
      });
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    
    try {
      logger.debug("Searching for features with query", { query: searchQuery });
      const results = await featuresApi.searchFeatures({
        query: searchQuery,
        session_id: "default_session",
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

  const renderActivatedFeatures = () => {
    if (isLoading) {
      return <div className="text-sm text-gray-500">Loading features...</div>;
    }

    if (!activeFeatures || activeFeatures.length === 0) {
      return (
        <div className="text-sm text-gray-500">
          No activated features. Start a conversation to see features in use.
        </div>
      );
    }

    return (
      <FeatureListVariant
        features={activeFeatures}
        clusters={featureClusters}
        onSteer={handleSteer}
        variantId={variantId}
      />
    );
  };

  const renderSearchContent = () => {
    return (
      <div className="flex flex-col gap-4 pr-2">
        {isSearching ? (
          <div className="text-sm text-gray-500">Searching...</div>
        ) : searchResults.length > 0 ? (
          <div className="space-y-2">
            {searchResults.map((feature, index) => (
              <FeatureCardVariant
                key={index}
                feature={feature}
                onSteer={handleSteer}
                variantId={variantId}
              />
            ))}
          </div>
        ) : searchQuery ? (
          <div className="text-sm text-gray-500">
            Press Enter or click Search to find features
          </div>
        ) : (
          <div className="text-sm text-gray-500">
            Use semantic search to find features by their purpose or behavior
          </div>
        )}
      </div>
    );
  };

  const renderSearchBar = () => {
    return (
      <div className="flex gap-2 px-1 pt-1 pb-3 sticky top-0 bg-white border-b z-10">
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
    );
  };

  return (
    <Card className="h-full p-4">
      <div className="flex flex-col h-full gap-4">
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Steering Controls</h2>
        </div>

        <Tabs 
          defaultValue="activated" 
          className="flex-1 flex flex-col min-h-0"
          value={selectedTab}
          onValueChange={setSelectedTab}
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="activated">Activated</TabsTrigger>
            <TabsTrigger value="modified">Modified</TabsTrigger>
            <TabsTrigger value="search">Search</TabsTrigger>
          </TabsList>

          <div className="flex-1 min-h-0 mt-4">
            <ScrollArea className="h-[calc(100vh-280px)]">
              <TabsContent value="activated" className="m-0">
                {renderActivatedFeatures()}
              </TabsContent>

              <TabsContent value="modified" className="m-0">
                {isLoadingModified ? (
                  <div className="text-sm text-gray-500">Loading variant state...</div>
                ) : (
                  <div className="space-y-2 pr-4">
                    <div className="p-2 bg-gray-100 rounded text-xs font-mono">
                      <div className="font-semibold mb-2">Raw variantJson:</div>
                      <pre className="whitespace-pre-wrap overflow-auto">
                        {JSON.stringify(variantJson, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="search" className="m-0">
                {renderSearchBar()}
                <div className="px-1 pt-2">
                  {renderSearchContent()}
                </div>
              </TabsContent>
            </ScrollArea>
          </div>
        </Tabs>
      </div>
    </Card>
  );
} 