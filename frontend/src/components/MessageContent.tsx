import ReactMarkdown from 'react-markdown'
import type { ChatMessage } from '@/types'

interface MessageContentProps {
  message: ChatMessage
  className?: string
}

/**
 * Component for rendering message content with markdown support.
 * Handles both user and assistant messages with appropriate styling.
 */
export default function MessageContent({ message, className = '' }: MessageContentProps) {
  return (
    <div className={`text-foreground ${className}`}>
      <ReactMarkdown
        components={{
          // Paragraphs - preserve whitespace and line breaks
          p: ({ children }) => (
            <div className="whitespace-pre-wrap leading-relaxed mb-3 last:mb-0">
              {children}
            </div>
          ),
          // Headings
          h1: ({ children }) => (
            <h1 className="text-xl font-semibold mb-3 mt-4 first:mt-0 text-foreground">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-semibold mb-2 mt-3 first:mt-0 text-foreground">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-semibold mb-2 mt-3 first:mt-0 text-foreground">
              {children}
            </h3>
          ),
          // Code blocks
          pre: ({ children }) => (
            <pre className="overflow-x-auto p-3 my-3 rounded-md bg-muted border border-border text-sm font-mono">
              {children}
            </pre>
          ),
          // Inline code
          code: ({ children, className }) => {
            const isInlineCode = !className?.includes('language-')
            if (isInlineCode) {
              return (
                <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-foreground">
                  {children}
                </code>
              )
            }
            return <code className={className}>{children}</code>
          },
          // Lists
          ul: ({ children }) => (
            <ul className="list-disc list-inside space-y-1 my-3 pl-4 text-foreground">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside space-y-1 my-3 pl-4 text-foreground">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="text-foreground leading-relaxed">{children}</li>
          ),
          // Links
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline hover:text-primary/80 transition-colors"
            >
              {children}
            </a>
          ),
          // Blockquotes
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-border pl-4 my-3 text-muted-foreground italic">
              {children}
            </blockquote>
          ),
          // Strong and emphasis
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-foreground">{children}</em>
          ),
          // Horizontal rule
          hr: () => <hr className="my-4 border-border" />,
          // Tables
          table: ({ children }) => (
            <div className="overflow-x-auto my-3">
              <table className="min-w-full border-collapse border border-border">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-border px-3 py-2 bg-muted text-left font-semibold text-foreground">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-border px-3 py-2 text-foreground">
              {children}
            </td>
          ),
        }}
      >
        {message.content}
      </ReactMarkdown>
    </div>
  )
}
