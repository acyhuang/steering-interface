# API Documentation

## Overview
The Steering Interface API provides a secure wrapper around the Goodfire Ember SDK, enabling:
- Real-time chat interactions with LLMs
- Feature activation inspection
- Dynamic feature steering
- Variant state management
- Rate limiting and usage monitoring
- Secure SDK key management

## Base URL
```
Development: http://localhost:8000/api/v1
```

## Endpoints

### Chat

#### Create Chat Completion
```http
POST /chat/completions
```

Creates a chat completion using the current model and variant settings.

**Request Body:**
```json
{
  "messages": [
    {
      "role": "user|assistant",
      "content": "string"
    }
  ],
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

#### Health Check
```http
GET /chat/health
```

Returns API health status.

**Response:**
```json
{
  "status": "ok"
}
```

### Features

#### Inspect Features
```http
POST /features/inspect
```

Analyzes feature activations in the current conversation.

**Request Body:**
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

#### Steer Feature
```http
POST /features/steer
```

Modifies a feature's activation value for the current variant.

**Request Body:**
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

#### Get Modified Features
```http
GET /features/modified
```

Retrieves the complete variant state including all modifications.

**Query Parameters:**
- `session_id` (string, required)
- `variant_id` (string, optional)

**Response:** Raw variant JSON containing all modifications and settings

## Error Handling

All endpoints use standard HTTP status codes:
- `200`: Success
- `400`: Bad Request (invalid parameters)
- `500`: Internal Server Error
- `502`: SDK Service Error
- `429`: Rate Limit Exceeded

Error responses include a detail message:
```json
{
  "detail": "Error description",
  "sdk_error": "Original SDK error message" // When applicable
}
```

## Session Management

The API currently uses a simplified session model:
- Default session ID: `"default_session"`
- One active session supported at a time
- No authentication required in v0

## Variants

Variants represent different configurations of the model:
- Each session can have multiple variants
- Default variant ID: `"default"`
- Variants persist feature modifications within a session