import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { createLogger } from '@/lib/logger';
import { featuresApi, chatApi } from '@/lib/api';
import { ChatMessage } from '@/types/chat';

// Logger for this context
const logger = createLogger('VariantContext');

// Define the context interface
interface VariantContextType {
  variantId: string;
  setVariantId: (id: string) => void;
  variantJson: any | null;
  refreshVariant: () => Promise<void>;
  
  // New properties for steering comparison
  pendingFeatures: Map<string, number>;
  lastConfirmedState: any | null;
  currentResponse: string | null;
  originalResponse: string | null;
  steeredResponse: string | null;
  isGeneratingSteeredResponse: boolean;
  isComparingResponses: boolean;
  generationError: Error | null;
  
  // New methods for steering comparison
  applyPendingFeatures: (featureLabel: string, value: number) => Promise<void>;
  confirmSteeredResponse: () => Promise<void>;
  cancelSteering: () => void;
  generateSteeredResponse: (messages: ChatMessage[]) => Promise<void>;
  hasPendingFeatures: () => boolean;
  setOriginalResponseFromChat: (content: string) => void;
}

// Create the context with a default value
const VariantContext = createContext<VariantContextType | undefined>(undefined);

// Provider props interface
interface VariantProviderProps {
  children: React.ReactNode;
  defaultVariantId?: string;
  defaultSessionId?: string;
}

/**
 * Provider component that wraps your app and makes variant values available
 */
export function VariantProvider({ 
  children, 
  defaultVariantId = 'default',
  defaultSessionId = 'default_session'
}: VariantProviderProps) {
  const [variantId, setVariantId] = useState<string>(defaultVariantId);
  const [sessionId, setSessionId] = useState<string>(defaultSessionId);
  const [variantJson, setVariantJson] = useState<any | null>(null);
  
  // New state for steering comparison
  const [pendingFeatures, setPendingFeatures] = useState<Map<string, number>>(new Map());
  const [lastConfirmedState, setLastConfirmedState] = useState<any | null>(null);
  const [originalResponse, setOriginalResponse] = useState<string | null>(null);
  const [currentResponse, setCurrentResponse] = useState<string | null>(null);
  const [steeredResponse, setSteeredResponse] = useState<string | null>(null);
  const [isGeneratingSteeredResponse, setIsGeneratingSteeredResponse] = useState<boolean>(false);
  const [isComparingResponses, setIsComparingResponses] = useState<boolean>(false);
  const [generationError, setGenerationError] = useState<Error | null>(null);

  // Function to refresh variant data from the backend
  const refreshVariant = useCallback(async () => {
    try {
      const response = await featuresApi.getModifiedFeatures(sessionId, variantId);
      setVariantJson(response);
      
      // When we get fresh variant data, also update the last confirmed state
      if (!lastConfirmedState) {
        setLastConfirmedState(response);
      }
    } catch (error) {
      logger.error('Failed to refresh variant data', { error });
    }
  }, [variantId, sessionId, lastConfirmedState]);

  // When variant ID changes, refresh the variant data
  useEffect(() => {
    refreshVariant();
  }, [variantId, refreshVariant]);

  /**
   * Applies a pending feature adjustment without committing it
   */
  const applyPendingFeatures = useCallback(async (featureLabel: string, value: number) => {
    logger.debug('Applying pending feature', { featureLabel, value });
    
    // Update pending features map
    setPendingFeatures(prevFeatures => {
      const newFeatures = new Map(prevFeatures);
      newFeatures.set(featureLabel, value);
      return newFeatures;
    });
  }, []);

  /**
   * Sets the original response from the Chat component
   */
  const setOriginalResponseFromChat = useCallback((content: string) => {
    logger.debug('Setting original response from Chat', { 
      contentLength: content.length
    });
    setOriginalResponse(content);
    setCurrentResponse(content);
  }, []);

  /**
   * Generates a new response using pending feature adjustments
   */
  const generateSteeredResponse = useCallback(async (messages: ChatMessage[]) => {
    // Clear any previous errors
    setGenerationError(null);
    
    // Skip if no pending features
    if (pendingFeatures.size === 0) {
      logger.debug('No pending features to apply');
      return;
    }
    
    try {
      setIsGeneratingSteeredResponse(true);
      
      // Convert pending features to edits array
      const pendingEdits = Array.from(pendingFeatures.entries()).map(([feature_label, value]) => ({
        feature_label,
        value
      }));
      
      logger.debug('Applying pending features for steered response', { 
        featureCount: pendingFeatures.size,
        features: pendingEdits
      });
      
      // Apply each pending feature to the backend
      for (const [featureLabel, value] of pendingFeatures.entries()) {
        await featuresApi.steerFeature({
          session_id: sessionId,
          variant_id: variantId,
          feature_label: featureLabel,
          value: value
        });
      }
      
      // Generate a new response with the modified variant
      const chatResponse = await chatApi.createChatCompletion({
        messages: messages,
        variant_id: variantId
      });
      
      // Set the steered response
      setSteeredResponse(chatResponse.content);
      
      // Enable comparison mode after generating steered response
      setIsComparingResponses(true);
      
      logger.debug('Generated steered response', {
        responseLength: chatResponse.content.length
      });
      
    } catch (error) {
      if (error instanceof Error) {
        setGenerationError(error);
      } else {
        setGenerationError(new Error(String(error)));
      }
      logger.error('Failed to generate steered response', { error });
    } finally {
      setIsGeneratingSteeredResponse(false);
    }
  }, [pendingFeatures, variantId, sessionId]);

  /**
   * Confirms the steered response and finalizes pending feature changes
   */
  const confirmSteeredResponse = useCallback(async () => {
    try {
      logger.debug('Confirming steered response', { 
        pendingFeatureCount: pendingFeatures.size 
      });
      
      if (pendingFeatures.size === 0 || !variantJson) {
        logger.debug('No pending features to confirm');
        // Even with no pending features, we still need to exit comparison mode
      } else {
        // The features have already been applied to the variant on the backend
        // We just need to update our local state
        
        // Update lastConfirmedState with the current backend state
        const updatedVariantState = await featuresApi.getModifiedFeatures(sessionId, variantId);
        setVariantJson(updatedVariantState);
        setLastConfirmedState(updatedVariantState);
      }
      
      // Update currentResponse with the steered response, but keep originalResponse unchanged
      if (steeredResponse) {
        setCurrentResponse(steeredResponse);
      }
      
      // Clear pending state
      setPendingFeatures(new Map());
      setSteeredResponse(null);
      
      // Always exit comparison mode after confirming, regardless of whether there were pending features
      setIsComparingResponses(false);
      
      logger.debug('Steered response confirmed');
      
    } catch (error) {
      logger.error('Failed to confirm steered response', { error });
      // Even on error, exit comparison mode to prevent UI from getting stuck
      setIsComparingResponses(false);
    }
  }, [pendingFeatures, variantJson, steeredResponse, sessionId, variantId]);

  /**
   * Rejects the steered response and discards pending feature changes
   */
  const cancelSteering = useCallback(async () => {
    logger.debug('Canceling steering', { 
      pendingFeatureCount: pendingFeatures.size 
    });
    
    try {
      // Revert the changes in the backend by clearing the features
      for (const [featureLabel] of pendingFeatures.entries()) {
        await featuresApi.clearFeature({
          session_id: sessionId,
          variant_id: variantId,
          feature_label: featureLabel
        });
      }
      
      // Refresh the variant state from backend
      await refreshVariant();
      
      // Clear pending features
      setPendingFeatures(new Map());
      
      // Clear steered response
      setSteeredResponse(null);
      
      // Clear generation error
      setGenerationError(null);
      
      // Exit comparison mode after canceling
      setIsComparingResponses(false);
      
      logger.debug('Steering canceled successfully');
      
    } catch (error) {
      logger.error('Failed to cancel steering', { error });
      
      // Even on error, exit comparison mode to prevent UI from getting stuck
      setIsComparingResponses(false);
    }
  }, [pendingFeatures, sessionId, variantId, refreshVariant]);

  /**
   * Utility to check if there are any pending features
   */
  const hasPendingFeatures = useCallback(() => {
    return pendingFeatures.size > 0;
  }, [pendingFeatures]);

  // Context value
  const value = {
    variantId,
    setVariantId,
    variantJson,
    refreshVariant,
    
    // New properties
    pendingFeatures,
    lastConfirmedState,
    originalResponse,
    currentResponse,
    steeredResponse,
    isGeneratingSteeredResponse,
    isComparingResponses,
    generationError,
    
    // New methods
    applyPendingFeatures,
    confirmSteeredResponse,
    cancelSteering,
    generateSteeredResponse,
    hasPendingFeatures,
    setOriginalResponseFromChat
  };

  return (
    <VariantContext.Provider value={value}>
      {children}
    </VariantContext.Provider>
  );
}

/**
 * Custom hook that provides access to the variant context
 */
export function useVariant() {
  const context = useContext(VariantContext);
  
  if (context === undefined) {
    throw new Error('useVariant must be used within a VariantProvider');
  }
  
  return context;
}