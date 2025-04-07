import { Chat } from "@/components/Chat"
import { ConnectionStatus } from "@/components/ConnectionStatus"
import { Controls } from "@/components/Controls"
import Split from 'react-split'
import { useEffect, useState } from "react"
import { createLogger } from "@/lib/logger"
import { TestBenchProvider } from "@/lib/testbench/TestBenchProvider"
import { TestBenchPanel } from "@/lib/testbench/TestBenchPanel"
import { FeatureActivationProvider } from "@/contexts/FeatureActivationContext"
import { VariantProvider } from "./contexts/VariantContext"

const logger = createLogger('App')

function App() {
  // Store split sizes in localStorage to persist user preference
  const [sizes, setSizes] = useState(() => {
    const saved = localStorage.getItem('split-sizes')
    const parsed = saved ? JSON.parse(saved) as number[] : null
    return Array.isArray(parsed) ? parsed : [75, 25] // default split: 75% chat, 25% controls
  })

  const [currentTestId, setCurrentTestId] = useState<string>("default")

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
  
  return (
    <VariantProvider>
      <FeatureActivationProvider>
        <TestBenchProvider>
          <div className="h-screen flex flex-col">
            <div className="p-4 flex justify-between items-center">
              <TestBenchPanel />
              <ConnectionStatus />
            </div>
            <Split 
              className="flex-1 flex gap-4 p-4 overflow-hidden split"
              sizes={sizes}
              minSize={[400, 400]} 
              onDragEnd={setSizes}
              gutterStyle={() => ({
                backgroundColor: '#e5e7eb', // light gray
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
                />
              </div>
            </Split>
          </div>
        </TestBenchProvider>
      </FeatureActivationProvider>
    </VariantProvider>
    
  )
}

export default App 