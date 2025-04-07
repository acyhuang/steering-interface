import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { 
  FeatureActivation, 
  FeatureCluster,
  ClusteredFeaturesResponse
} from '@/types/features';
import { featuresApi } from '@/lib/api';
import { useLogger } from '@/lib/logger';
import { useVariant } from './VariantContext';

interface FeatureActivationContextType {
  // State
  activeFeatures: FeatureActivation[];
  featureClusters: FeatureCluster[];
  isLoading: boolean;
  
  // Core functions
  setActiveFeatures: (features: FeatureActivation[]) => void;
  setFeatureClusters: (clusters: FeatureCluster[]) => void;
  clearFeatures: () => void;
  refreshClusters: (forceRefresh?: boolean) => Promise<void>;
  getFeatureActivation: (featureLabel: string) => number | undefined;
}

const FeatureActivationContext = createContext<FeatureActivationContextType | undefined>(undefined);

export interface FeatureActivationProviderProps {
  children: ReactNode;
}

export function FeatureActivationProvider({ children }: FeatureActivationProviderProps) {
  const logger = useLogger('FeatureActivationContext');
  const { variantId, variantJson } = useVariant();
  const [activeFeatures, setActiveFeaturesState] = useState<FeatureActivation[]>([]);
  const [featureClusters, setFeatureClustersState] = useState<FeatureCluster[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Set active features with modifiedActivation initialized to 0
  const setActiveFeatures = useCallback((features: FeatureActivation[]) => {
    logger.debug('Setting active features', { count: features.length });
    
    // Initialize with modifiedActivation = 0, but check for existing modifications in variant
    const featuresWithModified = features.map(feature => ({
      ...feature,
      modifiedActivation: 0 // Default to 0, will be updated from variant if available
    }));
    
    setActiveFeaturesState(featuresWithModified);
  }, [logger]);

  // Update modifiedActivation values when variantJson changes
  useEffect(() => {
    if (variantJson && Array.isArray(variantJson.edits) && activeFeatures.length > 0) {
      logger.debug('Updating modified activations from variant data', {
        editCount: variantJson.edits.length,
        featureCount: activeFeatures.length
      });
      
      // Create a map of feature label to modified value
      const modifiedValuesMap = new Map();
      
      variantJson.edits.forEach((edit: any) => {
        if (edit.feature_label && typeof edit.value === 'number') {
          modifiedValuesMap.set(edit.feature_label, edit.value);
        }
      });
      
      // Update activeFeatures with modified values from the variant
      const updatedFeatures = activeFeatures.map(feature => {
        const modifiedValue = modifiedValuesMap.get(feature.label);
        return {
          ...feature,
          modifiedActivation: modifiedValue !== undefined ? modifiedValue : 0
        };
      });
      
      setActiveFeaturesState(updatedFeatures);
    }
  }, [variantJson, activeFeatures.length, logger]);

  // Set feature clusters
  const setFeatureClusters = useCallback((clusters: FeatureCluster[]) => {
    logger.debug('Setting feature clusters', { count: clusters.length });
    setFeatureClustersState(clusters);
  }, [logger]);

  // Clear all features and clusters
  const clearFeatures = useCallback(() => {
    logger.debug('Clearing all features and clusters');
    setActiveFeaturesState([]);
    setFeatureClustersState([]);
  }, [logger]);

  // Refresh clusters based on current features
  const refreshClusters = useCallback(async (forceRefresh: boolean = false) => {
    if (!activeFeatures.length) {
      logger.debug('No active features to cluster');
      return;
    }

    setIsLoading(true);
    try {
      logger.debug('Refreshing feature clusters', { 
        featureCount: activeFeatures.length,
        forceRefresh 
      });
      
      const response = await featuresApi.clusterFeatures(
        activeFeatures,
        "default_session",
        variantId // Use the current variant ID from context
      );
      
      if (response?.clusters) {
        setFeatureClustersState(response.clusters);
        logger.debug('Feature clusters refreshed', { 
          clusterCount: response.clusters.length 
        });
      }
    } catch (error) {
      logger.error('Failed to refresh clusters', { 
        error: error instanceof Error ? error.message : String(error) 
      });
    } finally {
      setIsLoading(false);
    }
  }, [activeFeatures, logger, variantId]);

  // Utility to get base activation value for a specific feature
  const getFeatureActivation = useCallback((featureLabel: string): number | undefined => {
    const feature = activeFeatures.find(f => f.label === featureLabel);
    return feature?.activation;
  }, [activeFeatures]);

  const value = {
    activeFeatures,
    featureClusters,
    isLoading,
    setActiveFeatures,
    setFeatureClusters,
    clearFeatures,
    refreshClusters,
    getFeatureActivation
  };

  return (
    <FeatureActivationContext.Provider value={value}>
      {children}
    </FeatureActivationContext.Provider>
  );
}

export function useFeatureActivations() {
  const context = useContext(FeatureActivationContext);
  if (context === undefined) {
    throw new Error('useFeatureActivations must be used within a FeatureActivationProvider');
  }
  return context;
} 