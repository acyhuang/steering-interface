import { useState, useEffect, useRef, useMemo } from 'react'
import { PanelRight, Moon, Sun, Code } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/sonner'
import { toast } from 'sonner'
import { conversationApi, variantApi } from '@/services/api'
import type { ConversationState, UnifiedFeature, FilterOption, SortOption, SortOrder } from '@/types'
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
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [isDeveloperMode, setIsDeveloperMode] = useState(false)
  const [isAutoSteerEnabled, setIsAutoSteerEnabled] = useState(false)
  
  // Filter and sort state
  const [filterBy, setFilterBy] = useState<FilterOption>('activated')
  const [sortBy, setSortBy] = useState<SortOption>('activation')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  // Prevent duplicate initialization in React StrictMode
  const hasInitialized = useRef(false)

  // Initialize dark mode on app load
  useEffect(() => {
    // Check localStorage for saved preference
    const savedDarkMode = localStorage.getItem('darkMode')
    let shouldUseDarkMode = false
    
    if (savedDarkMode !== null) {
      // Use saved preference
      shouldUseDarkMode = savedDarkMode === 'true'
    } else {
      // Fall back to system preference
      shouldUseDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    
    setIsDarkMode(shouldUseDarkMode)
    
    // Apply dark class if needed
    if (shouldUseDarkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [])

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
      await loadFeatures(conversation.id)
      
      // Auto-steer logic: if enabled, trigger auto-steer and comparison
      if (isAutoSteerEnabled && conversation.currentVariant) {
        try {
          console.log('Auto-steer enabled, triggering auto-steer...')
          
          // Extract the current user query (last user message)
          const lastUserMessage = messages.filter(m => m.role === 'user').pop()
          const query = lastUserMessage?.content || ''
          
          // Convert conversation history to simple strings (last 6 messages for context)
          const conversationContext = messages
            .slice(-6)
            .map(msg => `${msg.role}: ${msg.content}`)
          
          // Call auto-steer API with correct format
          const autoSteerResult = await variantApi.autoSteer(
            conversation.currentVariant.uuid,
            query,
            conversationContext
          )
          
          // Check if auto-steer was successful and returned suggestions
          if (!autoSteerResult.success || autoSteerResult.suggested_features.length === 0) {
            toast.warning('Auto-steer could not find suitable features to modify. Try rephrasing your request.')
            return
          }
          
          // Apply suggested modifications as pending changes
          // The backend returns suggested_features (UnifiedFeature objects) with pending_modification values
          for (const feature of autoSteerResult.suggested_features) {
            if (feature.pending_modification !== null) {
              await variantApi.steerFeature(
                conversation.currentVariant.uuid,
                feature.uuid,
                feature.pending_modification
              )
            }
          }
          
          // Reload features to get updated pending modifications
          const updatedFeatures = await loadFeatures(conversation.id)
          
          // Debug: Check what features we got back
          console.log('Auto-steer: Updated features count:', updatedFeatures.length)
          const featuresWithPending = updatedFeatures.filter(f => f.pending_modification !== null)
          console.log('Auto-steer: Features with pending modifications:', featuresWithPending.length)
          console.log('Auto-steer: Pending features:', featuresWithPending.map(f => ({ label: f.label, pending: f.pending_modification })))
          
          // Build current conversation state locally (React state updates are async, so we need to construct this manually)
          const currentConversation: ConversationState = {
            id: conversation.id,
            messages: [...conversation.messages, userMessage, { role: 'assistant', content: fullResponse }],
            currentVariant: conversation.currentVariant,
            isLoading: false
          }
          
          // Generate comparison response if we have pending modifications
          await generateComparisonResponse(updatedFeatures, currentConversation)
                    
        } catch (error) {
          console.error('Auto-steer failed:', error)
          toast.error('Auto-steer failed. Continuing with normal response.')
          // Don't throw - let the user continue with normal flow
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error)
      setIsStreaming(false)
      throw error // Re-throw to let Chat component handle the error display
    }
  }

  const handleFeatureSelect = (feature: UnifiedFeature) => {
    setSelectedFeature(feature)
  }

  const generateComparisonResponse = async (freshFeatures: UnifiedFeature[], currentConversation: ConversationState) => {
    // Check if we have pending modifications
    const hasPendingModifications = freshFeatures.some(f => f.pending_modification !== null)
    
    console.log('generateComparisonResponse: hasPendingModifications =', hasPendingModifications)
    console.log('generateComparisonResponse: currentConversation.messages.length =', currentConversation.messages.length)
    console.log('generateComparisonResponse: features with pending modifications:', freshFeatures.filter(f => f.pending_modification !== null))
    
    if (!hasPendingModifications || currentConversation.messages.length === 0) {
      console.log('generateComparisonResponse: Skipping - no pending modifications or no messages')
      return
    }

    // Find the last assistant message to use as comparison basis
    const lastAssistantMessage = [...currentConversation.messages].reverse().find((m: any) => m.role === 'assistant')
    const lastUserMessage = [...currentConversation.messages].reverse().find((m: any) => m.role === 'user')
    
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
      const lastUserIndex = currentConversation.messages.indexOf(lastUserMessage)
      const messagesForComparison = currentConversation.messages.slice(0, lastUserIndex + 1)
      
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
        await generateComparisonResponse(freshFeatures, conversation)
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

  const toggleDarkMode = () => {
    const newDarkMode = !isDarkMode
    setIsDarkMode(newDarkMode)
    
    // Apply/remove dark class to document root
    if (newDarkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    
    // Save preference to localStorage
    localStorage.setItem('darkMode', newDarkMode.toString())
  }

  const toggleDeveloperMode = () => {
    setIsDeveloperMode(!isDeveloperMode)
  }

  // Filter and sort logic
  const getFilteredFeatures = (features: UnifiedFeature[], filterBy: FilterOption): UnifiedFeature[] => {
    switch (filterBy) {
      case 'activated':
        return features.filter(f => f.activation !== null && f.activation > 0)
      case 'modified':
        return features.filter(f => f.modification !== 0)
      case 'all':
      default:
        return features
    }
  }

  const getSortedFeatures = (features: UnifiedFeature[], sortBy: SortOption, sortOrder: SortOrder): UnifiedFeature[] => {
    return [...features].sort((a, b) => {
      let aValue: string | number
      let bValue: string | number
      
      switch (sortBy) {
        case 'label':
          aValue = a.label.toLowerCase()
          bValue = b.label.toLowerCase()
          break
        case 'activation':
          aValue = a.activation ?? 0
          bValue = b.activation ?? 0
          break
        case 'modification':
          aValue = a.modification
          bValue = b.modification
          break
        default:
          return 0
      }
      
      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1
      return 0
    })
  }

  // Process features with filtering and sorting
  const processedFeatures = useMemo(() => {
    const filtered = getFilteredFeatures(features, filterBy)
    return getSortedFeatures(filtered, sortBy, sortOrder)
  }, [features, filterBy, sortBy, sortOrder])

  // Compute pending features for comparison mode
  const pendingFeatures = useMemo(() => {
    return features.filter(f => f.pending_modification !== null)
  }, [features])

  return (
    <div className="h-screen flex flex-col">
      <Toaster />
      {/* Navigation Bar */}
      <nav className="bg-background border-b border-border px-4 py-3 flex justify-between items-center">
        <span className="text-xl font-medium">steering-interface</span>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleDeveloperMode}
            className={`p-2 ${isDeveloperMode ? 'bg-muted' : ''}`}
          >
            <Code className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleDarkMode}
            className="p-2"
          >
            {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleControls}
            className={`p-2 ${isControlsVisible ? 'bg-muted' : ''}`}
          >
            <PanelRight
              className="h-4 w-4"
            />
          </Button>
        </div>
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
            isDeveloperMode={isDeveloperMode}
            pendingFeatures={pendingFeatures}
          />
        </div>

        {/* Controls Sidebar */}
        {isControlsVisible && (
          <div className="w-2/5 border-l border-border">
            <Controls
              features={processedFeatures}
              selectedFeature={selectedFeature}
              onFeatureSelect={handleFeatureSelect}
              onSteer={handleSteer}
              isLoading={featuresLoading || steeringLoading}
              isDeveloperMode={isDeveloperMode}
              filterBy={filterBy}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onFilterChange={setFilterBy}
              onSortChange={setSortBy}
              onSortOrderChange={setSortOrder}
              currentVariantId={conversation.currentVariant?.uuid || null}
              isAutoSteerEnabled={isAutoSteerEnabled}
              onAutoSteerToggle={setIsAutoSteerEnabled}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default App
