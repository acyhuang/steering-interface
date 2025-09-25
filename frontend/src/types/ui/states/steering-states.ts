/**
 * Variant context loading states used for the steering comparison flow
 */

export enum SteeringLoadingState {
  IDLE = 'idle',             // No steering operation in progress
  APPLYING_FEATURES = 'applying_features', // Applying features to the variant
  GENERATING_RESPONSE = 'generating_response', // Generating a steered response
  COMPARING = 'comparing',   // Comparing original and steered responses
  CONFIRMING = 'confirming', // Confirming the steered response
  CANCELING = 'canceling',   // Canceling the steering operation
}
