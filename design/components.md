# Components

Features marked with [TODO] are planned for future implementation.

## Frontend Components

### Chat Interface 
- Main user interaction point for conversations
- Handles message input/output 
- Manages chat history display
- Provides variant information display
- Supports message regeneration
- Integrates with Controls panel through variant and message updates

### Controls Panel 
- Three tabs for feature management:
  1. Activated
     - Displays current feature activations
     - Shows clustered and unclustered feature views
     - Allows real-time feature steering with comparison
  2. Modified
     - Displays currently modified features
     - Shows current variant state
     - Indicates pending vs. confirmed modifications
  3. Search
     - Provides semantic search for features
     - Displays search results with steering controls

### Feature Card Components
- Provides UI for individual feature interactions
- Supports different feature types:
  - Continuous features with slider controls
  - Discrete features with toggle controls
- Handles feature steering actions

### Feature List Components
- Manages feature collection displays
- Supports:
  - Clustered view (features grouped by semantic similarity)
  - Unclustered view (flat list of features)
- Integrates with Feature Card components

### Connection Status
- Displays system connectivity state
- Shows real-time API connection health
- Updates status every 5 seconds

### ComparisonView Component
- Displays side-by-side comparison of original and steered responses
- Provides UI for selecting preferred response
- Shows loading and error states during generation
- Facilitates the two-step confirmation process for steering
- Integrated with VariantContext for state management

### Feature Editor Component
- Extends Feature Card with enhanced steering capabilities
- Maintains pending state for feature modifications
- Integrates with VariantContext for managing pending features
- Supports discrete feature value selection with slider
- Provides visual feedback for pending vs. confirmed states