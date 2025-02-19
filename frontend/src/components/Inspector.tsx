import { Input } from "./ui/input"
import { Card } from "./ui/card"
import { ScrollArea } from "./ui/scroll-area"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs"
import { useState } from "react"

export function Inspector() {
  const [searchQuery, setSearchQuery] = useState("")
  
  return (
    <Card className="h-full p-4">
      <div className="flex flex-col h-full gap-4">
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Feature Inspector</h2>
          <Input
            placeholder="Search features..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <Tabs defaultValue="active" className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="activated">Activated</TabsTrigger>
            <TabsTrigger value="suggested">Suggested</TabsTrigger>
            <TabsTrigger value="modified">Modified</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 mt-4">
            <TabsContent value="activated" className="m-0">
              <div className="text-sm text-gray-500">
                [Here is where the activated features will show up.] No activated features. Start a conversation to see features in use.
              </div>
            </TabsContent>

            <TabsContent value="suggested" className="m-0">
              <div className="text-sm text-gray-500">
              [Here is where the suggested features will show up.] No suggested features available yet.
              </div>
            </TabsContent>

            <TabsContent value="modified" className="m-0">
              <div className="text-sm text-gray-500">
              [Here is where the steered features will show up.] No features have been modified.
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </div>
    </Card>
  )
} 