import { useState, useEffect, useRef } from 'react'
import { Sidebar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { conversationApi, variantApi } from '@/services/api'
import type { ConversationState, UnifiedFeature } from '@/types'
import Chat from './components/Chat'
import Controls from './components/Controls'

function App() {
  // Main application state
  const [conversation, setConversation] = useState<ConversationState>({
    id: null,
    messages: [],
    currentVariant: null,
    isLoading: false
  })
  
  const [features, setFeatures] = useState<UnifiedFeature[]>([])
  const [featuresLoading, setFeaturesLoading] = useState(false)
  const [steeringLoading, setSteeringLoading] = useState(false)
  const [selectedFeature, setSelectedFeature] = useState<UnifiedFeature | null>(null)
  const [isInComparisonMode, setIsInComparisonMode] = useState(false)
  const [comparisonResponse, setComparisonResponse] = useState<string>('')
  const [isControlsVisible, setIsControlsVisible] = useState(true)

  // Prevent duplicate initialization in React StrictMode
  const hasInitialized = useRef(false)

  // Create conversation on app load
  useEffect(() => {
    if (hasInitialized.current) return

    const initializeConversation = async () => {
      hasInitialized.current = true

      try {
        setConversation(prev => ({ ...prev, isLoading: true }))
        const newConversation = await conversationApi.create()
        setConversation({
          id: newConversation.uuid,
          messages: [],
          currentVariant: newConversation.current_variant,
          isLoading: false
        })

        // TODO: Remove auto-demo message when chat UI is complete
        // Auto-send demo message to activate features for testing
        await sendDemoMessage(newConversation.uuid)
      } catch (error) {
        console.error('Failed to create conversation:', error)
        setConversation(prev => ({ ...prev, isLoading: false }))
        // Reset initialization flag on error to allow retry
        hasInitialized.current = false
      }
    }

    initializeConversation()
  }, [])

  // TODO: Remove this function when chat UI is complete
  const sendDemoMessage = async (conversationId: string) => {
    try {
      console.log('Sending demo message to activate features...')
      const demoMessages = [{ role: 'user' as const, content: 'Hello, how are you today? Answer in one sentence.' }]
      
      // Send message to backend (we don't need to handle the streaming response for demo)
      const stream = await conversationApi.sendMessage(conversationId, demoMessages)
      
      // Consume the stream to complete the request
      const reader = stream.getReader()
      let fullResponse = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = new TextDecoder().decode(value)
        fullResponse += chunk
      }
      
      // Update conversation with demo messages
      setConversation(prev => ({
        ...prev,
        messages: [
          ...demoMessages,
          { role: 'assistant', content: fullResponse }
        ]
      }))
      
      console.log('Demo message completed, features should now be available')
      
      // Load features after demo message
      await loadFeatures(conversationId)
    } catch (error) {
      console.error('Failed to send demo message:', error)
    }
  }

  // Load features for the conversation
  const loadFeatures = async (conversationId: string) => {
    try {
      setFeaturesLoading(true)
      console.log('Loading features for conversation:', conversationId)
      
      const tableFeatures = await conversationApi.getTableFeatures(conversationId)
      setFeatures(tableFeatures)
      
      console.log(`Loaded ${tableFeatures.length} features:`, tableFeatures)
      return tableFeatures
    } catch (error) {
      console.error('Failed to load features:', error)
      setFeatures([])
      return []
    } finally {
      setFeaturesLoading(false)
    }
  }

  // Event handlers (skeleton implementations)
  const handleSendMessage = async (content: string) => {
    console.log('Send message:', content)
    // TODO: Implement message sending
  }

  const handleFeatureSelect = (feature: UnifiedFeature) => {
    setSelectedFeature(feature)
  }

  const handleSteer = async (featureUuid: string, value: number) => {
    if (!conversation.currentVariant) {
      console.error('No current variant available for steering')
      return
    }

    try {
      setSteeringLoading(true)
      console.log('Steering feature:', featureUuid, 'to value:', value)
      
      await variantApi.steerFeature(
        conversation.currentVariant.uuid,
        featureUuid,
        value
      )
      
      console.log('Feature steering successful')
      
      // Reload features to get updated values
      if (conversation.id) {
        const freshFeatures = await loadFeatures(conversation.id)
        
        // Update selected feature with fresh data
        if (selectedFeature) {
          const updatedFeature = freshFeatures.find(f => f.uuid === selectedFeature.uuid)
          if (updatedFeature) {
            setSelectedFeature(updatedFeature)
          }
        }
      }
    } catch (error) {
      console.error('Failed to steer feature:', error)
    } finally {
      setSteeringLoading(false)
    }
  }

  const handleConfirmChanges = async () => {
    console.log('Confirm changes')
    // TODO: Implement confirm changes
  }

  const handleRejectChanges = async () => {
    console.log('Reject changes')
    // TODO: Implement reject changes
  }

  const toggleControls = () => {
    setIsControlsVisible(!isControlsVisible)
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Navigation Bar */}
      <nav className="bg-background border-b border-border px-4 py-3 flex justify-between items-center">
        <span className="text-xl font-medium">steering-interface</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleControls}
          className="p-2"
        >
          <Sidebar className="h-4 w-4" />
        </Button>
      </nav>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat Area */}
        <div className={`flex-1 ${isControlsVisible ? 'w-3/5' : 'w-full'} transition-all duration-300`}>
          <Chat
            conversation={conversation}
            isInComparisonMode={isInComparisonMode}
            comparisonResponse={comparisonResponse}
            onSendMessage={handleSendMessage}
            onConfirmChanges={handleConfirmChanges}
            onRejectChanges={handleRejectChanges}
          />
        </div>

        {/* Controls Sidebar */}
        {isControlsVisible && (
          <div className="w-2/5 border-l border-border">
            <Controls
              features={features}
              selectedFeature={selectedFeature}
              onFeatureSelect={handleFeatureSelect}
              onSteer={handleSteer}
              isLoading={featuresLoading || steeringLoading}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default App
