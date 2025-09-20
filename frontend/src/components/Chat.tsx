import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { ChatMessage } from '@/types/conversation';
import { chatApi, featuresApi } from '@/lib/api';
import { Textarea } from './ui/textarea';
import { useVariant } from '@/hooks/useVariant';
import { useFeatureActivations } from '@/contexts/ActivatedFeatureContext';
import { createLogger } from '@/lib/logger';
import { ComparisonView } from './ComparisonView';
import { SuggestedPrompts } from './SuggestedPrompts';
import { ChatLoadingState, LoadingStateInfo, createLoadingState } from '@/types/ui';
import ReactMarkdown from 'react-markdown';
import { ArrowUp } from 'lucide-react';

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
    setIsComparingResponses,
    currentResponse,
    autoSteerEnabled,
    setPendingFeatures,
    setSteeredResponse
  } = useVariant();
  const { setActiveFeatures, setFeatureClusters } = useFeatureActivations();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loadingState, setLoadingState] = useState<LoadingStateInfo<ChatLoadingState>>(
    createLoadingState(ChatLoadingState.IDLE)
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wasComparingRef = useRef<boolean>(false);
  const [showSuggestedPrompts, setShowSuggestedPrompts] = useState(true);

  const isLoading = loadingState.state !== ChatLoadingState.IDLE;

  useEffect(() => {
    if (isComparingResponses) {
      wasComparingRef.current = true;
    }
  }, [isComparingResponses]);

  useEffect(() => {
    if (!isComparingResponses && wasComparingRef.current && currentResponse && messages.length > 0) {
      logger.debug('Exiting comparison mode, updating messages with current response');
      
      const lastAssistantIndex = [...messages].reverse().findIndex(m => m.role === 'assistant');
      
      if (lastAssistantIndex !== -1) {
        const actualIndex = messages.length - 1 - lastAssistantIndex;
        
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
      setLoadingState(createLoadingState(ChatLoadingState.INSPECTING_FEATURES));
      logger.debug('Inspecting features for messages', { messageCount: messageList.length });
      
      const features = await featuresApi.inspectFeatures({
        messages: messageList,
        session_id: "default_session"
      });
      
      logger.debug('Feature inspection completed', { featureCount: features.length });
      setActiveFeatures(features);
      
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
      setLoadingState(createLoadingState(ChatLoadingState.IDLE, 
        error instanceof Error ? error : new Error(String(error))
      ));
    } finally {
      setLoadingState(createLoadingState(ChatLoadingState.IDLE));
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
    setLoadingState(createLoadingState(ChatLoadingState.SENDING));

    try {
      const response = await chatApi.createChatCompletion({
        messages: [...messages, userMessage],
        variant_id: variantId,
        auto_steer: autoSteerEnabled
      });

      logger.debug('Response from API', { response });

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response.content,
      };

      // Handle auto-steered responses
      if (response.auto_steered && response.auto_steer_result) {
        logger.info('Received auto-steered response', {
          hasOriginal: !!response.auto_steer_result.original_content,
          hasSteered: !!response.auto_steer_result.steered_content,
          featureCount: response.auto_steer_result.applied_features.length
        });
        
        // Store the original response for comparison
        setOriginalResponseFromChat(response.auto_steer_result.original_content);
        
        // Set the steered response in the variant context
        setSteeredResponse(response.auto_steer_result.steered_content);
        
        // Set pending features from auto-steer suggestions
        const newPendingFeatures = new Map<string, number>();
        response.auto_steer_result.applied_features.forEach(feature => {
          newPendingFeatures.set(feature.label, feature.modified_value);
        });
        setPendingFeatures(newPendingFeatures);
        
        // Create assistant messages for both original and steered responses
        const originalAssistantMessage: ChatMessage = {
          role: 'assistant',
          content: response.auto_steer_result.original_content
        };
        
        const steeredAssistantMessage: ChatMessage = {
          role: 'assistant',
          content: response.auto_steer_result.steered_content
        };
        
        // Update message list with original response initially
        const updatedMessages = [...messages, userMessage, originalAssistantMessage];
        setMessages(updatedMessages);
        
        // Enter comparison mode
        setIsComparingResponses(true);
        
        if (response.variant_id && response.variant_id !== variantId) {
          setVariantId(response.variant_id);
          onVariantChange?.(response.variant_id);
        }
        
        await processFeatures(updatedMessages);
        return;
      }

      // Normal response handling (no auto-steer)
      const updatedMessages = [...messages, userMessage, assistantMessage];
      setMessages(updatedMessages);
      
      if (response.variant_id && response.variant_id !== variantId) {
        setVariantId(response.variant_id);
        onVariantChange?.(response.variant_id);
      }
      
      await processFeatures(updatedMessages);
    } catch (error) {
      logger.error('Failed to send message', { 
        error: error instanceof Error ? { message: error.message } : { raw: String(error) } 
      });
      setLoadingState(createLoadingState(ChatLoadingState.IDLE, 
        error instanceof Error ? error : new Error(String(error))
      ));
    } finally {
      setLoadingState(createLoadingState(ChatLoadingState.IDLE));
    }
  };

  const regenerateLastMessage = useCallback(async () => {
    if (messages.length < 2) return;

    logger.debug('Starting regenerateLastMessage', { messageCount: messages.length });
    setLoadingState(createLoadingState(ChatLoadingState.REGENERATING));
    
    const lastUserIndex = [...messages].reverse().findIndex(m => m.role === 'user');
    if (lastUserIndex === -1) return;
    
    const lastAssistantMessage = [...messages].reverse().find(m => m.role === 'assistant');
    
    const contextMessages = messages.slice(0, messages.length - lastUserIndex);

    try {
      const hasPending = hasPendingFeatures();
      
      if (hasPending && lastAssistantMessage) {
        setOriginalResponseFromChat(lastAssistantMessage.content);
        
        try {
          await generateSteeredResponse(contextMessages);
        } catch (genError) {
          logger.error('Error during generateSteeredResponse', {
            error: genError instanceof Error ? { message: genError.message } : { raw: String(genError) }
          });
          setLoadingState(createLoadingState(ChatLoadingState.IDLE, 
            genError instanceof Error ? genError : new Error(String(genError))
          ));
        }
        
        setLoadingState(createLoadingState(ChatLoadingState.IDLE));
        return;
      }
    } finally {
      setLoadingState(createLoadingState(ChatLoadingState.IDLE));
    }
  }, [
    messages, 
    logger, 
    hasPendingFeatures, 
    setOriginalResponseFromChat, 
    generateSteeredResponse 
  ]);

  useEffect(() => {
    if (window) {
      window.regenerateLastMessage = regenerateLastMessage;
    }
  }, [regenerateLastMessage]);

  const refreshFeaturesCallback = useCallback(async () => {
    logger.debug('Refreshing activated features after steering confirmed');
    return processFeatures(messages);
  }, [messages]);

  useEffect(() => {
    if (messages.length > 0) {
      setShowSuggestedPrompts(false);
    } else {
      setShowSuggestedPrompts(true);
    }
  }, [messages.length]);

  const handleSelectPrompt = (promptText: string) => {
    setInput(currentInput => {
      const newInput = currentInput.trim() ? `${currentInput} ${promptText}` : promptText;
      return newInput;
    });
    
    setShowSuggestedPrompts(false);
    
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        adjustTextareaHeight();
      }
    }, 0);
  };

  const getLoadingMessage = () => {
    switch (loadingState.state) {
      case ChatLoadingState.REGENERATING:
        return "Regenerating response...";
      case ChatLoadingState.SENDING:
        return "Generating response...";
      case ChatLoadingState.INSPECTING_FEATURES:
        return "Inspecting features...";
      default:
        return "Loading...";
    }
  };

  return (
    <div className="relative flex flex-col h-full border-0">
      {/* Floating badge container */}
      <div className="absolute top-0 left-0 right-0 z-20 flex justify-center pointer-events-none">
        <Badge 
          variant="outline" 
          className="mt-2 bg-background/80 backdrop-blur-sm shadow-sm pointer-events-auto"
        >
          variant: {variantId}
        </Badge>
      </div>
      <ScrollArea className="h-full px-2">
        <div className="flex flex-col items-center w-full space-y-4 pt-12">
          {/* Regular chat messages in a bounded container */}
          <div className="w-full max-w-2xl space-y-4">
            {
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
                  {message.role === 'user' ? (
                    <div className="whitespace-pre-wrap">{message.content}</div>
                  ) : (
                    <div className="prose prose-base">
                      <ReactMarkdown>
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && !isComparingResponses && (
              <div className="text-gray-500">
                {getLoadingMessage()}
              </div>
            )}
          </div>
          
          {/* ComparisonView in a wider container but still in the message flow */}
          {isComparingResponses && (
            <div className="w-full max-w-6xl">
              <ComparisonView 
                className="mt-4" 
                refreshFeatures={refreshFeaturesCallback} 
              />
            </div>
          )}
          
          {messages.length === 0 && showSuggestedPrompts && (
            <div className="px-2 pb-4 max-w-4xl mx-auto absolute bottom-0 left-0 right-0">
              <SuggestedPrompts onSelectPrompt={handleSelectPrompt} />
            </div>
          )}
        </div>
      </ScrollArea>
      
      <div className="p-2 border-t">
        <div className="flex gap-2 items-end max-w-2xl mx-auto">
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
          <Button 
            onClick={sendMessage} 
            disabled={isLoading || isComparingResponses}
            aria-label="Send message"
            className="h-10 w-10 rounded-full flex items-center justify-center self-end"
          >
            <ArrowUp className="h-4 w-4 stroke-3" />
          </Button>
        </div>
      </div>
    </div>
  );
} 