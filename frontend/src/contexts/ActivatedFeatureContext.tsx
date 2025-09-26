import { createContext, useContext, useState, useCallback, ReactNode, useEffect, useRef } from 'react';
import { Feature, FeatureCluster } from '@/types/domain';
import { featuresApi } from '@/lib/api';
import { createLogger } from '@/lib/logger';
import { useVariant } from '@/hooks/useVariant';

interface ActivatedFeatureContextType {
  // State
  activeFeatures: Feature[];
  featureClusters: FeatureCluster[];
  isLoading: boolean;
  
  // Core functions
  setActiveFeatures: (features: Feature[]) => void;
  setFeatureClusters: (clusters: FeatureCluster[]) => void;
  clearFeatures: () => void;
  refreshClusters: (forceRefresh?: boolean) => Promise<void>;
  getFeatureActivation: (featureLabel: string) => number | undefined;
}

const ActivatedFeatureContext = createContext<ActivatedFeatureContextType | undefined>(undefined);

export interface ActivatedFeatureProviderProps {
  children: ReactNode;
}

// Helper function to check if two arrays of features have the same modifications
function haveModificationsChanged(prevFeatures: Feature[], nextFeatures: Feature[]): boolean {
  if (prevFeatures.length !== nextFeatures.length) return true;
  
  for (let i = 0; i < prevFeatures.length; i++) {
    if (prevFeatures[i].label !== nextFeatures[i].label ||
        prevFeatures[i].modification !== nextFeatures[i].modification) {
      return true;
    }
  }
  
  return false;
}

export function ActivatedFeatureProvider({ children }: ActivatedFeatureProviderProps) {
  const logger = createLogger('ActivatedFeatureContext');
  const { variantId, variantJson } = useVariant();
  const [activeFeatures, setActiveFeaturesState] = useState<Feature[]>([]);
  const [featureClusters, setFeatureClustersState] = useState<FeatureCluster[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const previousVariantJson = useRef<any>(null);

  // Set active features with modifications initialized to 0
  const setActiveFeatures = useCallback((features: Feature[]) => {
    logger.debug('Setting active features', { count: features.length });
    
    // Features from the new API already have proper modification state
    // No need to transform - they're already domain objects
    setActiveFeaturesState(features);
  }, [logger]);

  // Update feature modifications when variantJson changes
  useEffect(() => {
    // Skip if no features or variant hasn't changed
    if (!activeFeatures.length || 
        !variantJson || 
        JSON.stringify(previousVariantJson.current) === JSON.stringify(variantJson)) {
      return;
    }
    
    // Update ref to current variant
    previousVariantJson.current = variantJson;
    
    if (Array.isArray(variantJson.edits)) {
      logger.debug('Updating feature modifications from variant data', {
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
        const newModification = modifiedValue !== undefined ? modifiedValue : 0;
        return {
          ...feature,
          modification: newModification,
          isModified: newModification !== 0
        };
      });
      
      // Only update state if there are actual changes to the modified values
      if (haveModificationsChanged(activeFeatures, updatedFeatures)) {
        setActiveFeaturesState(updatedFeatures);
      }
    }
  }, [variantJson, logger, activeFeatures]);

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
      
      const clusters = await featuresApi.clusterFeatures(
        activeFeatures,
        "default_session",
        variantId // Use the current variant ID from context
      );
      
      setFeatureClustersState(clusters);
      logger.debug('Feature clusters refreshed', { 
        clusterCount: clusters.length 
      });
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
    <ActivatedFeatureContext.Provider value={value}>
      {children}
    </ActivatedFeatureContext.Provider>
  );
}

export function useFeatureActivations() {
  const context = useContext(ActivatedFeatureContext);
  if (context === undefined) {
    throw new Error('useFeatureActivations must be used within a ActivatedFeatureProvider');
  }
  return context;
} 