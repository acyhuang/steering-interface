import { Button } from './ui/button';

interface SuggestedPrompt {
  id: string;
  text: string;
}

interface SuggestedPromptsProps {
  onSelectPrompt: (text: string) => void;
}

export function SuggestedPrompts({ onSelectPrompt }: SuggestedPromptsProps) {
  const suggestedPrompts: SuggestedPrompt[] = [
    {
      id: 'summarize',
      text: 'Summarize this paragraph: '
    },
    {
      id: 'explain',
      text: 'Explain this concept as if I\'m a beginner: sparse autoencoders in large language models'
    },
    {
      id: 'write',
      text: 'Help me workshop this sentence by providing alternative phrasings: \"The coffee was really good and had a nice flavor.\"'
    },
    {
      id: 'hypothetical',
      text: 'If you could go back in time to the Constitutional Convention and do something different to avoid the Civil War, what would you do?'
    }
  ];

  return (
    <div className="mx-auto">
      <div className="grid grid-cols-4 gap-3">
        {suggestedPrompts.map((prompt) => (
          <Button
            key={prompt.id}
            variant="secondary"
            className="h-auto p-2 text-sm text-muted-foreground text-left font-normal justify-start border shadow-sm text-wrap"
            onClick={() => onSelectPrompt(prompt.text)}
          >
            {prompt.text}
          </Button>
        ))}
      </div>
    </div>
  );
} 