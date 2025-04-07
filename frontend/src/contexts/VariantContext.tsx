import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { createLogger } from '@/lib/logger';
import { featuresApi } from '@/lib/api';

// Logger for this context
const logger = createLogger('VariantContext');

// Define the context interface
interface VariantContextType {
  variantId: string;
  setVariantId: (id: string) => void;
  variantJson: any | null;
  refreshVariant: () => Promise<void>;
}

// Create the context with a default value
const VariantContext = createContext<VariantContextType | undefined>(undefined);

// Provider props interface
interface VariantProviderProps {
  children: React.ReactNode;
  defaultVariantId?: string;
}

/**
 * Provider component that wraps your app and makes variant values available
 */
export function VariantProvider({ 
  children, 
  defaultVariantId = 'default'
}: VariantProviderProps) {
  const [variantId, setVariantId] = useState<string>(defaultVariantId);
  const [variantJson, setVariantJson] = useState<any | null>(null);

  // Function to refresh variant data from the backend
  const refreshVariant = useCallback(async () => {
    try {
      const response = await featuresApi.getModifiedFeatures("default_session", variantId);
      setVariantJson(response);
    } catch (error) {
      logger.error('Failed to refresh variant data', { error });
    }
  }, [variantId]);

  // When variant ID changes, refresh the variant data
  useEffect(() => {
    refreshVariant();
  }, [variantId, refreshVariant]);

  // Context value
  const value = {
    variantId,
    setVariantId,
    variantJson,
    refreshVariant
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