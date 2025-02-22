import { Input } from "./ui/input"
import { Card } from "./ui/card"
import { ScrollArea } from "./ui/scroll-area"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs"
import { useState, useEffect } from "react"
import { Search } from "lucide-react"
import { Button } from "./ui/button"
import { FeatureActivation, SteerFeatureResponse } from "@/types/features"
import { featuresApi } from "@/lib/api"
import { useFeatureCardVariant, ContinuousFeatureCard } from './feature-card'
import { useFeatureModifications } from "@/contexts/FeatureContext"

interface InspectorProps {
  features?: FeatureActivation[];
  isLoading?: boolean;
}

export function Inspector({ features, isLoading }: InspectorProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [localFeatures, setLocalFeatures] = useState(features || [])
  const { modifications } = useFeatureModifications()
  
  const FeatureCardVariant = useFeatureCardVariant();

  useEffect(() => {
    setLocalFeatures(features || [])
  }, [features])

  const handleSteer = async (response: SteerFeatureResponse) => {
    setLocalFeatures(current => 
      current.map(f => 
        f.label === response.label 
          ? { ...f, activation: response.activation }
          : f
      )
    );

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

  // Convert modifications Map to array for Modified tab
  const modifiedFeatures = Array.from(modifications.entries()).map(([label, value]) => ({
    label,
    value
  }));

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

        <Tabs defaultValue="activated" className="flex-1 flex flex-col min-h-0">
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
                {modifiedFeatures.length > 0 ? (
                  <div className="space-y-2 pr-4">
                    {modifiedFeatures.map((feature, index) => (
                      <ContinuousFeatureCard 
                        key={index}
                        feature={{
                          label: feature.label,
                          activation: feature.value  // Use the actual modification value
                        }}
                        readOnly
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">
                    No features have been modified.
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