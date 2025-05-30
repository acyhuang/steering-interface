# Architecture Overview

Features marked with [TODO] are planned for future implementation.

## System Architecture

### Core API Flows 

#### Message (without autosteer)
```mermaid
sequenceDiagram
    participant U as User
    participant CI as Chat.tsx
    participant CC as /chat/completions
    participant FI as /features/inspect
    
    U->>CI: Send Message
    CI->>CC: POST Request
    CC-->>CI: Return Response
    CI->>FI: POST Request
    FI-->>CI: Show Feature Activations
```

#### Message (with autosteer)
```mermaid
sequenceDiagram
    participant U as User
    participant CI as Chat.tsx
    participant CO as Controls.tsx (autoSteer toggle)
    participant CC as /chat/completions
    participant AQ as /features/analyze-query
    participant CV as ComparisonView
    participant VC as VariantContext
    
    U->>CO: Toggle AutoSteer ON
    U->>CI: Send Message
    CI->>CC: POST Request with autoSteer=true
    CC->>AQ: Analyze Query
    AQ->>AQ: Calculate Steering Values
    AQ-->>CC: Return Steering Config
    CC->>CC: Generate Original Response
    CC->>CC: Apply Steering Values
    CC->>CC: Generate Steered Response
    CC-->>CI: Return Both Responses
    CI->>CV: Display Comparison View
    CV-->>U: Show Original vs Steered
    
    alt User Selects Steered Response
        U->>CV: Confirms steered version
        CV->>VC: confirmSteeredResponse()
        VC->>VC: Apply auto-steered features permanently
    else User Rejects Steered Response
        U->>CV: Selects original version
        CV->>VC: cancelSteering()
        VC->>VC: Discard auto-steered features
    end
```

#### Steering Comparison Flow
```mermaid
sequenceDiagram
    participant U as User
    participant CI as Chat.tsx
    participant VC as VariantContext
    participant CV as ComparisonView
    participant FS as /features/steer 
    participant CC as /chat/completions
    
    U->>CI: Adjust Feature
    CI->>VC: applyPendingFeatures()
    VC->>FS: Apply steering as pending
    FS-->>VC: Update pending state
    VC->>CC: Generate steered response
    CC-->>VC: Return steered response
    VC->>CV: Display comparison view
    CV-->>U: Show original vs steered
    
    alt User Selects Steered Response
        U->>CV: Confirms steered version
        CV->>VC: confirmSteeredResponse()
        VC->>VC: Apply pending features permanently
    else User Rejects Steered Response
        U->>CV: Selects original version
        CV->>VC: cancelSteering()
        VC->>VC: Revert to original state
    end
```

#### Feature Search Flow
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
```

## Service Layer Architecture
The backend is organized using a hybrid approach with a main facade service and internal specialized service components:

#### EmberService (Facade)
- Acts as a central coordination point for all LLM operations
- Provides a unified API for controllers and API routes
- Manages delegation to specialized internal services
- Handles cross-cutting concerns (logging, error handling, etc.)

#### VariantManager
- Manages session and variant lifecycle
- Stores and retrieves variant configurations
- Provides variant caching and persistence

#### CompletionService
- Handles chat completion requests
- Manages completion settings
- Integrates with LLM providers

#### FeatureService
- Provides feature inspection capabilities
- Handles feature steering operations
- Manages feature search and clustering

#### AnalysisService
- Analyzes user queries
- Determines optimal persona and features
- Provides auto-steering recommendations

## State Management

### Core State Providers

The application uses several context providers to manage different aspects of application state:

**FeatureProvider:**
- Manages feature modifications for steering LLM outputs
- Stores feature labels and their steering values
- Provides functions to set, clear, and retrieve feature modifications
- Implemented in `frontend/src/contexts/FeatureContext.tsx`

**VariantContext:**
- Manages variant state and steering comparison workflow
- Tracks pending and confirmed feature changes
- Maintains original and steered responses for comparison
- Provides methods for applying, confirming, and canceling steering actions
- Implemented in `frontend/src/contexts/VariantContext.tsx`

**TestBenchProvider:**
- Manages component testing configurations
- Tracks active tests and test definitions
- Allows components to register tests and manage test state
- Implemented in `frontend/src/lib/testbench/TestBenchProvider.tsx`

### State Flow Architecture

The application's state flow follows a clear hierarchy:

```mermaid
graph TD
    A[App Component] --> B[FeatureProvider]
    B --> V[VariantProvider]
    V --> C[TestBenchProvider]
    C --> D[Component Tree]
    D --> E[Chat Component]
    D --> F[Controls Component]
    D --> G[ComparisonView Component]
    E -- "Messages Update" --> A
    F -- "Feature Adjustment" --> V
    V -- "Response Comparison" --> G
    G -- "Confirmation/Rejection" --> V
```

**State Access Pattern:**
- Components use custom hooks to access context state
- For example: `useFeatureModifications()` provides access to feature state
- This pattern encapsulates state access logic and ensures proper context usage

**State Persistence:**
- UI preferences stored in localStorage (e.g., split panel sizes)
- Feature modifications maintained in Context during the session
- Chat messages managed in local state with parent component coordination

## Development Infrastructure

### Logging Architecture 

The system implements a progressive logging strategy with clear level separation across environments:

**Log Levels by Environment:**
- **Production**: ERROR, WARNING, INFO (key operational events only)
- **Development/Staging**: All production levels plus DEBUG and TRACE

**Log Format Standard:**
```
[TIMESTAMP] [LEVEL] [COMPONENT] [CORRELATION_ID] Message
```

Example:
```
[2024-03-20 10:15:30] [INFO] [FeatureService] [sess_abc123] Feature steering applied: formal_writing=0.75
```

### Testing Architecture 

The project follows a component-based testing approach with clear separation of concerns:

**Component Tests**
Located in `src/components/*/`:
- Focus on UI behavior and rendering
- Test component-specific functionality
- Verify rendering, user interactions, and UI states

**Context Tests**
Located in `src/contexts/__tests__/`:
- Focus on business logic and state management
- Test application behavior layer
- Verify state transitions, data flow, and error handling

**Core Testing Tools:**
- Vitest as test runner
- React Testing Library for component testing
- Coverage reporting configured
