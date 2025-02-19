import { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { ScrollArea } from './ui/scroll-area';
import { ChatMessage } from '@/types/chat';
import { chatApi } from '@/lib/api';
import { Textarea } from './ui/textarea';

interface ChatProps {
  onMessagesUpdate?: (messages: ChatMessage[]) => void;
}

export function Chat({ onMessagesUpdate }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentVariant, setCurrentVariant] = useState<string>("default");
  const [variantJson, setVariantJson] = useState<string>("");
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Add auto-resize effect
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
      });

      console.log('Response from API:', response);

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response.content,
      };

      const updatedMessages = [...messages, userMessage, assistantMessage];
      setMessages(updatedMessages);
      setCurrentVariant(response.variant_id);
      if (response.variant_json) {
        console.log('Setting variant JSON:', response.variant_json);
        setVariantJson(response.variant_json);
      } else {
        console.log('No variant JSON in response');
      }
      
      // Notify parent about message updates
      onMessagesUpdate?.(updatedMessages);
    } catch (error) {
      console.error('Failed to send message:', error);
      // TODO: Add error handling UI
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="flex flex-col h-full">
      <div className="p-2 border-b bg-muted/50">
        <div className="text-sm text-muted-foreground space-y-1">
          <div>Current Variant: <span className="font-medium">{currentVariant}</span></div>
          {variantJson && (
            <div className="text-xs font-mono whitespace-pre-wrap overflow-x-auto max-h-32">
              {variantJson}
            </div>
          )}
        </div>
      </div>
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`${
                message.role === 'user' ? 'text-blue-600' : 'text-gray-700'
              }`}
            >
              <div className="font-bold">{message.role}:</div>
              <div className="whitespace-pre-wrap">{message.content}</div>
            </div>
          ))}
          {isLoading && <div className="text-gray-500">Loading...</div>}
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