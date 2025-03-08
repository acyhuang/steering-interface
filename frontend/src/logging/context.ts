import { createContext, useContext, useMemo } from 'react';
import { Logger } from './logger';
import type { LoggerOptions } from './types';

const LoggerContext = createContext<Logger | null>(null);

export const LoggerProvider = LoggerContext.Provider;

export const useLogger = (component: string): Logger => {
  const contextLogger = useContext(LoggerContext);
  
  return useMemo(() => {
    const options: LoggerOptions = {
      component,
      correlationId: contextLogger?.getCorrelationId
    };
    return new Logger(options);
  }, [component, contextLogger?.getCorrelationId]);
}; 