# Goodfire Ember SDK & API Reference

Features marked with [TODO] are planned for future implementation.

## Overview of the Steering Interface API

The Steering Interface API provides a secure wrapper around the Goodfire Ember SDK, enabling:
- Real-time chat interactions with LLMs
- Feature activation inspection
- Dynamic feature steering
- Variant state management (in-memory)
- Secure SDK key management

### Base URL
```
Development: http://localhost:8000/api/v1
```

### Current Session Management
- Single default session ID ("default_session")
- In-memory variant storage
- Session data cleared on server restart
- No authentication required in MVP

## SDK Components & Usage

### Core SDK Classes

#### AsyncClient
Main interface to the Ember SDK. Used for all API operations.
```python
from goodfire import AsyncClient
client = AsyncClient(api_key="...")
```

#### Variant
Represents a specific model configuration with feature modifications.
```python
from goodfire import Variant
variant = Variant("meta-llama/Llama-3.3-70B-Instruct")
```

### Key SDK Operations

#### Chat Operations
- `client.chat.completions.create()` - Generate text completions

#### Feature Operations
- `client.features.search()` - Search for features by semantic similarity
- `client.features.inspect()` - Analyze feature activations in text

#### Variant Operations
- `variant.set()` - Modify feature activation values
- `variant.clear()` - Remove feature modifications
- `variant.json()` - Get the complete variant configuration



### Best Practices

1. **Use async/await pattern**
   ```python
   response = await client.chat.completions.create(...)
   ```

2. **Handle errors properly**
   ```python
   try:
       response = await client.chat.completions.create(...)
   except InferenceAbortedException as e:
       # Handle safety filter exceptions
   ```

3. **Use structured logging**
   ```python
   logger.info("Operation completed", extra={"session_id": session_id})
   ```

## API Endpoints Reference

### Chat

#### Create Chat Completion
Generates a chat completion using the specified model variant.

```http
POST /chat/completions
```

**Request:**
```json
{
  "messages": [
    {
      "role": "user|assistant",
      "content": "string"
    }
  ],
  "session_id": "string",
  "variant_id": "string",         // optional
  "max_completion_tokens": 512,   // optional
  "temperature": 0.7,             // optional
  "top_p": 0.9                    // optional
}
```

**Response:**
```json
{
  "content": "string",          // The model's response
  "variant_id": "string",       // ID of the variant used
  "variant_json": "string"      // Complete variant configuration
}
```

**SDK Methods Used:** 
- `client.chat.completions.create()`

### Features

#### Search Features
Searches for features based on semantic similarity to a query string.

```http
POST /features/search
```

**Request:**
```json
{
  "query": "string",          // Search query
  "session_id": "string",
  "variant_id": "string",     // optional
  "top_k": 20                 // optional, default: 20
}
```

**Response:**
```json
[
  {
    "label": "string",        // Feature label
    "activation": 0.0         // Current activation value
  }
]
```

**SDK Methods Used:**
- `client.features.search()`

#### Steer Feature
Modifies a feature's activation value for the current variant.

```http
POST /features/steer
```

**Request:**
```json
{
  "session_id": "string",
  "variant_id": "string",      // optional
  "feature_label": "string",
  "value": 0.5                 // Value between -1 and 1
}
```

**Response:**
```json
{
  "label": "string",
  "activation": 0.5,          // Current activation value
  "modified_value": 0.5       // Applied steering value
}
```

**SDK Methods Used:**
- `variant.set()`

**Frontend Integration:**
- Used with the comparison workflow to preview changes
- VariantContext tracks these changes as pending until confirmed

#### Inspect Features
Analyzes feature activations in the current conversation.

```http
POST /features/inspect
```

**Request:**
```json
{
  "messages": [
    {
      "role": "user|assistant",
      "content": "string"
    }
  ],
  "session_id": "string",
  "variant_id": "string"        // optional
}
```

**Response:**
```json
[
  {
    "label": "string",         // Feature identifier
    "activation": 0.75         // Activation value between -1 and 1
  }
]
```

**SDK Methods Used:**
- `client.features.inspect()`

#### Get Modified Features
Retrieves the complete variant state including all modifications.

```http
GET /features/modified
```

**Query Parameters:**
- `session_id` (string, required)
- `variant_id` (string, required)

**Response:** 
- Raw variant JSON containing all modifications and settings

**SDK Methods Used:**
- `variant.json()`

#### Clear Feature
Removes a feature's modifications from the current variant.

```http
POST /features/clear
```

**Request:**
```json
{
  "session_id": "string",
  "variant_id": "string",      // optional
  "feature_label": "string"
}
```

**Response:**
```json
{
  "label": "string"          // Cleared feature label
}
```

**SDK Methods Used:**
- `variant.clear()`

#### Analyze Query
Analyzes a user query to determine optimal persona and feature categories.

```http
POST /features/analyze-query
```

**Request:**
```json
{
  "query": "string",           // User's query
  "session_id": "string",
  "variant_id": "string",      // optional
  "context": {                 // optional
    "previous_messages": [     // Previous conversation context
      {
        "role": "user|assistant",
        "content": "string"
      }
    ]
  }
}
```

**Response:**
```json
{
  "persona": {
    "role": "string",          // e.g., "writing coach", "technical expert"
    "style": "string",         // Communication style description
    "approach": "string"       // Problem-solving approach
  },
  "features": {
    "style": [                 // Writing style features
      {
        "label": "string",     // Feature identifier
        "importance": 0.8      // Importance score (0-1)
      }
    ],
    "reasoning": [],           // Reasoning method features
    "knowledge": []            // Knowledge domain features
  }
}
```

**SDK Methods Used:**
- None

#### Auto-Steer
Automatically applies feature steering based on query analysis.

```http
POST /features/auto-steer
```

**Request:**
```json
{
  "analysis": {                // Output from analyze-query
    "persona": {
      "role": "string",
      "style": "string",
      "approach": "string"
    },
    "features": {
      "style": [],
      "reasoning": [],
      "knowledge": []
    }
  },
  "session_id": "string",
  "variant_id": "string",     // optional
  "max_features": 5           // optional, max features per category
}
```

**Response:**
```json
{
  "applied_features": [
    {
      "label": "string",      // Feature identifier
      "value": 0.5,           // Applied steering value
      "category": "string"    // Feature category
    }
  ],
  "variant_id": "string",     // ID of modified variant
  "variant_json": "string"    // Complete variant configuration
}
```

**SDK Methods Used:**
- `client.features.search()`
- `variant.set()`

## Error Handling

Standard HTTP status codes are used along with error responses:

```json
{
  "detail": "Error description"
}
```

Common SDK exceptions handled:
- `InferenceAbortedException` - When safety filters abort generation
- `RateLimitExceeded` - When API rate limits are hit 

## Steering Comparison Workflow

The steering comparison workflow leverages existing API endpoints but implements a two-step confirmation process on the frontend:

1. **Apply Pending Changes**
   - Frontend stores pending feature modifications in VariantContext
   - Backend endpoints (steer/clear) are called with these pending values
   - Original response is preserved for comparison

2. **Generate Comparison**
   - System generates a new response using the pending feature changes
   - Both original and steered responses are displayed side-by-side
   - User selects their preferred response

3. **Confirm or Cancel Changes**
   - If steered response is selected: pending changes become permanent
   - If original response is selected: pending changes are reverted
   - The selected response becomes the new current response

This approach allows users to see the direct impact of steering modifications before committing to them, building intuition for how features influence model outputs. 