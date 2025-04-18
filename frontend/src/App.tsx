import { Chat } from "@/components/Chat"
import { ConnectionStatus } from "@/components/ConnectionStatus"
import { Controls } from "@/components/Controls"
import Split from 'react-split'
import { useEffect, useState } from "react"
import { createLogger } from "@/lib/logger"
import { TestBenchProvider } from "@/lib/testbench/TestBenchProvider"
import { TestBenchPanel } from "@/lib/testbench/TestBenchPanel"
import { ActivatedFeatureProvider } from "@/contexts/ActivatedFeatureContext"
import { VariantProvider } from "./contexts/VariantContext"
import { HelpCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const logger = createLogger('App')

function App() {
  // Store split sizes in localStorage to persist user preference
  const [sizes, setSizes] = useState(() => {
    const saved = localStorage.getItem('split-sizes')
    const parsed = saved ? JSON.parse(saved) as number[] : null
    return Array.isArray(parsed) ? parsed : [75, 25] // default split: 75% chat, 25% controls
  })

  // Track if controls panel is collapsed
  const [isCollapsed, setIsCollapsed] = useState(false)
  // Store previous sizes when collapsing
  const [previousSizes, setPreviousSizes] = useState<number[]>([])

  const [currentTestId, setCurrentTestId] = useState<string>("default")
  
  // Help dialog state
  const [helpDialogOpen, setHelpDialogOpen] = useState(false)

  // Save sizes when they change
  useEffect(() => {
    localStorage.setItem('split-sizes', JSON.stringify(sizes))
  }, [sizes])

  useEffect(() => {
    logger.info('Application initialized')
  }, [])

  const handleTestChange = (testId: string) => {
    setCurrentTestId(testId)
  }
  
  // Toggle sidebar collapsed state
  const toggleSidebar = () => {
    if (!isCollapsed) {
      // Store current sizes before collapsing
      setPreviousSizes(sizes)
      // Set to collapsed sizes (95% chat, 5% controls)
      setSizes([95, 5])
    } else {
      // Restore previous sizes
      setSizes(previousSizes.length ? previousSizes : [75, 25])
    }
    setIsCollapsed(!isCollapsed)
  }
  
  return (
    <VariantProvider>
      <ActivatedFeatureProvider>
        <TestBenchProvider>
          <div className="h-screen flex flex-col">
            <div className="p-2 flex justify-between items-center border-b">
              <div className="flex items-center gap-2">
                <TestBenchPanel />
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
                          <p><span className="font-medium">Auto-steer:</span> When enabled, automatically suggests feature adjustments based on your query.</p>
                        </div>
                      </DialogDescription>
                    </DialogHeader>
                  </DialogContent>
                </Dialog>
              </div>
              <ConnectionStatus />
            </div>
            <Split 
              className="flex-1 flex overflow-hidden split"
              sizes={sizes}
              minSize={isCollapsed ? [400, 40] : [400, 400]} 
              onDragEnd={(newSizes) => {
                // Only update sizes if not in collapsed state
                if (!isCollapsed) {
                  setSizes(newSizes)
                }
              }}
              gutterStyle={() => ({
                backgroundColor: 'hsl(var(--border))',
                width: '4px',
                cursor: 'col-resize'
              })}
            >
              <div className="h-full">
                <Chat />
              </div>
              <div className="h-full">
                <Controls 
                  variantId={currentTestId}
                  isCollapsed={isCollapsed}
                  onToggleCollapse={toggleSidebar}
                />
              </div>
            </Split>
          </div>
        </TestBenchProvider>
      </ActivatedFeatureProvider>
    </VariantProvider>
    
  )
}

export default App 