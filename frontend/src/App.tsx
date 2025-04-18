import { Chat } from "@/components/Chat"
import { ConnectionStatus } from "@/components/ConnectionStatus"
import { Controls } from "@/components/Controls"
import Split from 'react-split'
import { useEffect, useState, useRef } from "react"
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

// Fixed width for the collapsed sidebar
const COLLAPSED_WIDTH = 60; // pixels
// Default split sizes if none are saved
const DEFAULT_SPLIT_SIZES = [75, 25]; // 75% chat, 25% controls

function App() {
  // Store split sizes in localStorage to persist user preference
  const [sizes, setSizes] = useState(() => {
    const saved = localStorage.getItem('split-sizes')
    try {
      const parsed = saved ? JSON.parse(saved) as number[] : null
      return Array.isArray(parsed) && parsed.length === 2 ? parsed : DEFAULT_SPLIT_SIZES
    } catch (e) {
      return DEFAULT_SPLIT_SIZES
    }
  })

  // Track if controls panel is collapsed
  const [isCollapsed, setIsCollapsed] = useState(false)

  const [currentTestId, setCurrentTestId] = useState<string>("default")
  
  // Help dialog state
  const [helpDialogOpen, setHelpDialogOpen] = useState(false)

  // Save sizes when they change (only when expanded)
  useEffect(() => {
    if (!isCollapsed) {
      localStorage.setItem('split-sizes', JSON.stringify(sizes))
    }
  }, [sizes, isCollapsed])

  useEffect(() => {
    logger.info('Application initialized')
  }, [])

  const handleTestChange = (testId: string) => {
    setCurrentTestId(testId)
  }
  
  // Toggle sidebar collapsed state
  const toggleSidebar = () => {
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
            
            {isCollapsed ? (
              // When collapsed, use a fixed layout with CSS
              <div className="flex-1 flex overflow-hidden">
                <div className="h-full flex-1">
                  <Chat />
                </div>
                <div className="h-full border-l bg-background" style={{ width: `${COLLAPSED_WIDTH}px`, flexShrink: 0 }}>
                  <Controls 
                    variantId={currentTestId}
                    isCollapsed={isCollapsed}
                    onToggleCollapse={toggleSidebar}
                  />
                </div>
              </div>
            ) : (
              // When expanded, use the Split component
              <Split 
                className="flex-1 flex overflow-hidden split"
                sizes={sizes}
                minSize={[400, 400]}
                snapOffset={50}
                onDragEnd={(newSizes) => {
                  setSizes(newSizes)
                }}
                gutterSize={4}
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
            )}
          </div>
        </TestBenchProvider>
      </ActivatedFeatureProvider>
    </VariantProvider>
  )
}

export default App 