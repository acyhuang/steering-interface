# Components Documentation

## Current Implementation Status

This document outlines both currently implemented features and planned future enhancements. Features marked with 🚧 TODO are planned for future implementation.

## Frontend Components

### Chat Interface 
- Main user interaction point for conversations
- Handles message input/output
- Manages chat history display
- Triggers feature inspection on new messages
- Integrates with current model variant settings for completions
- **Logging**:
  - INFO: Message send/receive events, variant changes
  - DEBUG: Message processing details, state updates
  - ERROR: Message failures, connection issues

### Controls Panel 
- Three tabs, all tabs allow for steering of features
1. Activated
  - Displays current feature activations
  - Testbench includes clustered and unclustered views
2. Modified
  - Displays currently modified features
3. Search
  - Search bar to semantically search for features

- **Logging**:
  - INFO: Feature modifications, search operations
  - DEBUG: Feature state changes, UI updates
  - TRACE: Detailed feature data, search results
  - ERROR: Feature operation failures

### TestBench Control Panel 🚧 TODO
- Manages UI/UX testing configurations
- Controls A/B testing of different component versions
- Provides real-time component switching
- Enables quick iteration on UI/UX changes

### Connection Status
- Displays system connectivity state
- Shows real-time connection health
- Indicates ongoing operations

## Backend Services

### Chat Completion Service 
- Handles LLM interactions
- Manages basic responses (🚧 TODO: Streaming responses)
- Integrates model variant settings into completions
- Basic error handling (🚧 TODO: Retry logic and advanced error cases)
- **Logging**:
  - INFO: Completion requests, major state changes
  - DEBUG: Request details, response processing
  - TRACE: Full request/response payloads
  - WARNING: Rate limits, performance issues
  - ERROR: SDK failures, completion errors

### Feature Management Service 
- Provides a secure wrapper around the Ember SDK
- Controls feature inspection and steering through SDK methods
- Manages feature activation calculations via SDK
- Handles feature modification requests with basic error handling
- Coordinates with model variant system
- 🚧 TODO: Rate limiting and usage monitoring
- 🚧 TODO: Advanced SDK version compatibility handling
- **Logging**:
  - INFO: Feature modifications, variant updates
  - DEBUG: Feature operations, SDK interactions
  - TRACE: Complete feature payloads, SDK responses
  - WARNING: Rate limits, SDK warnings
  - ERROR: SDK exceptions, operation failures

### TestBench Service 🚧 TODO
- Manages UI/UX test configurations
- Handles test case storage/retrieval
- Maintains active test state
- Collects test metrics and analytics
- Coordinates component version switching

### Storage Service 🚧 TODO
- Vercel KV integration
- Handles test configuration persistence
- Manages session data
- Stores model variant configurations

## Component Dependencies

### Current Frontend Dependencies 
- Chat Interface → Feature Management (for inspection)
- Controls Panel → Feature Management (for steering)
- All Components → Connection Status (for health monitoring)

### Future Frontend Dependencies 🚧 TODO
- TestBench Control Panel → TestBench Service (for UI/UX testing)

### Current Backend Dependencies 
- Chat Completion ← Feature Management (for applying steering)
- Feature Management ← In-Memory Variant System (for configuration)

### Future Backend Dependencies 🚧 TODO
- TestBench Service ← Storage Service (for test persistence)
- All Services ← Persistent Storage (for state management)

## State Management

### Current Implementation 

#### Logging Standards
- Use structured logging format
- Include component context
- Add correlation IDs for request tracking
- Log state transitions at appropriate levels:
  - Major state changes: INFO
  - Detailed state updates: DEBUG
  - Complete state dumps: TRACE

#### Chat Interface
- Message history (in-memory)
- Current completion status
- Stream status
- **Logging**:
  - State transitions
  - Error conditions
  - Performance metrics

#### Controls Panel
- Current feature activations
- Modified features
- Search state
- **Logging**:
  - Feature modifications
  - Search operations
  - UI state changes

### Future Implementation 🚧 TODO

#### TestBench Control Panel
- Current test configuration
- Active component versions
- Test metrics
- Performance analytics

#### Persistent Storage
- Session management
- Configuration persistence
- Test history
- Analytics data 