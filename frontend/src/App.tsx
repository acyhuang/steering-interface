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
  const [isStreaming, setIsStreaming] = useState(false)
  const [selectedFeature, setSelectedFeature] = useState<UnifiedFeature | null>(null)
  const [comparisonState, setComparisonState] = useState<'idle' | 'steering' | 'streaming' | 'complete'>('idle')
  const [comparisonMode, setComparisonMode] = useState<'manual' | 'auto' | null>(null)
  const [comparisonResponse, setComparisonResponse] = useState<string>('')
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
      // Add user message to conversation immediately
      const userMessage = { role: 'user' as const, content }
      setConversation(prev => ({
        ...prev,
        messages: [...prev.messages, userMessage]
      }))

      // Prepare messages for API (include conversation history)
      const messages = [...conversation.messages, userMessage]
      
      // Branch based on auto-steer enabled
      if (isAutoSteerEnabled && conversation.currentVariant) {
        await handleAutoSteerParallel(content, messages)
      } else {
        await handleSingleResponse(messages)
      }
      
    } catch (error) {
      console.error('Failed to send message:', error)
      setIsStreaming(false)
      throw error // Re-throw to let Chat component handle the error display
    }
  }

  const handleSingleResponse = async (messages: any[]) => {
    if (!conversation.id) {
      throw new Error('No active conversation')
    }

    try {
      setIsStreaming(true)
      
      // Send message to backend and handle streaming response
      const stream = await conversationApi.sendMessage(conversation.id, messages)
      const reader = stream.getReader()
      
      // Add empty assistant message that we'll update as chunks arrive
      setConversation(prev => ({
        ...prev,
        messages: [...prev.messages, { role: 'assistant', content: '' }]
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
      
    } catch (error) {
      console.error('Failed to send single response:', error)
      setIsStreaming(false)
      throw error
    }
  }

  const handleAutoSteerParallel = async (userQuery: string, messages: any[]) => {
    if (!conversation.id || !conversation.currentVariant) {
      throw new Error('No active conversation or variant')
    }

    try {
      // Enter comparison mode with skeleton immediately for instant feedback
      console.log('Auto-steer parallel: Showing loading state immediately...')
      setComparisonState('steering')
      setComparisonMode('auto')
      setOriginalResponseForComparison('')
      setComparisonResponse('')
      
      console.log('Auto-steer parallel: Starting auto-steer analysis...')
      
      // Convert conversation history to simple strings (last 6 messages for context)
      const conversationContext = messages
        .slice(-6)
        .map(msg => `${msg.role}: ${msg.content}`)
      
      // Call auto-steer API (user sees skeleton during this)
      const autoSteerResult = await variantApi.autoSteer(
        conversation.currentVariant.uuid,
        userQuery,
        conversationContext
      )
      
      // Check if auto-steer was successful and returned suggestions
      if (!autoSteerResult.success || autoSteerResult.suggested_features.length === 0) {
        console.log('Auto-steer found no modifications, falling back to single response')
        // Exit comparison mode and fall back to single response
        setComparisonState('idle')
        setComparisonMode(null)
        setOriginalResponseForComparison('')
        setComparisonResponse('')
        toast.info('No steering adjustments needed for this query')
        await handleSingleResponse(messages)
        return
      }
      
      // Apply suggested modifications as pending changes
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
      await loadFeatures(conversation.id)
      
      console.log('Auto-steer: Applied pending modifications, starting parallel streaming...')
      
      // Start both API calls in parallel
      const [defaultStream, steeredStream] = await Promise.all([
        conversationApi.sendMessage(conversation.id, messages, { applyPendingModifications: false }),
        conversationApi.sendMessage(conversation.id, messages, { applyPendingModifications: true })
      ])
      
      // Enter streaming state
      setComparisonState('streaming')
      
      // Create readers for both streams
      const defaultReader = defaultStream.getReader()
      const steeredReader = steeredStream.getReader()
      
      // Stream both responses simultaneously
      let defaultResponse = ''
      let steeredResponse = ''
      let defaultDone = false
      let steeredDone = false
      
      // Read both streams in parallel
      while (!defaultDone || !steeredDone) {
        const results = await Promise.all([
          defaultDone ? Promise.resolve({ done: true, value: undefined }) : defaultReader.read(),
          steeredDone ? Promise.resolve({ done: true, value: undefined }) : steeredReader.read()
        ])
        
        const [defaultResult, steeredResult] = results
        
        // Process default stream
        if (!defaultResult.done && defaultResult.value) {
          const chunk = new TextDecoder().decode(defaultResult.value)
          defaultResponse += chunk
          setOriginalResponseForComparison(defaultResponse)
        } else {
          defaultDone = true
        }
        
        // Process steered stream
        if (!steeredResult.done && steeredResult.value) {
          const chunk = new TextDecoder().decode(steeredResult.value)
          steeredResponse += chunk
          setComparisonResponse(steeredResponse)
        } else {
          steeredDone = true
        }
      }
      
      // Streaming complete
      setComparisonState('complete')
      
      // Add the DEFAULT response to conversation history (user can choose to accept steered version later)
      setConversation(prev => ({
        ...prev,
        messages: [...prev.messages, { role: 'assistant', content: defaultResponse }]
      }))
      
      console.log('Auto-steer parallel: Streaming completed successfully')
      
    } catch (error) {
      console.error('Auto-steer parallel failed:', error)
      setComparisonState('idle')
      setComparisonMode(null)
      toast.error('Auto-steer failed. Falling back to normal response.')
      
      // Fall back to single response
      await handleSingleResponse(messages)
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
      
      // Set the original response for comparison
      setOriginalResponseForComparison(lastAssistantMessage.content)
      setComparisonResponse('') // Start empty, will stream in
      
      // Get conversation history up to and including the last user message
      const lastUserIndex = currentConversation.messages.indexOf(lastUserMessage)
      const messagesForComparison = currentConversation.messages.slice(0, lastUserIndex + 1)
      
      // Generate steered response (backend will apply pending modifications)
      const comparisonStream = await conversationApi.sendMessage(conversation.id!, messagesForComparison)
      const reader = comparisonStream.getReader()
      
      // Enter streaming state
      setComparisonState('streaming')
      
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
      
      setComparisonState('complete')
      console.log('Comparison response streaming completed successfully')
      
    } catch (error) {
      console.error('Failed to generate comparison response:', error)
      // Exit comparison mode on error
      setComparisonState('idle')
      setComparisonMode(null)
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
      // Immediately enter manual steering mode and clear right side for instant feedback
      setComparisonState('steering')
      setComparisonMode('manual')
      setComparisonResponse('') // Clear old content so skeleton shows
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
      setComparisonState('idle')
      setComparisonMode(null)
      setComparisonResponse('')
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
      setComparisonState('idle')
      setComparisonMode(null)
      setComparisonResponse('')
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
        <div className={`flex-1 ${isControlsVisible ? 'w-6/10' : 'w-full'} transition-all duration-300`}>
          <Chat
            conversation={conversation}
            comparisonState={comparisonState}
            comparisonMode={comparisonMode}
            comparisonResponse={comparisonResponse}
            originalResponseForComparison={originalResponseForComparison}
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
          <div className="w-4/10 border-l border-border">
            <Controls
              features={processedFeatures}
              selectedFeature={selectedFeature}
              onFeatureSelect={handleFeatureSelect}
              onSteer={handleSteer}
              isLoading={featuresLoading || (comparisonState !== 'idle' && comparisonState !== 'complete')}
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
