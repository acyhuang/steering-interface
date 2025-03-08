# Goodfire Ember SDK Integration

## Implementation Status

This document outlines both currently implemented SDK features and planned future enhancements. Features marked with 🚧 TODO are planned for future implementation.

## Overview
This document specifies how we use the Goodfire Ember SDK in our application, particularly focusing on feature management and variant handling.

## Core SDK Components Used

### 1. Variant Management ✓
We use the Variant class to manage model configurations:

```python
from goodfire import Variant, AsyncClient

# Initialize client
client = AsyncClient(api_key="...")

# Create variant from base model
variant = Variant("meta-llama/Llama-3.3-70B-Instruct")
```

### 2. Feature Operations

#### Feature Search & Inspection ✓
```python
# Search for features
features = client.features.search(
    "formal writing style",
    model=variant,
    top_k=20  # Current implementation uses 20
)

# Inspect feature activations in messages
inspector = client.features.inspect(
    messages=[
        {"role": "user", "content": "Hello"},
        {"role": "assistant", "content": "Hi there"}
    ],
    model=variant
)
```

### /features/search Endpoint ✓
```python
async def search_features(
    query: str,
    session_id: str,
    variant_id: Optional[str] = None,
    top_k: Optional[int] = 20
) -> List[FeatureActivation]:
    """Search for features based on semantic similarity to a query string."""
    variant = self.get_variant(session_id, variant_id)
    
    # Use the SDK to search for features
    features = await client.features.search(
        query=query,
        model=variant,
        top_k=top_k
    )
    
    # Convert to FeatureActivation format
    result = []
    for feature in features:
        # Check if this feature has been modified in the variant
        activation = 0.0
        # Check if feature has been modified
        # (Implementation details omitted for brevity)
        
        result.append(FeatureActivation(
            label=feature.label,
            activation=activation
        ))
    
    return result
```

#### Feature Modification ✓
```python
# Modify single feature
variant.set(feature, 0.5)

# 🚧 TODO: Implement batch modifications
# Modify multiple features
variant.set({
    feature1: 0.5,
    feature2: -0.3
})
```

### 3. Chat Completions ✓
```python
# Create completion with variant
response = client.chat.completions.create(
    messages=[{"role": "user", "content": "Hello"}],
    model=variant,
    stream=False  # 🚧 TODO: Implement streaming
)
```

## Current Implementation

### EmberService
Our main service wrapper around the SDK:

```python
class EmberService:
    def __init__(self, settings: Settings) -> None:
        self.client = AsyncClient(settings.get_ember_api_key)
        self.settings = settings
        # Store variants by session_id -> variant_id -> variant
        self.variants: Dict[str, Dict[str, Variant]] = {}

    def _get_default_variant(self, session_id: str) -> Variant:
        """Get or create the default variant for a session."""
        if session_id not in self.variants:
            self.variants[session_id] = {}
        
        if "default" not in self.variants[session_id]:
            self.variants[session_id]["default"] = Variant("meta-llama/Llama-3.3-70B-Instruct")
        
        return self.variants[session_id]["default"]

    def create_variant(self, session_id: str, variant_id: str, base_variant_id: Optional[str] = None) -> Variant:
        """Create a new variant, optionally based on an existing one."""
        # Implementation details in services.py
```

## Future Enhancements 🚧 TODO

### 1. Advanced Error Handling
```python
from goodfire.exceptions import InferenceAbortedException, RateLimitExceeded

try:
    response = await client.chat.completions.create(
        messages=messages,
        model=variant
    )
except InferenceAbortedException:
    return {"error": "Generation aborted by safety filters"}
except RateLimitExceeded:
    return {"error": "Rate limit exceeded", "retry_after": "..."}
except Exception as e:
    return {"error": f"Unexpected error: {str(e)}"}
```

### 2. Persistent Storage Integration
```python
async def save_variant(variant_id: str, variant: Variant):
    """Save variant to persistent storage"""
    await storage.set(f"variant:{variant_id}", variant.json())

async def load_variant(variant_id: str) -> Variant:
    """Load variant from persistent storage"""
    data = await storage.get(f"variant:{variant_id}")
    return Variant.from_json(data)
```

### 3. Rate Limiting
```python
class RateLimitedClient(AsyncClient):
    """Client with rate limiting capabilities"""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.rate_limiter = RateLimiter()
```

## Current Best Practices ✓

### 1. Asynchronous Operations
- Always use `async/await` with the SDK for better performance
- Handle async errors properly with try/catch blocks

### 2. Logging Standards
- Use structured logging with consistent format
- Follow progressive logging levels:
  ```python
  # ERROR: SDK exceptions and critical failures
  logger.error("Failed to create chat completion", exc_info=True)
  
  # WARNING: SDK warnings and performance issues
  logger.warning("Rate limit threshold reached: %d requests/min", rate)
  
  # INFO: Major operations and state changes
  logger.info("Created new variant: %s", variant_id)
  
  # DEBUG: Detailed operation information
  logger.debug("Feature steering applied: %s=%f", feature_label, value)
  
  # TRACE: Complete payload logging
  logger.trace("Full variant state: %s", variant.json())
  ```

### 3. SDK Error Handling
- Use comprehensive try/except blocks
- Log appropriate context with errors
- Include correlation IDs in logs
  ```python
  try:
      response = await client.chat.completions.create(...)
  except Exception as e:
      logger.error(
          "Chat completion failed",
          extra={
              "correlation_id": session_id,
              "error": str(e),
              "variant_id": variant_id
          }
      )
      raise
  ```

### 4. Performance Monitoring
- Log timing information for SDK operations
- Track rate limits and quotas
- Monitor resource usage
  ```python
  start_time = time.time()
  try:
      result = await sdk_operation()
      duration = time.time() - start_time
      logger.debug(
          "SDK operation completed",
          extra={
              "duration_ms": duration * 1000,
              "operation": "sdk_operation"
          }
      )
  except Exception as e:
      logger.error("SDK operation failed", exc_info=True)
  ```

### 5. Data Validation
- Use Pydantic models for request/response validation
- Log validation errors appropriately
- Include validation context in logs

## Future Best Practices 🚧 TODO

1. Implement proper rate limiting
2. Add comprehensive error handling for all SDK exceptions
3. Add persistent storage for variants and configurations
4. Implement proper streaming response handling
5. Add metrics and monitoring
6. Add automated testing for SDK interactions

## API Integration Points

### /chat/completions Endpoint
```python
async def create_chat_completion(
    messages: List[ChatMessage],
    session_id: str,
    variant_id: Optional[str] = None,
    stream: bool = False,
    max_completion_tokens: Optional[int] = 512,
    temperature: Optional[float] = 0.7,
    top_p: Optional[float] = 0.9
) -> ChatResponse:
    """Create a chat completion using the Ember API."""
    variant = self.get_variant(session_id, variant_id)
    variant_json = variant.json()
    
    response = await self.client.chat.completions.create(
        messages=[{"role": msg.role, "content": msg.content} for msg in messages],
        model=variant,
        stream=stream,
        max_completion_tokens=max_completion_tokens,
        temperature=temperature,
        top_p=top_p
    )
    
    return ChatResponse(
        content=response.choices[0].message["content"] if response.choices else "",
        variant_id=variant_id or "default",
        variant_json=json.dumps(variant_json)
    )
```

### /features/inspect Endpoint
```python
async def inspect_features(messages: list, variant_id: str):
    variant = load_variant(variant_id)
    
    inspector = await client.features.inspect(
        messages=messages,
        model=variant
    )
    
    return inspector.top(k=10)
```

### /features/steer Endpoint
```python
async def steer_feature(variant_id: str, feature_label: str, value: float):
    variant = load_variant(variant_id)
    
    # Find feature by label
    features = await client.features.search(
        feature_label,
        model=variant,
        top_k=1
    )
    
    if features:
        # Apply modification
        variant.set(features[0], value)
        
        # Save variant state
        save_variant(variant_id, variant)
        
        return {"success": True}
    
    return {"error": "Feature not found"}
```

### /features/modified Endpoint
```python
async def get_modified_features(variant_id: str):
    variant = load_variant(variant_id)
    return variant.json()
```

## Error Handling

The SDK provides specific exceptions we should handle:

```python
from goodfire.exceptions import InferenceAbortedException
import logging

logger = logging.getLogger(__name__)

try:
    response = await client.chat.completions.create(
        messages=messages,
        model=variant
    )
except InferenceAbortedException as e:
    logger.error(
        "Generation aborted by safety filters",
        extra={
            "session_id": session_id,
            "error_type": "safety_filter",
            "details": str(e)
        }
    )
    return {"error": "Generation aborted by safety filters"}
except Exception as e:
    logger.error(
        "Unexpected error during chat completion",
        exc_info=True,
        extra={"session_id": session_id}
    )
    return {"error": f"Unexpected error: {str(e)}"}
```
