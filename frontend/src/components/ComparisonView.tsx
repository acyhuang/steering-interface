import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { useVariant } from '@/hooks/useVariant';
import { createLogger } from '@/lib/logger';
import { SteeringLoadingState } from '@/types/ui';
import ReactMarkdown from 'react-markdown';

interface ComparisonViewProps {
  className?: string;
  refreshFeatures?: () => Promise<void>;
}

// Simple component to display a feature adjustment
interface FeatureBadgeProps {
  label: string;
  value: number;
}

function FeatureBadge({ label, value }: FeatureBadgeProps) {
  // Format the value with "+" prefix for positive values
  const formattedValue = value > 0 ? `+${value}` : `${value}`;
  
  return (
    <Badge 
      variant="outline"
      className="text-sm text-muted-foreground font-normal mr-1 mb-1"
    >
      {label}: {formattedValue}
    </Badge>
  );
}

export function ComparisonView({ className, refreshFeatures }: ComparisonViewProps) {
  const logger = createLogger('ComparisonView');
  const {
    originalResponse,
    steeredResponse,
    confirmSteeredResponse,
    cancelSteering,
    steeringState,
    generationError,
    pendingFeatures
  } = useVariant();

  const handleSelectOriginal = () => {
    logger.debug('User selected original response');
    cancelSteering();
  };

  const handleSelectSteered = () => {
    logger.debug('User selected steered response');
    confirmSteeredResponse(refreshFeatures);
  };

  // Check if we're in a generating state
  const isGenerating = steeringState.state === SteeringLoadingState.GENERATING_RESPONSE;
  
  // Check if we're in a confirming or canceling state
  const isProcessing = 
    steeringState.state === SteeringLoadingState.CONFIRMING || 
    steeringState.state === SteeringLoadingState.CANCELING;

  if (isGenerating) {
    return (
      <div className={`flex flex-col gap-2 p-4 ${className}`}>
        <div className="text-center font-medium text-muted-foreground">
          Generating steered response...
        </div>
        <div className="flex justify-center">
          <div className="animate-pulse w-8 h-8 rounded-full bg-muted"></div>
        </div>
      </div>
    );
  }

  if (isProcessing) {
    const actionText = steeringState.state === SteeringLoadingState.CONFIRMING 
      ? "Confirming" 
      : "Canceling";
      
    return (
      <div className={`flex flex-col gap-2 p-4 ${className}`}>
        <div className="text-center font-medium text-muted-foreground">
          {actionText} response choice...
        </div>
        <div className="flex justify-center">
          <div className="animate-pulse w-8 h-8 rounded-full bg-muted"></div>
        </div>
      </div>
    );
  }

  if (generationError) {
    return (
      <div className={`flex flex-col gap-2 p-4 ${className}`}>
        <div className="text-center font-medium text-destructive">
          Error generating steered response
        </div>
        <div className="text-sm text-muted-foreground border rounded-md p-2 bg-destructive/10">
          {generationError.message}
        </div>
        <div className="flex justify-center gap-2 mt-2">
          <Button variant="outline" onClick={cancelSteering}>Cancel</Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      <div className="text-center font-medium text-muted-foreground">
        Which response do you prefer?
      </div>
      
      <div className="grid grid-cols-2 gap-6">
        {/* Original Response */}
        <Card 
          className="w-full h-full border-2 hover:border-primary cursor-pointer p-6 hover:bg-accent/50 transition-colors"
          onClick={handleSelectOriginal}
        >
          <div className="mb-2 text-sm font-medium text-center text-muted-foreground uppercase">Original Response</div>
          <div className="prose prose-base max-w-none">
            <ReactMarkdown>
              {originalResponse}
            </ReactMarkdown>
          </div>
        </Card>

        {/* Steered Response */}
        <Card 
          className="w-full h-full border-2 hover:border-primary cursor-pointer p-6 hover:bg-accent/50 transition-colors"
          onClick={handleSelectSteered}
        >
          <div className="mb-2 text-sm font-medium text-center text-muted-foreground uppercase">Steered Response</div>
          <div className="prose prose-base max-w-none">
            <ReactMarkdown>
              {steeredResponse}
            </ReactMarkdown>
          </div>

          {/* Feature adjustment badges */}
          {pendingFeatures.size > 0 && (
            <div className="flex flex-wrap mt-4">
              <div className="w-full text-sm font-medium text-muted-foreground my-2">
                Applied feature adjustments:
              </div>
              {Array.from(pendingFeatures.entries()).map(([label, value]) => (
                <FeatureBadge key={label} label={label} value={value} />
              ))}
            </div>
          )}
          
        </Card>
      </div>
    </div>
  );
} 