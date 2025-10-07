import { useState, useEffect, useRef } from 'react'
import { ArrowUp } from 'lucide-react'
import type { ConversationState, ChatMessage, UnifiedFeature } from '@/types'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import MessageContent from './MessageContent'

interface ChatProps {
  conversation: ConversationState
  isInComparisonMode: boolean
  comparisonResponse: string
  originalResponseForComparison: string
  isComparisonStreaming: boolean
  onSendMessage: (content: string) => Promise<void>
  onConfirmChanges: () => Promise<void>
  onRejectChanges: () => Promise<void>
  isStreaming: boolean
  featuresLoading: boolean
  isDeveloperMode: boolean
  pendingFeatures: UnifiedFeature[]
}

export default function Chat({
  conversation,
  isInComparisonMode,
  comparisonResponse,
  originalResponseForComparison,
  isComparisonStreaming,
  onSendMessage,
  onConfirmChanges,
  onRejectChanges,
  isStreaming,
  featuresLoading,
  isDeveloperMode,
  pendingFeatures
}: ChatProps) {
  const [inputMessage, setInputMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]')
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    }
  }, [conversation.messages])

  const handleSendMessage = async () => {
    const trimmedMessage = inputMessage.trim()
    if (!trimmedMessage || isStreaming) return

    try {
      setError(null)
      setInputMessage('')
      
      await onSendMessage(trimmedMessage)
    } catch (error) {
      console.error('Failed to send message:', error)
      setError('Failed to send message. Please try again.')
      // Restore the message in input on error
      setInputMessage(trimmedMessage)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const renderMessage = (message: ChatMessage, index: number) => {
    const isUser = message.role === 'user'
    
    return (
      <div
        key={index}
        className={`my-4 flex ${isUser ? 'justify-end' : 'justify-start'}`}
      >
        <div
          className={`max-w-[90%] rounded-lg ${
            isUser
              ? 'bg-secondary text-foreground px-3 py-2'
              : 'text-foreground'
          }`}
        >
          <MessageContent message={message} />
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col relative">
      {/* Debug Overlay */}
      {isDeveloperMode && (
        <div className="absolute top-2 right-2 z-10 bg-background/50 backdrop-blur-sm border rounded-lg p-2 text-xs text-muted-foreground shadow-sm">
          <div className="space-y-1">
            <div><strong>Conversation:</strong> {conversation.id || 'Loading...'}</div>
            <div><strong>Variant:</strong> {conversation.currentVariant?.label || 'None'}</div>
            <div><strong>Messages:</strong> {conversation.messages.length}</div>
            <div><strong>Streaming:</strong> {isStreaming ? 'Yes' : 'No'}</div>
            <div><strong>Features:</strong> {featuresLoading ? 'Loading...' : 'Ready'}</div>
            <div><strong>Comparison:</strong> {isInComparisonMode ? 'Active' : 'Off'}</div>
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-hidden">
        {conversation.messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground bg-muted text-center">
            <p className="text-base">Start a conversation</p>
          </div>
        ) : (
          <ScrollArea ref={scrollAreaRef} className="h-full">
            <div className="max-w-3xl mx-auto p-4">
              <div>
                {conversation.messages.map((message, index) => {
                  // Hide the last assistant message when in comparison mode
                  if (isInComparisonMode) {
                    const lastAssistantIndex = [...conversation.messages].map((m, i) => m.role === 'assistant' ? i : -1)
                      .filter(i => i !== -1)
                      .pop() ?? -1
                    if (index === lastAssistantIndex && message.role === 'assistant') {
                      return null
                    }
                  }
                  return renderMessage(message, index)
                })}
                {/* Show comparison mode content if active */}
                {isInComparisonMode && (
                  <div className="mt-6 space-y-4">
                    <div className="text-center">
                      <h3 className="text-lg font-medium text-foreground">Which response do you prefer?</h3>
                      <p className="text-sm text-muted-foreground">Click on the response you'd like to keep</p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Original Response Card */}
                      <div 
                        className="p-4 border rounded-lg bg-card hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={onRejectChanges}
                      >
                        <div className="text-sm font-medium mb-2 text-sm text-muted-foreground text-center font-mono">ORIGINAL RESPONSE</div>
                        <div className="text-base text-foreground">
                          <MessageContent message={{ role: 'assistant', content: originalResponseForComparison }} />
                        </div>
                      </div>
                      
                      {/* Steered Response Card */}
                      <div 
                        className={`p-4 border rounded-lg bg-card transition-colors ${
                          isComparisonStreaming ? '' : 'hover:bg-muted/50 cursor-pointer'
                        }`}
                        onClick={isComparisonStreaming ? undefined : onConfirmChanges}
                      >
                        <div className="text-sm font-medium text-sm mb-2 text-muted-foreground text-center gap-2 text-center font-mono">STEERED RESPONSE</div>
                        <div className="text-base text-foreground">
                          {comparisonResponse ? (
                            <MessageContent message={{ role: 'assistant', content: comparisonResponse }} />
                          ) : isComparisonStreaming ? (
                            <span className="text-muted-foreground italic">Generating steered response...</span>
                          ) : null}
                        </div>
                        
                        {/* Pending Features Badges */}
                        {pendingFeatures.length > 0 && (
                          <div className="mt-2 pt-2">
                            <div className="text-xs text-muted-foreground mb-2 font-medium">Pending Changes:</div>
                            <div className="flex flex-wrap gap-1">
                              {pendingFeatures.map((feature) => (
                                <Badge
                                  key={feature.uuid}
                                  variant="secondary"
                                  className="text-xs"
                                >
                                  {feature.label}: {feature.pending_modification !== null ? feature.pending_modification.toFixed(1) : '0.0'}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="px-4 py-2 bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Input Area */}
      <div className="border-t border-border px-4 py-3">
        <div className="flex gap-2 items-end max-w-3xl mx-auto">
          <div className="flex-1">
            <Textarea
              ref={textareaRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              disabled={isStreaming}
              className="min-h-[40px] max-h-32 resize-none"
              rows={1}
            />
          </div>
          <Button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || isStreaming}
            size="icon"
            className="rounded-full h-10 w-10 shrink-0"
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
