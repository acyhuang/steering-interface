import React from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { useVariant } from '@/contexts/VariantContext';
import { createLogger } from '@/lib/logger';
import { SteeringLoadingState } from '@/types/loading';

interface ComparisonViewProps {
  className?: string;
  refreshFeatures?: () => Promise<void>;
}

export function ComparisonView({ className, refreshFeatures }: ComparisonViewProps) {
  const logger = createLogger('ComparisonView');
  const {
    originalResponse,
    steeredResponse,
    confirmSteeredResponse,
    cancelSteering,
    steeringState,
    generationError
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
      
      <div className="grid grid-cols-2 gap-4">
        {/* Original Response */}
        <Card 
          className="w-full h-full border-2 hover:border-primary cursor-pointer p-4 hover:bg-accent/50 transition-colors"
          onClick={handleSelectOriginal}
        >
          <div className="mb-2 text-sm text-center text-muted-foreground">Original Response</div>
          <div className="text-left whitespace-pre-wrap">
            {originalResponse}
          </div>
        </Card>

        {/* Steered Response */}
        <Card 
          className="w-full h-full border-2 hover:border-primary cursor-pointer p-4 hover:bg-accent/50 transition-colors"
          onClick={handleSelectSteered}
        >
          <div className="mb-2 text-sm text-center text-muted-foreground">Steered Response</div>
          <div className="text-left whitespace-pre-wrap">
            {steeredResponse}
          </div>
        </Card>
      </div>
    </div>
  );
} 