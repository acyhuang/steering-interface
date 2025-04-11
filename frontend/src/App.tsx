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
      <ActivatedFeatureProvider>
        <TestBenchProvider>
          <div className="h-screen flex flex-col">
            <div className="p-2 flex justify-between items-center border-b">
              <TestBenchPanel />
              <ConnectionStatus />
            </div>
            <Split 
              className="flex-1 flex overflow-hidden split"
              sizes={sizes}
              minSize={[400, 400]} 
              onDragEnd={setSizes}
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