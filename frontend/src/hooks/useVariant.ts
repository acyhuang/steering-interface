import { useContext } from 'react';
import { VariantContext } from '../contexts/VariantContext';

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