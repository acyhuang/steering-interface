import { Chat } from "@/components/Chat"
import { ConnectionStatus } from "@/components/ConnectionStatus"
import { Controls } from "@/components/Controls"
import { useEffect, useState } from "react"
import { createLogger } from "@/lib/logger"
import { ActivatedFeatureProvider } from "@/contexts/ActivatedFeatureContext"
import { VariantProvider } from "./contexts/VariantContext"
import { PanelRightOpen, PanelRightClose } from "lucide-react"
import { Button } from "@/components/ui/button"

const logger = createLogger('App')

// Fixed width percentages for the layout
const CHAT_WIDTH_WHEN_CONTROLS_VISIBLE = 60; // 60% for chat
const CONTROLS_WIDTH_WHEN_VISIBLE = 40; // 40% for controls

function App() {

  // Track if controls panel is visible
  const [isControlsVisible, setIsControlsVisible] = useState(true)
  


  useEffect(() => {
    logger.info('Application initialized')
  }, [])

  
  // Toggle controls visibility
  const toggleControls = () => {
    setIsControlsVisible(!isControlsVisible)
  }
  
  
  return (
    <VariantProvider>
      <ActivatedFeatureProvider>
        <div className="h-screen flex flex-col">
          {/* Top nav bar */}
          <div className="px-4 py-2 flex justify-between items-center border-b">
            <div className="flex gap-8">
              <span>steering-interface</span>
              <ConnectionStatus />
            </div>
            <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={toggleControls}
                  className="rounded-full" 
                  aria-label={isControlsVisible ? "Hide controls" : "Show controls"}
                >
                  {isControlsVisible ? <PanelRightClose className="h-5 w-5" /> : <PanelRightOpen className="h-5 w-5" />}
                </Button>
              </div>
            </div>
            
            {/* Simple layout with show/hide controls */}
            <div className="flex-1 flex overflow-hidden">
              <div 
                className="h-full" 
                style={{ 
                  width: isControlsVisible ? `${CHAT_WIDTH_WHEN_CONTROLS_VISIBLE}%` : '100%'
                }}
              >
                <Chat />
              </div>
              
              {isControlsVisible && (
                <div 
                  className="h-full border-l bg-background"
                  style={{ 
                    width: `${CONTROLS_WIDTH_WHEN_VISIBLE}%`
                  }}
                >
                  <Controls />
                </div>
              )}
          </div>
        </div>
      </ActivatedFeatureProvider>
    </VariantProvider>
  )
}

export default App 