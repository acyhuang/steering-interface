import { Input } from "./ui/input"
import { Card } from "./ui/card"
import { ScrollArea } from "./ui/scroll-area"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs"
import { useState, useEffect, useRef } from "react"
import { Search, HelpCircle } from "lucide-react"
import { Button } from "./ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog"
import { 
  FeatureActivation, 
  SteerFeatureResponse, 
  FeatureCluster
} from "@/types/features"
import { featuresApi } from "@/lib/api"
import { useLogger } from '@/lib/logger'
import { useFeatureActivations } from '@/contexts/ActivatedFeatureContext'
import { useVariant } from '@/contexts/VariantContext'
import { FeatureTable, FeatureEditor } from './feature-row'

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
  const { 
    variantJson, 
    refreshVariant, 
    modifiedFeatures, 
    getAllModifiedFeatures 
  } = useVariant();
  
  const [searchQuery, setSearchQuery] = useState("")
  const [localModifiedFeatures, setLocalModifiedFeatures] = useState<FeatureActivation[]>([])
  const [isLoadingModified, setIsLoadingModified] = useState(false)
  const [selectedTab, setSelectedTab] = useState("activated")
  const [searchResults, setSearchResults] = useState<FeatureActivation[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const refreshInProgressRef = useRef(false);
  
  // New state for selected feature
  const [selectedFeature, setSelectedFeature] = useState<FeatureActivation | null>(null);
  
  // State for help dialog
  const [helpDialogOpen, setHelpDialogOpen] = useState(false);

  // Process modifiedFeatures from context to local state
  useEffect(() => {
    setIsLoadingModified(true);
    
    try {
      const allModifiedFeatures = getAllModifiedFeatures();
      if (allModifiedFeatures.size > 0) {
        // Convert Map to FeatureActivation array
        const features: FeatureActivation[] = Array.from(allModifiedFeatures.entries())
          .map(([label, value]) => ({
            label,
            activation: 0, // Base activation is not relevant here
            modifiedActivation: value
          }));
        setLocalModifiedFeatures(features);
        logger.debug('Updated local modified features from context', { 
          featureCount: features.length 
        });
      } else {
        setLocalModifiedFeatures([]);
      }
    } catch (error) {
      logger.error('Failed to process modified features', { error });
      setLocalModifiedFeatures([]);
    } finally {
      setIsLoadingModified(false);
      refreshInProgressRef.current = false;
    }
  }, [modifiedFeatures, getAllModifiedFeatures, logger]);

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
  }, [selectedTab, refreshVariant]);

  // Clear selected feature when switching tabs
  useEffect(() => {
    setSelectedFeature(null);
  }, [selectedTab]);

  const handleSelectFeature = (feature: FeatureActivation) => {
    setSelectedFeature(prevSelected => {
      // If already selected, deselect it
      if (prevSelected?.label === feature.label) {
        return null;
      }
      return feature;
    });
  };

  const handleCloseEditor = () => {
    setSelectedFeature(null);
  };

  const handleSteer = async (response: SteerFeatureResponse) => {
    logger.debug('Handling steer response', { response });
    
    // Update the feature in the appropriate list based on the current tab
    if (selectedTab === "search") {
      // For search results, we need to update the local state
      setSearchResults(prev => 
        prev.map(f => {
          if (f.label === response.label) {
            return { 
              ...f, 
              modifiedActivation: response.activation 
            };
          }
          return f;
        })
      );
    } else if (selectedTab === "modified") {
      // For modified tab, refresh the variant data
      refreshInProgressRef.current = true;
      await refreshVariant();
    }
    
    // Update the selected feature state if needed
    if (selectedFeature && selectedFeature.label === response.label) {
      setSelectedFeature({
        ...selectedFeature,
        modifiedActivation: response.activation
      });
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
    
    try {
      logger.debug("Searching for features with query", { query: searchQuery });
      const results = await featuresApi.searchFeatures({
        query: searchQuery,
        session_id: "default_session",
        variant_id: variantId,
        top_k: 10
      });
      
      // Initialize with modifiedActivation from our centralized store
      const resultsWithModified = results.map(feature => {
        const modValue = modifiedFeatures.get(feature.label);
        return {
          ...feature,
          modifiedActivation: modValue !== undefined ? modValue : 0
        };
      });
      
      logger.debug("Search results", { results: resultsWithModified });
      setSearchResults(resultsWithModified);
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
          Activated features are features are influencing the model's responses. Start a conversation to see activated features.
        </div>
      );
    }

    return (
      <FeatureTable
        features={activeFeatures}
        clusters={featureClusters}
        selectedFeature={selectedFeature}
        onSelectFeature={handleSelectFeature}
        onSteer={handleSteer}
      />
    );
  };

  const renderModifiedFeatures = () => {
    if (isLoadingModified) {
      return <div className="text-sm text-gray-500">Loading variant state...</div>;
    }

    if (!localModifiedFeatures || localModifiedFeatures.length === 0) {
      return (
        <div className="text-sm text-gray-500">
          No modified features.
        </div>
      );
    }

    return (
      <FeatureTable
        features={localModifiedFeatures}
        selectedFeature={selectedFeature}
        onSelectFeature={handleSelectFeature}
        onSteer={handleSteer}
      />
    );
  };

  const renderSearchContent = () => {
    return (
      <div className="flex flex-col gap-4 pr-0">
        {isSearching ? (
          <div className="text-sm text-gray-500">Searching...</div>
        ) : searchResults.length > 0 ? (
          <FeatureTable
            features={searchResults}
            selectedFeature={selectedFeature}
            onSelectFeature={handleSelectFeature}
            onSteer={handleSteer}
          />
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
      <div className="flex gap-2 px-1 pt-1 pb-2 sticky top-0 bg-white z-10">
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

  // Calculate the scroll area height based on whether the editor is visible
  // When editor is visible, we reduce the height to make room for it
  const scrollAreaHeight = selectedFeature 
    ? "calc(100vh - 400px)" // Reduced height when editor is visible
    : "calc(100vh - 280px)"; // Original height

  return (
    <div className="h-full p-2">
      <div className="flex flex-col h-full gap-2">
        <div className="flex justify-between items-center gap-1">
          <h2 className="text-lg font-semibold">Steering Controls</h2>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setHelpDialogOpen(true)}
            className="rounded-full" 
            aria-label="Help"
          >
            <HelpCircle className="h-5 w-5" />
          </Button>
          
          <Dialog open={helpDialogOpen} onOpenChange={setHelpDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Understanding steering controls</DialogTitle>
                <DialogDescription>
                  <div className="mt-4 space-y-4 text-sm">
                    <p>Features are internal representations of concepts that the LLM has learned. Steering controls allow you to strengthen or weaken features in the model to influence its behavior.</p>
                    <p><span className="font-medium">Activated:</span> Features that are currently influencing the model's outputs in your conversation.</p>
                    <p><span className="font-medium">Modified:</span> Features that have been strengthened or weakened from the model's default state.</p>
                    <p><span className="font-medium">Search:</span> Allows you to find features by their meaning or purpose.</p>
                  
                  </div>
                </DialogDescription>
              </DialogHeader>
            </DialogContent>
          </Dialog>
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

          <div className="flex-1 min-h-0 mt-2 flex flex-col">
            <ScrollArea className="flex-1" style={{ height: scrollAreaHeight, transition: "height 0.2s ease" }}>
              <TabsContent value="activated" className="m-0 pr-2">
                {renderActivatedFeatures()}
              </TabsContent>

              <TabsContent value="modified" className="m-0">
                {renderModifiedFeatures()}
              </TabsContent>

              <TabsContent value="search" className="m-0">
                {renderSearchBar()}
                <div className="px-0 pt-2">
                  {renderSearchContent()}
                </div>
              </TabsContent>
            </ScrollArea>

            {/* Feature Editor now positioned below the scroll area */}
            {selectedFeature && (
              <FeatureEditor
                feature={selectedFeature}
                onSteer={handleSteer}
                onClose={handleCloseEditor}
              />
            )}
          </div>
        </Tabs>
      </div>
    </div>
  );
} 