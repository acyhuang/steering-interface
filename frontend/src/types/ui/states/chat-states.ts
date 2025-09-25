/**
 * Chat component loading states
 */

export enum ChatLoadingState {
  IDLE = 'idle',             // Not loading anything
  SENDING = 'sending',       // Sending a new message
  REGENERATING = 'regenerating', // Regenerating the last message
  INSPECTING_FEATURES = 'inspecting_features', // Inspecting features after a message
}
