/**
 * API Types - Minimal DTOs for backend communication
 * 
 * These types are NOT exported from the main types/index.ts
 * They are internal to the API layer and should only be used
 * in api.ts and related API handling code.
 * 
 * Components should use domain types and let the API layer
 * handle transformations.
 */

export * from './requests';
export * from './responses';
export * from './transforms';
