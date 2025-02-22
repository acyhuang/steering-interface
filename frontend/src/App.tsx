import { Chat } from "@/components/Chat"
import { ConnectionStatus } from "@/components/ConnectionStatus"
import { Inspector } from "@/components/Inspector"
import Split from 'react-split'
import { useEffect, useState } from "react"
import { FeatureActivation } from "./types/features"
import { ChatMessage } from "./types/chat"
import { featuresApi } from "@/lib/api"
import { createLogger } from "@/lib/logger"
import { TestBenchProvider } from "@/lib/testbench/TestBenchProvider"
import { TestBenchPanel } from "@/lib/testbench/TestBenchPanel"
import { FeatureProvider } from "@/contexts/FeatureContext"

const logger = createLogger('App')

function App() {
  // Store split sizes in localStorage to persist user preference
  const [sizes, setSizes] = useState(() => {
    const saved = localStorage.getItem('split-sizes')
    return saved ? JSON.parse(saved) : [75, 25] // default split: 75% chat, 25% inspector
  })

  const [features, setFeatures] = useState<FeatureActivation[]>([])
  const [isLoadingFeatures, setIsLoadingFeatures] = useState(false)
  const [currentTestId, setCurrentTestId] = useState<string>("default")

  // Save sizes when they change
  useEffect(() => {
    localStorage.setItem('split-sizes', JSON.stringify(sizes))
  }, [sizes])

  useEffect(() => {
    logger.info('Application initialized')
  }, [])

  const handleMessagesUpdate = async (messages: ChatMessage[]) => {
    setIsLoadingFeatures(true)
    try {
      logger.debug('Fetching features for messages', { messageCount: messages.length })
      const response = await featuresApi.inspectFeatures({
        messages,
        session_id: "default" // TODO: Use real session management
      })
      setFeatures(response)
    } catch (error) {
      logger.error('Failed to inspect features:', error)
    } finally {
      setIsLoadingFeatures(false)
    }
  }

  const handleTestChange = (testId: string) => {
    setCurrentTestId(testId)
  }

  return (
    <FeatureProvider>
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
              <Chat 
                onMessagesUpdate={handleMessagesUpdate}
                onTestChange={handleTestChange}
              />
            </div>
            <div className="h-full">
              <Inspector 
                features={features} 
                isLoading={isLoadingFeatures}
                testId={currentTestId}
              />
            </div>
          </Split>
        </div>
      </TestBenchProvider>
    </FeatureProvider>
  )
}

export default App 