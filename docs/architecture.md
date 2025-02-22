# Architecture Overview

## Implementation Status

This document outlines both currently implemented architecture components and planned future enhancements. Features marked with 🚧 TODO are planned for future implementation.

## System Overview
The system provides a real-time chat interface with feature steering capabilities, allowing users to adjust model behavior through feature controls and save configurations as model variants. It also includes a TestBench system for A/B testing different UI/UX implementations (🚧 TODO).

## Current API Trigger Flows ✓

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
    participant FM as /features/modified 
    participant CC as /chat/completions
    
    U->>IP: Adjust Feature
    IP->>FS: POST Request
    FS->>FM: GET Request
    FM-->>FS: Current State
    FS->>CC: Trigger Regeneration
    CC-->>CI: New Completion
```

## Future API Trigger Flows 🚧 TODO

### Streaming Message Flow
```mermaid
sequenceDiagram
    participant U as User
    participant CI as Chat.tsx
    participant CC as /chat/completions/stream
    participant FI as /features/inspect
    
    U->>CI: Send Message
    CI->>CC: SSE Connection
    loop Streaming
        CC-->>CI: Stream Tokens
    end
    CI->>FI: POST Request
    FI-->>CI: Show Feature Activations
```

### TestBench Flow
```mermaid
sequenceDiagram
    participant U as User
    participant TB as TestBench.tsx
    participant TS as /test/status
    participant TD as /test/data
    
    U->>TB: Configure Test
    TB->>TS: POST Request
    TS-->>TB: Test Status
    TB->>TD: Store Results
    TD-->>TB: Confirmation
```

## Current Implementation Details ✓

### Frontend
- React + Vite application
- ShadcnUI components
- Basic chat interface
- Feature inspection panel
- Real-time feature steering
- Basic error handling

### Backend
- FastAPI application
- Ember SDK integration
- In-memory variant storage
- Basic session management
- Synchronous completions
- Basic error handling

## Future Enhancements 🚧 TODO

### Frontend
- Streaming message support
- Advanced error handling
- TestBench UI components
- Analytics dashboard
- Configuration management UI

### Backend
- Persistent storage (Vercel KV)
- Advanced session management
- Rate limiting
- Streaming support
- TestBench service
- Analytics service
- Advanced error handling