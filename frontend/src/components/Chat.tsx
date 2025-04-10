import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { ScrollArea } from './ui/scroll-area';
import { ChatMessage } from '@/types/chat';
import { chatApi, featuresApi } from '@/lib/api';
import { Textarea } from './ui/textarea';
import { useVariant } from '@/contexts/VariantContext';
import { useFeatureActivations } from '@/contexts/FeatureActivationContext';
import { createLogger } from '@/lib/logger';
import { ComparisonView } from './ComparisonView';

interface ChatProps {
  onVariantChange?: (variantId: string) => void;
}

export function Chat({ onVariantChange }: ChatProps) {
  const logger = createLogger('Chat');
  const { 
    variantId, 
    setVariantId, 
    hasPendingFeatures, 
    setOriginalResponseFromChat,
    generateSteeredResponse,
    isComparingResponses,
    currentResponse
  } = useVariant();
  const { setActiveFeatures, setFeatureClusters } = useFeatureActivations();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wasComparingRef = useRef<boolean>(false);

  // Track when comparison mode changes
  useEffect(() => {
    // Only track when isComparingResponses is true
    if (isComparingResponses) {
      wasComparingRef.current = true;
    }
  }, [isComparingResponses]);

  // Add a useEffect to track when comparison mode ends and update messages
  useEffect(() => {
    // Only run this effect when exiting comparison mode and we have a current response
    if (!isComparingResponses && wasComparingRef.current && currentResponse && messages.length > 0) {
      logger.debug('Exiting comparison mode, updating messages with current response');
      
      // Find the last assistant message in the array using reverse search
      const lastAssistantIndex = [...messages].reverse().findIndex(m => m.role === 'assistant');
      
      if (lastAssistantIndex !== -1) {
        // Convert the reverse index to normal index
        const actualIndex = messages.length - 1 - lastAssistantIndex;
        
        // Update the message
        const updatedMessages = [...messages];
        updatedMessages[actualIndex] = {
          ...updatedMessages[actualIndex],
          content: currentResponse
        };
        setMessages(updatedMessages);
        
        logger.debug('Updated last assistant message with steered response', {
          messageIndex: actualIndex,
          messageCount: messages.length
        });
      } else {
        logger.warn('Could not find assistant message to update');
      }
      
      // Reset the tracking ref
      wasComparingRef.current = false;
    }
  }, [isComparingResponses, currentResponse, messages, logger]);

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = '0px';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [input]);

  const processFeatures = async (messageList: ChatMessage[]) => {
    try {
      logger.debug('Inspecting features for messages', { messageCount: messageList.length });
      
      // Step 1: Call inspect features
      const features = await featuresApi.inspectFeatures({
        messages: messageList,
        session_id: "default_session" // TODO: Use real session management
      });
      
      logger.debug('Feature inspection completed', { featureCount: features.length });
      setActiveFeatures(features);
      
      // Step 2: Cluster the features
      if (features.length > 0) {
        logger.debug('Clustering features', { featureCount: features.length });
        const clusterResponse = await featuresApi.clusterFeatures(
          features,
          "default_session",
          variantId
        );
        
        if (clusterResponse?.clusters) {
          logger.debug('Feature clustering completed', { 
            clusterCount: clusterResponse.clusters.length 
          });
          setFeatureClusters(clusterResponse.clusters);
        }
      }
    } catch (error) {
      logger.error('Failed to process features', { 
        error: error instanceof Error ? { message: error.message } : { raw: String(error) } 
      });
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await chatApi.createChatCompletion({
        messages: [...messages, userMessage],
        variant_id: variantId
      });

      logger.debug('Response from API', { response });

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response.content,
      };

      const updatedMessages = [...messages, userMessage, assistantMessage];
      setMessages(updatedMessages);
      
      // Update variant if returned in response
      if (response.variant_id && response.variant_id !== variantId) {
        setVariantId(response.variant_id);
        onVariantChange?.(response.variant_id);
      }
      
      // Process features after completion
      await processFeatures(updatedMessages);
    } catch (error) {
      logger.error('Failed to send message', { 
        error: error instanceof Error ? { message: error.message } : { raw: String(error) } 
      });
      // TODO: Add error handling UI
    } finally {
      setIsLoading(false);
    }
  };

  const regenerateLastMessage = useCallback(async () => {
    if (messages.length < 2) return;

    logger.debug('Starting regenerateLastMessage', { messageCount: messages.length });
    setIsLoading(true);
    setIsRegenerating(true);
    
    const lastUserIndex = [...messages].reverse().findIndex(m => m.role === 'user');
    if (lastUserIndex === -1) return;
    
    // Find the most recent assistant message to use as the original response
    const lastAssistantMessage = [...messages].reverse().find(m => m.role === 'assistant');
    
    // Get all the messages up to and including the last user message
    const contextMessages = messages.slice(0, messages.length - lastUserIndex);

    try {
      // Check if we have pending features that need comparison
      const hasPending = hasPendingFeatures();
      
      if (hasPending && lastAssistantMessage) {
        // Set the original response in the variant context
        setOriginalResponseFromChat(lastAssistantMessage.content);
        
        // Generate a steered response using the message context
        try {
          await generateSteeredResponse(contextMessages);
        } catch (genError) {
          logger.error('Error during generateSteeredResponse', {
            error: genError instanceof Error ? { message: genError.message } : { raw: String(genError) }
          });
        }
        
        // Stop here when comparison mode is active
        // The ComparisonView component will handle the rest of the flow
        setIsLoading(false);
        setIsRegenerating(false);
        return;
      }
    } finally {
      setIsLoading(false);
      setIsRegenerating(false);
    }
  }, [
    messages, 
    logger, 
    setIsLoading, 
    setIsRegenerating, 
    hasPendingFeatures, 
    setOriginalResponseFromChat, 
    generateSteeredResponse, 
    isComparingResponses
  ]);

  // Expose regenerateLastMessage to parent components
  useEffect(() => {
    if (window) {
      // @ts-ignore
      window.regenerateLastMessage = regenerateLastMessage;
    }
  }, [regenerateLastMessage]);

  // Create a callback for feature refresh
  const refreshFeaturesCallback = useCallback(async () => {
    logger.debug('Refreshing activated features after steering confirmed');
    return processFeatures(messages);
  }, [messages]);

  return (
    <div className="flex flex-col h-full border-0">
      <div className="p-2 border-b bg-muted/50">
        <div className="text-sm text-muted-foreground space-y-1">
          <div>Current Variant: <span className="font-medium">{variantId}</span></div>
        </div>
      </div>
      <ScrollArea className="flex-1 p-2">
        <div className="space-y-4">
          {
            // When in comparison mode, filter out the last assistant message
            (isComparingResponses 
              ? messages.filter((_, idx) => !(
                  messages[idx].role === 'assistant' && 
                  idx === messages.length - 1
                ))
              : messages
            ).map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`${
                  message.role === 'user'
                    ? 'bg-gray-100 rounded-lg px-3 py-2 max-w-[80%]'
                    : 'max-w-[90%]'
                } ${
                  message.role === 'user' ? 'text-gray-700' : 'text-gray-700'
                }`}
              >
                <div className="whitespace-pre-wrap">{message.content}</div>
              </div>
            </div>
          ))}
          {isLoading && !isComparingResponses && (
            <div className="text-gray-500">
              {isRegenerating ? "Regenerating..." : "Loading..."}
            </div>
          )}
          
          {/* Comparison View */}
          {isComparingResponses && (
            <div className="w-full">
              <ComparisonView 
                className="mt-4" 
                refreshFeatures={refreshFeaturesCallback} 
              />
            </div>
          )}
        </div>
      </ScrollArea>
      <div className="p-2 border-t">
        <div className="flex gap-2 items-end">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Type a message..."
            disabled={isLoading || isComparingResponses}
            className="min-h-[40px] max-h-[200px] resize-none overflow-hidden"
            rows={1}
          />
          <Button onClick={sendMessage} disabled={isLoading || isComparingResponses}>
            Send
          </Button>
        </div>
      </div>
    </div>
  );
} 