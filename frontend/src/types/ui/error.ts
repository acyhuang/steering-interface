/**
 * Error types for the UI domain
 */

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

export interface ValidationError {
  field: string;
  message: string;
  constraints?: Record<string, string>;
} 