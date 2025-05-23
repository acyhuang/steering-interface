import React, { createContext, useState, useEffect, useCallback } from 'react';
import { createLogger } from '@/lib/logger';
import { featuresApi, chatApi } from '@/lib/api';
import { ChatMessage } from '@/types/conversation';
import { SteeringLoadingState, LoadingStateInfo, createLoadingState } from '@/types/ui';

// Logger for this context
const logger = createLogger('VariantContext');

// Define the context interface
export interface VariantContextType {
  variantId: string;
  setVariantId: (id: string) => void;
  variantJson: any | null;
  refreshVariant: () => Promise<void>;
  
  // New properties for steering comparison
  pendingFeatures: Map<string, number>;
  setPendingFeatures: (features: Map<string, number>) => void; 
  modifiedFeatures: Map<string, number>; // New centralized map of all modified features
  lastConfirmedState: any | null;
  currentResponse: string | null;
  originalResponse: string | null;
  steeredResponse: string | null;
  setSteeredResponse: (content: string | null) => void;
  steeringState: LoadingStateInfo<SteeringLoadingState>;
  isComparingResponses: boolean;
  setIsComparingResponses: (comparing: boolean) => void;
  generationError: Error | null;
  
  // Auto-Steer properties
  autoSteerEnabled: boolean;
  setAutoSteerEnabled: (enabled: boolean) => void;
  
  // Computed properties for backward compatibility
  isGeneratingSteeredResponse: boolean;
  
  // New methods for steering comparison
  applyPendingFeatures: (featureLabel: string, value: number) => Promise<void>;
  confirmSteeredResponse: (onConfirmed?: () => Promise<void>) => Promise<void>;
  cancelSteering: () => void;
  generateSteeredResponse: (messages: ChatMessage[]) => Promise<void>;
  hasPendingFeatures: () => boolean;
  setOriginalResponseFromChat: (content: string) => void;
  
  // New feature helper methods
  getFeatureModification: (label: string) => number | null;
  getAllModifiedFeatures: () => Map<string, number>;
}

// Create the context with a default value
export const VariantContext = createContext<VariantContextType | undefined>(undefined);

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
  const [sessionId] = useState<string>(defaultSessionId);
  const [variantJson, setVariantJson] = useState<any | null>(null);
  
  // New state for steering comparison
  const [pendingFeatures, setPendingFeatures] = useState<Map<string, number>>(new Map());
  const [modifiedFeatures, setModifiedFeatures] = useState<Map<string, number>>(new Map());
  const [lastConfirmedState, setLastConfirmedState] = useState<any | null>(null);
  const [originalResponse, setOriginalResponse] = useState<string | null>(null);
  const [currentResponse, setCurrentResponse] = useState<string | null>(null);
  const [steeredResponse, setSteeredResponse] = useState<string | null>(null);
  // Replace boolean flag with a state machine
  const [steeringState, setSteeringState] = useState<LoadingStateInfo<SteeringLoadingState>>(
    createLoadingState(SteeringLoadingState.IDLE)
  );
  const [isComparingResponses, setIsComparingResponses] = useState<boolean>(false);
  const [generationError, setGenerationError] = useState<Error | null>(null);
  
  // Auto-Steer state
  const [autoSteerEnabled, setAutoSteerEnabled] = useState<boolean>(false);

  // Log when autoSteerEnabled changes
  useEffect(() => {
    logger.debug('Auto-Steer state changed', { autoSteerEnabled });
  }, [autoSteerEnabled]);

  // Computed properties for backwards compatibility
  const isGeneratingSteeredResponse = steeringState.state === SteeringLoadingState.GENERATING_RESPONSE;

  // Function to refresh variant data from the backend
  const refreshVariant = useCallback(async () => {
    try {
      const response = await featuresApi.getModifiedFeatures(sessionId, variantId);
      setVariantJson(response);
      
      // When we get fresh variant data, also update the last confirmed state
      if (!lastConfirmedState) {
        setLastConfirmedState(response);
      }
      
      // Update the centralized modified features map
      if (response && Array.isArray(response.edits)) {
        const newModifiedFeatures = new Map<string, number>();
        
        response.edits.forEach((edit: any) => {
          if (edit.feature_label && typeof edit.value === 'number') {
            newModifiedFeatures.set(edit.feature_label, edit.value);
          }
        });
        
        setModifiedFeatures(newModifiedFeatures);
        logger.debug('Updated modified features map', { 
          featureCount: newModifiedFeatures.size 
        });
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
    
    setSteeringState(createLoadingState(SteeringLoadingState.APPLYING_FEATURES));
    
    try {
      // Update pending features map
      setPendingFeatures(prevFeatures => {
        const newFeatures = new Map(prevFeatures);
        newFeatures.set(featureLabel, value);
        return newFeatures;
      });
      setSteeringState(createLoadingState(SteeringLoadingState.IDLE));
    } catch (error) {
      logger.error('Failed to apply pending feature', { error, featureLabel });
      setSteeringState(createLoadingState(
        SteeringLoadingState.IDLE,
        error instanceof Error ? error : new Error(String(error))
      ));
    }
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
      setSteeringState(createLoadingState(SteeringLoadingState.GENERATING_RESPONSE));
      
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
      setSteeringState(createLoadingState(SteeringLoadingState.COMPARING));
      
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
      setSteeringState(createLoadingState(
        SteeringLoadingState.IDLE,
        error instanceof Error ? error : new Error(String(error))
      ));
    }
  }, [pendingFeatures, variantId, sessionId]);

  /**
   * Confirms the steered response and finalizes pending feature changes
   */
  const confirmSteeredResponse = useCallback(async (onConfirmed?: () => Promise<void>) => {
    try {
      setSteeringState(createLoadingState(SteeringLoadingState.CONFIRMING));
      
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
        
        // Update the modified features map with the pending features
        setModifiedFeatures(prevModified => {
          const newModified = new Map(prevModified);
          
          // Merge in pending features
          for (const [label, value] of pendingFeatures.entries()) {
            newModified.set(label, value);
          }
          
          return newModified;
        });
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
      setSteeringState(createLoadingState(SteeringLoadingState.IDLE));
      
      logger.debug('Steered response confirmed');
      
      // Call the callback if provided
      if (onConfirmed) {
        await onConfirmed();
      }
      
    } catch (error) {
      logger.error('Failed to confirm steered response', { error });
      // Even on error, exit comparison mode to prevent UI from getting stuck
      setIsComparingResponses(false);
      setSteeringState(createLoadingState(
        SteeringLoadingState.IDLE,
        error instanceof Error ? error : new Error(String(error))
      ));
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
      setSteeringState(createLoadingState(SteeringLoadingState.CANCELING));
      
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
      setSteeringState(createLoadingState(SteeringLoadingState.IDLE));
      
      logger.debug('Steering canceled successfully');
      
    } catch (error) {
      logger.error('Failed to cancel steering', { error });
      
      // Even on error, exit comparison mode to prevent UI from getting stuck
      setIsComparingResponses(false);
      setSteeringState(createLoadingState(
        SteeringLoadingState.IDLE,
        error instanceof Error ? error : new Error(String(error))
      ));
    }
  }, [pendingFeatures, sessionId, variantId, refreshVariant]);

  /**
   * Utility to check if there are any pending features
   */
  const hasPendingFeatures = useCallback(() => {
    return pendingFeatures.size > 0;
  }, [pendingFeatures]);
  
  /**
   * Returns the modification value for a feature if it exists
   */
  const getFeatureModification = useCallback((label: string): number | null => {
    return modifiedFeatures.has(label) ? modifiedFeatures.get(label)! : null;
  }, [modifiedFeatures]);
  
  /**
   * Returns all modified features
   */
  const getAllModifiedFeatures = useCallback((): Map<string, number> => {
    return new Map(modifiedFeatures);
  }, [modifiedFeatures]);

  // Context value
  const value = {
    variantId,
    setVariantId,
    variantJson,
    refreshVariant,
    
    // New properties
    pendingFeatures,
    setPendingFeatures,
    modifiedFeatures,
    lastConfirmedState,
    originalResponse,
    currentResponse,
    steeredResponse,
    setSteeredResponse,
    steeringState,
    isComparingResponses,
    setIsComparingResponses,
    generationError,
    
    // Auto-Steer properties
    autoSteerEnabled,
    setAutoSteerEnabled,
    
    // Computed properties for backward compatibility
    isGeneratingSteeredResponse,
    
    // New methods
    applyPendingFeatures,
    confirmSteeredResponse,
    cancelSteering,
    generateSteeredResponse,
    hasPendingFeatures,
    setOriginalResponseFromChat,
    
    // New feature helper methods
    getFeatureModification,
    getAllModifiedFeatures
  };

  return (
    <VariantContext.Provider value={value}>
      {children}
    </VariantContext.Provider>
  );
}