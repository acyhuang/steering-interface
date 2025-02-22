# Components Documentation

## Frontend Components

### Chat Interface
- Main user interaction point for conversations
- Handles message input/output
- Manages chat history display
- Triggers feature inspection on new messages
- Integrates with current model variant settings for completions

### Inspector Panel
- Displays current feature activations
- Provides controls for feature adjustment
- Updates in real-time as messages are processed
- Shows feature search and filtering options

### TestBench Control Panel
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
- Manages streaming responses
- Integrates model variant settings into completions
- Handles retry logic and error cases

### Feature Management Service
- Controls feature inspection and steering
- Manages feature activation calculations
- Handles feature modification requests
- Coordinates with model variant system

### TestBench Service
- Manages UI/UX test configurations
- Handles test case storage/retrieval
- Maintains active test state
- Collects test metrics and analytics
- Coordinates component version switching

### Storage Service
- Vercel KV integration
- Handles test configuration persistence
- Manages session data
- Stores model variant configurations

## Component Dependencies

### Frontend Dependencies
- Chat Interface → Feature Management (for inspection)
- Inspector Panel → Feature Management (for steering)
- TestBench Control Panel → TestBench Service (for UI/UX testing)
- All Components → Connection Status (for health monitoring)

### Backend Dependencies
- Chat Completion ← Feature Management (for applying steering)
- Feature Management ← Model Variant System (for configuration)
- TestBench Service ← Storage Service (for test persistence)

## State Management
Each component maintains specific state:

### Chat Interface
- Message history
- Current completion status
- Stream status

### Inspector Panel
- Current feature activations
- Modified features
- Search state

### TestBench Control Panel
- Current test configuration
- Active component versions
- Test metrics
- Performance analytics 