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
    participant FM as /features/modified 
    participant CC as /chat/completions
    
    U->>IP: Adjust Feature
    IP->>FS: POST Request
    FS->>FM: GET Request
    FM-->>FS: Current Modifications
    FS->>CC: Trigger Regeneration
    CC-->>CI: New Completion
```

## Technical Architecture

```mermaid
graph TB
    subgraph Frontend
        CI[Chat Interface]
        IP[Inspector Panel]
        TB[TestBench Panel]
        CS[Connection Status]
    end

    subgraph Backend
        CCS[Chat Completion Service]
        FMS[Feature Management Service]
        TS[TestBench Service]
        KV[KV Storage]
    end

    CI --> CCS
    CI --> FMS
    IP --> FMS
    TB --> TS
    TS --> KV
    FMS --> CCS
```

## Deployment Architecture
- Frontend: Vite + React application
- Backend: Vercel Serverless Functions
- Storage: Vercel KV
- Edge-compatible architecture

## Session Management
- Single active session support
- Session-based message history
- Simple session token system
