# Steering Comparison 

## Overview
This feature allows users to compare the effects of different steering actions on the same variant. This is necessary to help the user build intuition for how steering affects model outputs.

## User Journey
1. User steers on a feature
2. Model generates a steered response
3. UI displays the default and steered responses side by side (may need to generate the default response if it hasn't already been generated)
4. User selects which response to keep
5. Model updates the variant state (either confirming or rejecting the steering action)

## Technical Requirements

### Core Behaviors
1. Comparison Display
   - Only two outputs shown side-by-side at any time
   - Text above the split view shows "Which response do you prefer?"
   - Left side always shows "original" response (confirmed steers if any)
   - Right side shows "new" response with current parameters (pending steers)
   - User can click on the response they prefer which triggers confirmation/cancellation flow

2. Response Management
   - If the original response has already been generated, we should use that response for the comparison (don't generate a new response)
   - Only the text content of responses is compared
   - Responses are displayed using the existing rendering system

3. Steering Flow and Multiple Features
   - Each new steering action compares against the original response
   - Users can adjust multiple steering features before confirming (i.e. multiple features can be pending at once)
   - Two-step confirmation process:
     a. User adjusts steering parameters to see comparison
     b. User explicitly confirms desired output
   - The "original" response shown in comparison is the last confirmed state
   - Each steering action is tracked with a status:
     - PENDING: Feature has been adjusted but not confirmed
     - CONFIRMED: Feature adjustment has been accepted
   - When generating a steered response, all PENDING features are applied together
   - Upon confirmation:
     - All pending steers are confirmed and applied for future messages
     - All PENDING features become CONFIRMED
   - Upon cancellation:
     - All pending steering changes are reverted to the last confirmed state
     - All PENDING features are cleared

4. State Management
   - Variant state is managed using the SDK's built-in Variant class
   - A single primary variant instance is maintained per session
   - Pending changes are tracked separately from confirmed changes
   - System maintains three key pieces of state:
     a. Current variant (SDK Variant instance with all changes)
     b. Pending features map (feature_label -> value)
     c. Last confirmed state (JSON serialized variant)
   - State transitions:
     - When applying pending changes: Update both variant and pending features map
     - When confirming changes: Clear pending features map and save variant as confirmed state
     - When canceling changes: Restore variant from last confirmed state and clear pending map

   Additional Behaviors:
   - Initial State:
     - lastConfirmedState is initialized when variant is first created
     - Empty variant state is used as initial confirmed state
   
   - Concurrent Operations:
     - Users can adjust features while response generation is in progress
     - When a new adjustment is made:
       - Cancel the current in-progress generation
       - Start generating new response with updated parameters
       - UI should indicate generation is in progress
     - Pending features are updated immediately in the UI
   
   - Error Recovery:
     - On generation failure, pending features are preserved
     - User can retry generation or cancel changes
     - Error state is displayed in comparison view


### API Trigger Flow
```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant CC as /chat/completions
    participant FS as /features/steer

    Note over U,F: Initial Response
    U->>F: Sends message
    F->>CC: Generate response
    CC-->>F: Original response
    F->>F: Store original response

    Note over U,F: Steering Comparison
    U->>F: Adjusts feature
    F->>FS: Apply steering
    FS-->>F: Update variant state
    F->>CC: Generate new response
    CC-->>F: Steered response
    F->>F: Display comparison

    Note over U,F: User Decision
    alt Accepts Steered Response
        U->>F: Confirms steered version
        F->>F: Keep steered variant state
        F->>F: Clear original response
    else Rejects Steered Response
        U->>F: Cancels steering
        F->>F: Revert to original response
        F->>F: Clear comparison state
    end
```