import { createContext, useContext, useState, ReactNode } from 'react';
import { createLogger } from '@/lib/logger';

const logger = createLogger('FeatureContext');

export interface FeatureModification {
  label: string;
  steeringValue: number;
}

export interface FeatureContextState {
  modifications: Map<string, number>;  // feature label -> steering value
  setModification: (label: string, value: number) => void;
  clearModification: (label: string) => void;
  clearAllModifications: () => void;
  getModification: (label: string) => number | undefined;
}

const FeatureContext = createContext<FeatureContextState | undefined>(undefined);

export function FeatureProvider({ children }: { children: ReactNode }) {
  const [modifications, setModifications] = useState<Map<string, number>>(new Map());

  const value: FeatureContextState = {
    modifications,
    setModification: (label: string, value: number) => {
      logger.debug('Setting modification', { label, value });
      setModifications(prev => new Map(prev).set(label, value));
    },
    clearModification: (label: string) => {
      logger.debug('Clearing modification', { label });
      setModifications(prev => {
        const next = new Map(prev);
        next.delete(label);
        return next;
      });
    },
    clearAllModifications: () => {
      logger.debug('Clearing all modifications');
      setModifications(new Map());
    },
    getModification: (label: string) => {
      return modifications.get(label);
    }
  };

  return (
    <FeatureContext.Provider value={value}>
      {children}
    </FeatureContext.Provider>
  );
}

export function useFeatureModifications() {
  const context = useContext(FeatureContext);
  if (context === undefined) {
    throw new Error('useFeatureModifications must be used within a FeatureProvider');
  }
  return context;
} 