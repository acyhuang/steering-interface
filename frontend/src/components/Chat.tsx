import { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { ScrollArea } from './ui/scroll-area';
import { ChatMessage } from '@/types/chat';
import { chatApi, featuresApi } from '@/lib/api';
import { Textarea } from './ui/textarea';
import { useVariant } from '@/contexts/VariantContext';
import { useFeatureActivations } from '@/contexts/FeatureActivationContext';
import { createLogger } from '@/lib/logger';

interface ChatProps {
  onVariantChange?: (variantId: string) => void;
}

export function Chat({ onVariantChange }: ChatProps) {
  const logger = createLogger('Chat');
  const { variantId, setVariantId } = useVariant();
  const { setActiveFeatures, setFeatureClusters } = useFeatureActivations();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const regenerateLastMessage = async () => {
    if (messages.length < 2) return;

    setIsLoading(true);
    setIsRegenerating(true);
    
    const lastUserIndex = [...messages].reverse().findIndex(m => m.role === 'user');
    if (lastUserIndex === -1) return;
    
    const contextMessages = messages.slice(0, messages.length - lastUserIndex);
    setMessages(contextMessages);

    try {
      const response = await chatApi.createChatCompletion({
        messages: contextMessages,
        variant_id: variantId
      });

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response.content,
      };

      const updatedMessages = [...contextMessages, assistantMessage];
      setMessages(updatedMessages);
      
      // Update variant if returned in response
      if (response.variant_id && response.variant_id !== variantId) {
        setVariantId(response.variant_id);
        onVariantChange?.(response.variant_id);
      }
      
      // Process features after regeneration
      await processFeatures(updatedMessages);
    } catch (error) {
      logger.error('Failed to regenerate message', { 
        error: error instanceof Error ? { message: error.message } : { raw: String(error) } 
      });
    } finally {
      setIsLoading(false);
      setIsRegenerating(false);
    }
  };

  // Expose regenerateLastMessage to parent components
  useEffect(() => {
    if (window) {
      // @ts-ignore
      window.regenerateLastMessage = regenerateLastMessage;
    }
  }, [messages]);

  return (
    <Card className="flex flex-col h-full">
      <div className="p-2 border-b bg-muted/50">
        <div className="text-sm text-muted-foreground space-y-1">
          <div>Current Variant: <span className="font-medium">{variantId}</span></div>
        </div>
      </div>
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message, index) => (
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
          {isLoading && (
            <div className="text-gray-500">
              {isRegenerating ? "Regenerating..." : "Loading..."}
            </div>
          )}
        </div>
      </ScrollArea>
      <div className="p-4 border-t">
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
            disabled={isLoading}
            className="min-h-[40px] max-h-[200px] resize-none overflow-hidden"
            rows={1}
          />
          <Button onClick={sendMessage} disabled={isLoading}>
            Send
          </Button>
        </div>
      </div>
    </Card>
  );
} 