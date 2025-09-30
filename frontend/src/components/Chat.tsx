import type { ConversationState } from '@/types'

interface ChatProps {
  conversation: ConversationState
  isInComparisonMode: boolean
  comparisonResponse: string
  onSendMessage: (content: string) => Promise<void>
  onConfirmChanges: () => Promise<void>
  onRejectChanges: () => Promise<void>
}

export default function Chat({
  conversation,
  isInComparisonMode,
  comparisonResponse,
  onSendMessage,
  onConfirmChanges,
  onRejectChanges
}: ChatProps) {
  return (
    <div className="h-full p-4 bg-background">
      <div className="text-lg font-medium">Chat Component</div>
      <div className="mt-2 text-sm text-muted-foreground">
        <p>Conversation ID: {conversation.id || 'Loading...'}</p>
        {/* <p>Variant ID: {conversation.currentVariant.label || 'Loading...'}</p> */}
        <p>Messages: {conversation.messages.length}</p>
        <p>Comparison Mode: {isInComparisonMode ? 'Yes' : 'No'}</p>
        <p>Current Variant: {conversation.currentVariant?.label || 'None'}</p>
      </div>
    </div>
  )
}
