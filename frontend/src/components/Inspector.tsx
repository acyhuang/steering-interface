import { Input } from "./ui/input"
import { Card } from "./ui/card"
import { ScrollArea } from "./ui/scroll-area"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs"
import { useState, useEffect, useCallback } from "react"
import { Search } from "lucide-react"
import { Button } from "./ui/button"
import { FeatureActivation, SteerFeatureResponse } from "@/types/features"
import { featuresApi } from "@/lib/api"
import { useFeatureCardVariant, ContinuousFeatureCard } from './feature-card'

interface InspectorProps {
  features?: FeatureActivation[];
  isLoading?: boolean;
  variantId?: string;
}

export function Inspector({ features, isLoading, variantId = "default" }: InspectorProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [localFeatures, setLocalFeatures] = useState(features || [])
  const [variantJson, setVariantJson] = useState<any>(null)
  const [isLoadingModified, setIsLoadingModified] = useState(false)
  const [selectedTab, setSelectedTab] = useState("activated")
  
  const FeatureCardVariant = useFeatureCardVariant();

  useEffect(() => {
    setLocalFeatures(features || [])
  }, [features])

  const fetchVariantJson = useCallback(async () => {
    setIsLoadingModified(true)
    console.log('[INSPECTOR_DEBUG] Fetching modified features for variant:', variantId);
    try {
      const response = await featuresApi.getModifiedFeatures(variantId);
      console.log('[INSPECTOR_DEBUG] Received variant state:', response);
      setVariantJson(response);
    } catch (error) {
      console.error('[INSPECTOR_DEBUG] Failed to fetch variant state:', error);
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

  const handleSearch = () => {
    // TODO: Implement search functionality
    console.log("Searching for:", searchQuery)
  }

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
                {isLoading ? (
                  <div className="text-sm text-gray-500">Loading features...</div>
                ) : localFeatures && localFeatures.length > 0 ? (
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
                ) : (
                  <div className="text-sm text-gray-500">
                    No activated features. Start a conversation to see features in use.
                  </div>
                )}
              </TabsContent>

              <TabsContent value="suggested" className="m-0">
                <div className="text-sm text-gray-500">
                  No suggested features available yet.
                </div>
              </TabsContent>

              <TabsContent value="modified" className="m-0">
                {isLoadingModified ? (
                  <div className="text-sm text-gray-500">Loading variant state...</div>
                ) : variantJson ? (
                  <div className="space-y-2 pr-4">
                    <pre className="text-xs font-mono whitespace-pre-wrap overflow-x-auto">
                      {JSON.stringify(variantJson, null, 2)}
                    </pre>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">
                    No variant state available.
                  </div>
                )}
              </TabsContent>
            </ScrollArea>
          </div>
        </Tabs>
      </div>
    </Card>
  )
} 