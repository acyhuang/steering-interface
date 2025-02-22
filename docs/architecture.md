# Architecture Overview

## System Overview
The system provides a real-time chat interface with feature steering capabilities, allowing users to adjust model behavior through feature controls and save configurations as model variants. It also includes a TestBench system for A/B testing different UI/UX implementations.

## API Trigger Flows

### Message Flow
```mermaid
sequenceDiagram
    participant U as User
    participant CI as Chat.tsx
    participant CC as /chat/completions
    participant FI as /features/inspect
    
    U->>CI: Send Message
    CI->>CC: POST Request
    CC-->>CI: Print Response
    CI->>FI: POST Request
    FI-->>CI: Show Feature Activations
```

### Steering Flow
```mermaid
sequenceDiagram
    participant U as User
    participant CI as Chat.tsx
    participant IP as Inspector.tsx
    participant FS as /features/steer 
    participant ES as EmberService
    participant FM as /features/modified 
    participant CC as /chat/completions
    
    U->>IP: Adjust Feature
    IP->>FS: POST Request
    FS->>ES: Handle Request
    ES-->>FS: Success Response
    FS->>FM: GET Request
    FM->>ES: Get Variant State
    ES-->>FM: Current Modifications
    FM-->>FS: Current State
    FS->>CC: Trigger Regeneration
    CC-->>CI: New Completion
```