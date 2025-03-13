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
We use structured JSON logging with correlation IDs and consistent context:

```python
# Initialize logger
logger = logging.getLogger(__name__)

@with_correlation_id()
@log_timing(logger)
async def create_chat_completion(...):
    try:
        logger.debug("Creating chat completion", extra={
            "session_id": session_id,
            "variant_id": variant_id,
            "message_count": len(messages)
        })
        
        variant = await self.get_variant(session_id, variant_id)
        
        # Log full variant state at DEBUG level
        logger.debug("Using variant configuration", extra={
            "session_id": session_id,
            "variant_id": variant_id,
            "stream": stream,
            "max_tokens": max_completion_tokens,
            "temperature": temperature,
            "top_p": top_p,
            "variant_state": variant.json()
        })
        
        # Operation success logging
        logger.info("Chat completion successful", extra={
            "session_id": session_id,
            "variant_id": variant_id,
            "content_length": len(content)
        })
        
    except Exception as e:
        # Error logging with full context
        logger.error("Chat completion failed", exc_info=True, extra={
            "session_id": session_id,
            "variant_id": variant_id,
            "error": str(e)
        })
        raise

@with_correlation_id()
@log_timing(logger)
async def steer_feature(...):
    try:
        logger.info("Steering feature", extra={
            "session_id": session_id,
            "variant_id": variant_id,
            "feature": feature_label,
            "value": value
        })
        
        # Debug level for detailed operations
        logger.debug("Feature steering applied", extra={
            "session_id": session_id,
            "variant_id": variant_id,
            "feature": feature_label,
            "value": value
        })
        
    except Exception as e:
        logger.error("Feature steering failed", exc_info=True, extra={
            "session_id": session_id,
            "variant_id": variant_id,
            "feature": feature_label,
            "value": value,
            "error": str(e)
        })
        raise
```

Our logging follows these principles:

1. **Structured Format**
   - All logs are JSON-formatted
   - Include consistent context (session_id, variant_id)
   - Use extra field for structured data

2. **Correlation Tracking**
   - Use `@with_correlation_id()` decorator
   - Track request flow across components
   - Include correlation ID in all logs

3. **Performance Monitoring**
   - Use `@log_timing` decorator
   - Track duration of SDK operations
   - Log performance metrics at DEBUG level

4. **Log Levels**
   - ERROR: SDK exceptions, critical failures
   ```python
   logger.error("Operation failed", exc_info=True, extra={
       "correlation_id": get_correlation_id(),
       "error": str(e)
   })
   ```
   
   - WARNING: SDK warnings, performance issues
   ```python
   logger.warning("Rate limit threshold reached", extra={
       "requests_per_min": rate,
       "correlation_id": get_correlation_id()
   })
   ```
   
   - INFO: Major operations, state changes
   ```python
   logger.info("Feature modification applied", extra={
       "feature": feature_label,
       "value": value,
       "correlation_id": get_correlation_id()
   })
   ```
   
   - DEBUG: Detailed operation info
   ```python
   logger.debug("SDK operation details", extra={
       "operation": "steer_feature",
       "parameters": parameters,
       "correlation_id": get_correlation_id()
   })
   ```
   
   - TRACE: Complete payload logging
   ```python
   logger.debug("Full variant state", extra={
       "variant_json": variant.json(),
       "correlation_id": get_correlation_id()
   })
   ```

5. **Environment-Based Configuration**
```python
# Log levels by environment
LOGGING_CONFIG = {
    "production": "INFO",
    "staging": "DEBUG",
    "development": "TRACE"
}
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

### /features/analyze-query Endpoint
```python
async def analyze_query(
    query: str,
    session_id: str,
    variant_id: Optional[str] = None,
    context: Optional[Dict[str, List[ChatMessage]]] = None
) -> QueryAnalysisResponse:
    """Analyze a user query to determine optimal persona and feature categories.
    
    Uses the SDK to:
    1. Analyze query intent and required expertise
    2. Determine optimal persona settings
    3. Identify relevant feature categories and importance
    """
    variant = await self.get_variant(session_id, variant_id)
    
    # Use LLM to analyze query and determine optimal features
    analysis_json = await self.llm_client.get_json_response(prompt)
    
    # Convert to structured response with persona and feature recommendations
    response = QueryAnalysisResponse(
        persona=PersonaAnalysis(...),
        features=FeatureAnalysis(...)
    )
    
    # Automatically apply recommended features
    await self.auto_steer(
        analysis=response,
        session_id=session_id,
        variant_id=variant_id
    )
    
    return response
```

### /features/auto-steer Endpoint
```python
async def auto_steer(
    analysis: QueryAnalysisResponse,
    session_id: str,
    variant_id: Optional[str] = None
) -> List[SteerFeatureResponse]:
    """Automatically apply feature steering based on query analysis.
    
    Uses the SDK to:
    1. Convert importance scores to steering values
    2. Search for matching features
    3. Apply steering modifications
    """
    steered_features: List[SteerFeatureResponse] = []
    
    # Process all feature categories (style, reasoning, knowledge)
    all_features = (
        [("style", f) for f in analysis.features.style] +
        [("reasoning", f) for f in analysis.features.reasoning] +
        [("knowledge", f) for f in analysis.features.knowledge]
    )
    
    for category, feature in all_features:
        # Convert importance (1-4) to steering value (0.1-0.4)
        steering_value = feature.importance / 10.0
        
        # Search for matching feature using SDK
        search_results = await self.search_features(
            query=feature.label,
            session_id=session_id,
            variant_id=variant_id,
            top_k=1
        )
        
        if search_results:
            # Apply steering using SDK's variant.set()
            steered = await self.steer_feature(
                session_id=session_id,
                variant_id=variant_id,
                feature_label=search_results[0].label,
                value=steering_value
            )
            steered_features.append(steered)
    
    return steered_features
```

### /features/cluster Endpoint
```python
async def cluster_features(
    features: List[FeatureActivation],
    session_id: str,
    variant_id: Optional[str] = None,
    num_categories: int = 5
) -> List[FeatureCluster]:
    """Cluster features into logical groups.
    
    Uses the SDK to:
    1. Get feature embeddings and metadata
    2. Group related features
    3. Generate cluster descriptions
    """
    # Get the variant
    variant = await self.get_variant(session_id, variant_id)
    
    # Use LLM to cluster features
    clusters = await cluster_features(
        llm_client=self.llm_client,
        features=features,
        num_categories=num_categories
    )
    
    # Log clustering results
    logger.info("Feature clustering completed", extra={
        "session_id": session_id,
        "variant_id": variant_id,
        "cluster_count": len(clusters),
        "total_features": sum(len(c.features) for c in clusters)
    })
    
    return clusters
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
