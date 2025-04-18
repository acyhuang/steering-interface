import { Input } from "./ui/input"
import { Card } from "./ui/card"
import { ScrollArea } from "./ui/scroll-area"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs"
import { useState, useEffect, useRef } from "react"
import { Search, AlertCircle, RefreshCcw, Info, ChevronRight, ChevronLeft, SidebarOpen, SidebarIcon, ChevronsLeftIcon, LucidePanelLeftOpen, PanelRightOpen, PanelRightClose } from "lucide-react"
import { Button } from "./ui/button"
import { Switch } from "./ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog"
import { FeatureActivation, SteerFeatureResponse } from "@/types/steering/feature"
import { FeatureCluster } from "@/types/steering/cluster"
import { featuresApi } from "@/lib/api"
import { useLogger } from '@/lib/logger'
import { useFeatureActivations } from '@/contexts/ActivatedFeatureContext'
import { useVariant } from '@/hooks/useVariant'
import { FeatureTable, FeatureEditor } from './feature-row'
import { ControlsLoadingState, LoadingStateInfo, createLoadingState } from '@/types/ui'
import { createLogger } from "@/lib/logger"
import { Badge } from "./ui/badge"

interface ControlsProps {
  variantId?: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
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

// Auto-Steer Toggle component
interface AutoSteerToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

function AutoSteerToggle({ enabled, onToggle }: AutoSteerToggleProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium">Auto-Steer</span>
      <Switch 
        checked={enabled} 
        onCheckedChange={onToggle} 
        aria-label="Toggle Auto-Steer"
      />
    </div>
  );
}

// New component for the collapsed controls view
function CollapsedControls({ 
  autoSteerEnabled, 
  modifiedCount, 
  onToggleCollapse 
}: { 
  autoSteerEnabled: boolean; 
  modifiedCount: number;
  onToggleCollapse?: () => void;
}) {
  return (
    <div className="h-full w-full flex flex-col items-center py-4 border-l bg-background">
      <Button 
        variant="ghost" 
        size="icon" 
        onClick={onToggleCollapse}
        className="mb-6" 
        aria-label="Expand controls"
      >
        <PanelRightOpen className="h-5 w-5" />
      </Button>

      {/* Auto-steer indicator */}
      <div className="flex flex-col items-center pb-16 mb-6">
        <div className={`w-3 h-3 rounded-full ${autoSteerEnabled ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
        <div className="relative">
          <span className="text-xs absolute whitespace-nowrap" style={{ transform: 'rotate(90deg)', transformOrigin: 'left center', left: 0, top: 0 }}>Auto-steer</span>
        </div>
      </div>

      {/* Modified features count */}
      {modifiedCount > 0 && (
        <Badge variant="secondary" className="mb-6">
          {modifiedCount}
        </Badge>
      )}
    </div>
  );
}

export function Controls({ variantId = "default", isCollapsed = false, onToggleCollapse }: ControlsProps) {
  const logger = useLogger('Controls')
  const { activeFeatures, featureClusters, isLoading: isLoadingFeatures } = useFeatureActivations();
  const { 
    variantJson, 
    refreshVariant, 
    modifiedFeatures, 
    getAllModifiedFeatures,
    autoSteerEnabled,
    setAutoSteerEnabled
  } = useVariant();
  
  const [searchQuery, setSearchQuery] = useState("")
  const [localModifiedFeatures, setLocalModifiedFeatures] = useState<FeatureActivation[]>([])
  // Replace multiple loading states with a single state machine
  const [loadingState, setLoadingState] = useState<LoadingStateInfo<ControlsLoadingState>>(
    createLoadingState(ControlsLoadingState.IDLE)
  );
  const [selectedTab, setSelectedTab] = useState("activated")
  const [searchResults, setSearchResults] = useState<FeatureActivation[]>([])
  
  // New state for selected feature
  const [selectedFeature, setSelectedFeature] = useState<FeatureActivation | null>(null);
  
  // Computed properties for backward compatibility
  const isLoadingModified = loadingState.state === ControlsLoadingState.LOADING_MODIFIED;
  const isSearching = loadingState.state === ControlsLoadingState.SEARCHING;
  const refreshInProgress = loadingState.state !== ControlsLoadingState.IDLE;

  // Get count of modified features
  const modifiedCount = localModifiedFeatures.length;

  // Process modifiedFeatures from context to local state
  useEffect(() => {
    const fetchModifiedFeatures = async () => {
      setLoadingState(createLoadingState(ControlsLoadingState.LOADING_MODIFIED));
      
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
        setLoadingState(createLoadingState(
          ControlsLoadingState.IDLE, 
          error instanceof Error ? error : new Error(String(error))
        ));
      } finally {
        setLoadingState(createLoadingState(ControlsLoadingState.IDLE));
      }
    };

    fetchModifiedFeatures();
  }, [modifiedFeatures, getAllModifiedFeatures, logger]);

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

  const handleAutoSteerToggle = (enabled: boolean) => {
    // logger.debug('Auto-Steer toggle clicked in Controls', { enabled });
    setAutoSteerEnabled(enabled);
  };

  const handleSteer = async (response: SteerFeatureResponse) => {
    setLoadingState(createLoadingState(ControlsLoadingState.STEERING));
    
    try {
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
    } catch (error) {
      logger.error('Failed to handle steer response', { error });
      setLoadingState(createLoadingState(
        ControlsLoadingState.IDLE,
        error instanceof Error ? error : new Error(String(error))
      ));
    } finally {
      setLoadingState(createLoadingState(ControlsLoadingState.IDLE));
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setLoadingState(createLoadingState(ControlsLoadingState.SEARCHING));
    
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
      setLoadingState(createLoadingState(
        ControlsLoadingState.IDLE,
        error instanceof Error ? error : new Error(String(error))
      ));
    } finally {
      setLoadingState(createLoadingState(ControlsLoadingState.IDLE));
    }
  }

  const renderActivatedFeatures = () => {
    if (isLoadingFeatures) {
      return <div className="text-sm text-gray-500">Loading features...</div>;
    }

    if (!activeFeatures || activeFeatures.length === 0) {
      return (
        <div className="text-sm text-gray-500">
          Start a conversation to see activated features.
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
        <Button onClick={handleSearch} type="submit" disabled={isSearching}>
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

  // If collapsed, render the collapsed view instead
  if (isCollapsed) {
    return (
      <CollapsedControls 
        autoSteerEnabled={autoSteerEnabled}
        modifiedCount={modifiedCount}
        onToggleCollapse={onToggleCollapse}
      />
    );
  }

  return (
    <div className="h-full p-2">
      <div className="flex flex-col h-full gap-2">
        <div className="flex justify-between items-center gap-1">
          <h2 className="text-lg font-semibold">Steering Controls</h2>
          <div className="flex items-center gap-2">
            <AutoSteerToggle 
              enabled={autoSteerEnabled}
              onToggle={handleAutoSteerToggle}
            />
            
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onToggleCollapse}
              className="rounded-full" 
              aria-label="Collapse controls"
            >
              <PanelRightClose className="h-5 w-5" />
            </Button>
          </div>
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