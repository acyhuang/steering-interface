import { Chat } from "@/components/Chat"
import { ConnectionStatus } from "@/components/ConnectionStatus"
import { Controls } from "@/components/Controls"
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
  
  // References for manual resize functionality
  const containerRef = useRef<HTMLDivElement>(null)
  const chatPanelRef = useRef<HTMLDivElement>(null)
  const controlsPanelRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef<boolean>(false)
  const startXRef = useRef<number>(0)
  const startWidthsRef = useRef<{chat: number, controls: number}>({chat: 0, controls: 0})

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
  
  // Handle manual resize functionality
  const startResize = (e: React.MouseEvent) => {
    if (isCollapsed) return;
    
    e.preventDefault();
    isDraggingRef.current = true;
    startXRef.current = e.clientX;
    
    if (chatPanelRef.current && controlsPanelRef.current) {
      startWidthsRef.current = {
        chat: chatPanelRef.current.offsetWidth,
        controls: controlsPanelRef.current.offsetWidth
      };
    }
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopResize);
  };
  
  const handleMouseMove = (e: MouseEvent) => {
    if (!isDraggingRef.current || isCollapsed) return;
    
    const containerWidth = containerRef.current?.offsetWidth || 0;
    if (!containerWidth) return;
    
    const deltaX = e.clientX - startXRef.current;
    
    const newChatWidth = startWidthsRef.current.chat + deltaX;
    const newControlsWidth = startWidthsRef.current.controls - deltaX;
    
    // Set minimum widths to prevent panels from becoming too small
    const minWidth = 250;
    if (newChatWidth < minWidth || newControlsWidth < minWidth) return;
    
    // Calculate new percentage sizes
    const newChatSize = (newChatWidth / containerWidth) * 100;
    const newControlsSize = (newControlsWidth / containerWidth) * 100;
    
    setSizes([newChatSize, newControlsSize]);
  };
  
  const stopResize = () => {
    isDraggingRef.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', stopResize);
  };
  
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
            
            {/* Consistent layout structure regardless of collapsed state */}
            <div ref={containerRef} className="flex-1 flex overflow-hidden">
              <div 
                ref={chatPanelRef}
                className="h-full transition-all duration-300 ease-in-out" 
                style={{ 
                  flexGrow: 1, 
                  flexBasis: isCollapsed ? 'calc(100% - 60px)' : `${sizes[0]}%` 
                }}
              >
                <Chat />
              </div>
              
              <div 
                ref={controlsPanelRef}
                className={`h-full border-l bg-background transition-all duration-300 ease-in-out ${isCollapsed ? 'controls-collapsed' : 'controls-expanded'}`}
                style={{ 
                  width: isCollapsed ? `${COLLAPSED_WIDTH}px` : 'auto',
                  flexShrink: 0,
                  flexBasis: isCollapsed ? 'auto' : `${sizes[1]}%`
                }}
              >
                <Controls 
                  variantId={currentTestId}
                  isCollapsed={isCollapsed}
                  onToggleCollapse={toggleSidebar}
                />
              </div>
              
              {/* Only show the gutter when expanded */}
              {!isCollapsed && (
                <div
                  className="gutter-handle bg-border hover:bg-primary/20 cursor-col-resize transition-colors"
                  onMouseDown={startResize}
                ></div>
              )}
            </div>
          </div>
        </TestBenchProvider>
      </ActivatedFeatureProvider>
    </VariantProvider>
  )
}

export default App 