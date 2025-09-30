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
  const [isStreaming, setIsStreaming] = useState(false)
  const [selectedFeature, setSelectedFeature] = useState<UnifiedFeature | null>(null)
  const [isInComparisonMode, setIsInComparisonMode] = useState(false)
  const [comparisonResponse, setComparisonResponse] = useState<string>('')
  const [isComparisonStreaming, setIsComparisonStreaming] = useState(false)
  const [originalResponseForComparison, setOriginalResponseForComparison] = useState<string>('')
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

        console.log('Conversation created successfully:', newConversation.uuid)
      } catch (error) {
        console.error('Failed to create conversation:', error)
        setConversation(prev => ({ ...prev, isLoading: false }))
        // Reset initialization flag on error to allow retry
        hasInitialized.current = false
      }
    }

    initializeConversation()
  }, [])


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

  // Event handlers
  const handleSendMessage = async (content: string) => {
    if (!conversation.id) {
      throw new Error('No active conversation')
    }

    try {
      setIsStreaming(true)
      
      // Add user message to conversation immediately
      const userMessage = { role: 'user' as const, content }
      setConversation(prev => ({
        ...prev,
        messages: [...prev.messages, userMessage]
      }))

      // Prepare messages for API (include conversation history)
      const messages = [...conversation.messages, userMessage]
      
      // Send message to backend and handle streaming response
      const stream = await conversationApi.sendMessage(conversation.id, messages)
      const reader = stream.getReader()
      
      // Add empty assistant message that we'll update as chunks arrive
      let assistantMessage = { role: 'assistant' as const, content: '' }
      setConversation(prev => ({
        ...prev,
        messages: [...prev.messages, assistantMessage]
      }))

      // Read streaming response
      let fullResponse = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        
        const chunk = new TextDecoder().decode(value)
        fullResponse += chunk
        
        // Update the assistant message in real-time
        setConversation(prev => ({
          ...prev,
          messages: prev.messages.map((msg, index) => 
            index === prev.messages.length - 1 && msg.role === 'assistant'
              ? { ...msg, content: fullResponse }
              : msg
          )
        }))
      }

      setIsStreaming(false)
      console.log('Message completed, loading features...')
      
      // Load features after message completion (features activate after messages)
      // This runs in background - user can send another message while this loads
      await loadFeatures(conversation.id)
    } catch (error) {
      console.error('Failed to send message:', error)
      setIsStreaming(false)
      throw error // Re-throw to let Chat component handle the error display
    }
  }

  const handleFeatureSelect = (feature: UnifiedFeature) => {
    setSelectedFeature(feature)
  }

  const generateComparisonResponse = async (freshFeatures: UnifiedFeature[]) => {
    // Check if we have pending modifications
    const hasPendingModifications = freshFeatures.some(f => f.pending_modification !== null)
    
    if (!hasPendingModifications || conversation.messages.length === 0) {
      return
    }

    // Find the last assistant message to use as comparison basis
    const lastAssistantMessage = [...conversation.messages].reverse().find((m: any) => m.role === 'assistant')
    const lastUserMessage = [...conversation.messages].reverse().find((m: any) => m.role === 'user')
    
    if (!lastAssistantMessage || !lastUserMessage) {
      console.log('No assistant or user message found for comparison')
      return
    }

    try {
      console.log('Starting streaming comparison response with pending modifications')
      
      // Immediately enter comparison mode with the original response
      setOriginalResponseForComparison(lastAssistantMessage.content)
      setComparisonResponse('') // Start empty, will stream in
      setIsInComparisonMode(true)
      setIsComparisonStreaming(true)
      
      // Get conversation history up to and including the last user message
      const lastUserIndex = conversation.messages.indexOf(lastUserMessage)
      const messagesForComparison = conversation.messages.slice(0, lastUserIndex + 1)
      
      // Generate steered response (backend will apply pending modifications)
      const comparisonStream = await conversationApi.sendMessage(conversation.id!, messagesForComparison)
      const reader = comparisonStream.getReader()
      
      // Stream the comparison response in real-time
      let streamingComparisonResponse = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        
        const chunk = new TextDecoder().decode(value)
        streamingComparisonResponse += chunk
        
        // Update the comparison response in real-time
        setComparisonResponse(streamingComparisonResponse)
      }
      
      setIsComparisonStreaming(false)
      console.log('Comparison response streaming completed successfully')
      
    } catch (error) {
      console.error('Failed to generate comparison response:', error)
      // Exit comparison mode on error
      setIsInComparisonMode(false)
      setIsComparisonStreaming(false)
      setComparisonResponse('')
      setOriginalResponseForComparison('')
    }
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
        
        // Generate comparison response if we have pending modifications
        await generateComparisonResponse(freshFeatures)
      }
    } catch (error) {
      console.error('Failed to steer feature:', error)
    } finally {
      setSteeringLoading(false)
    }
  }

  const handleConfirmChanges = async () => {
    if (!conversation.currentVariant) {
      console.error('No current variant available for confirming changes')
      return
    }

    try {
      console.log('Confirming changes')
      
      // Commit pending modifications
      await variantApi.commitChanges(conversation.currentVariant.uuid)
      
      // Replace the last assistant message with the steered version
      setConversation(prev => ({
        ...prev,
        messages: prev.messages.map((msg, index) => {
          // Find the last assistant message and replace it
          const lastAssistantIndex = prev.messages.map((m: any, i: number) => m.role === 'assistant' ? i : -1)
            .filter(i => i !== -1)
            .pop() ?? -1
          return index === lastAssistantIndex && msg.role === 'assistant'
            ? { ...msg, content: comparisonResponse }
            : msg
        })
      }))
      
      // Exit comparison mode
      setIsInComparisonMode(false)
      setComparisonResponse('')
      setIsComparisonStreaming(false)
      setOriginalResponseForComparison('')
      
      // Reload features to get updated state
      if (conversation.id) {
        await loadFeatures(conversation.id)
      }
      
      console.log('Changes confirmed successfully')
      
    } catch (error) {
      console.error('Failed to confirm changes:', error)
    }
  }

  const handleRejectChanges = async () => {
    if (!conversation.currentVariant) {
      console.error('No current variant available for rejecting changes')
      return
    }

    try {
      console.log('Rejecting changes')
      
      // Reject pending modifications
      await variantApi.rejectChanges(conversation.currentVariant.uuid)
      
      // Exit comparison mode (keep original message)
      setIsInComparisonMode(false)
      setComparisonResponse('')
      setIsComparisonStreaming(false)
      setOriginalResponseForComparison('')
      
      // Reload features to get updated state
      if (conversation.id) {
        await loadFeatures(conversation.id)
      }
      
      console.log('Changes rejected successfully')
      
    } catch (error) {
      console.error('Failed to reject changes:', error)
    }
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
            originalResponseForComparison={originalResponseForComparison}
            isComparisonStreaming={isComparisonStreaming}
            onSendMessage={handleSendMessage}
            onConfirmChanges={handleConfirmChanges}
            onRejectChanges={handleRejectChanges}
            isStreaming={isStreaming}
            featuresLoading={featuresLoading}
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
