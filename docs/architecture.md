# Architecture Overview

## Implementation Status

This document outlines both currently implemented architecture components and planned future enhancements. Features marked with 🚧 TODO are planned for future implementation.

## System Overview
The system provides a real-time chat interface with feature steering capabilities, allowing users to adjust model behavior through feature controls and save configurations as model variants. It also includes a TestBench system for A/B testing different UI/UX implementations (🚧 TODO).

## Logging Architecture ✓

### Log Levels and Usage
The system implements a progressive logging strategy with clear level separation:

#### Production Environment
- **ERROR**: Application errors requiring immediate attention
  - Failed API calls
  - SDK exceptions
  - Critical system failures
- **WARNING**: Important events that don't stop functionality
  - Rate limiting events
  - Fallback behaviors
  - Performance degradation
- **INFO**: Key operational events only
  - Application startup/shutdown
  - Session creation/deletion
  - Major state changes
  - Variant creation/modification

#### Development/Staging Environments
All production levels plus:
- **DEBUG**: Detailed operational information
  - Feature modification details
  - API request/response data
  - State transitions
  - Performance metrics
- **TRACE**: Most detailed debugging information
  - Full payload logging
  - Detailed SDK interactions
  - Complete variant state dumps

### Environment Configuration
```python
# Log levels by environment
LOGGING_CONFIG = {
    "production": "INFO",
    "staging": "DEBUG",
    "development": "TRACE"
}
```

### Frontend Logging
- Custom logger utility with environment awareness
- Component-specific contexts
- Structured log format
- Console logging in development
- Error reporting in production

### Backend Logging
- Standardized log formatting
- Request correlation IDs
- Structured JSON logging
- Performance timing data
- SDK interaction logging

### Log Format Standards
```
[TIMESTAMP] [LEVEL] [COMPONENT] [CORRELATION_ID] Message
```

Example:
```
[2024-03-20 10:15:30] [INFO] [FeatureService] [sess_abc123] Feature steering applied: formal_writing=0.75
```

## Current API Trigger Flows ✓

### Message Flow
```mermaid
sequenceDiagram
    participant U as User
    participant CI as Chat.tsx
    participant AQ as /features/analyze-query
    participant AS as /features/auto-steer
    participant CC as /chat/completions
    participant FI as /features/inspect
    
    U->>CI: Send Message
    CI->>AQ: Analyze Query
    AQ->>AS: Request Auto-Steering
    AS->>AS: Calculate Steering Values
    AS-->>AQ: Return Steering Values
    AQ-->>CI: Return Steering Config
    CI->>CC: POST Request with Steering
    CC-->>CI: Return Optimized Response
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
    participant FC as /features/clear
    participant FM as /features/modified 
    participant CC as /chat/completions
    
    U->>IP: Adjust/Clear Feature
    alt Adjust Feature
        IP->>FS: POST Request
        FS->>FM: GET Request
        FM-->>FS: Current State
    else Clear Feature
        IP->>FC: POST Request
        FC->>FM: GET Request
        FM-->>FC: Current State
    end
    IP->>CC: Trigger Regeneration
    CC-->>CI: New Completion
```

### Feature Search Flow
```mermaid
sequenceDiagram
    participant U as User
    participant IP as Inspector.tsx
    participant FS as /features/search
    
    U->>IP: Enter Search Query
    U->>IP: Click Search Button
    IP->>FS: POST Request
    FS-->>IP: Return Matching Features
    IP-->>U: Display Search Results Overlay
    U->>IP: Adjust Feature from Results
    IP->>FS: Steer Feature (if adjusted)
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


