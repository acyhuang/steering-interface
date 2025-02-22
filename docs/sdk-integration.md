# Goodfire Ember SDK Integration

## Overview
This document specifies how we use the Goodfire Ember SDK in our application, particularly focusing on feature management and variant handling.

## Core SDK Components Used

### 1. Variant Management
We use the Variant class to manage model configurations([1](https://docs.goodfire.ai/sdk-reference/variants)):

```python
from goodfire import Variant, Client

# Initialize client
client = Client(api_key="...")

# Create variant from base model
variant = Variant("meta-llama/Llama-3.3-70B-Instruct")
```

### 2. Feature Operations

#### Feature Search & Inspection
```python
# Search for features
features = client.features.search(
    "formal writing style",
    model=variant,
    top_k=10
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

#### Feature Modification
```python
# Modify single feature
variant.set(feature, 0.5)

# Modify multiple features
variant.set({
    feature1: 0.5,
    feature2: -0.3
})
```

### 3. Chat Completions
```python
# Create completion with variant
response = client.chat.completions.create(
    messages=[{"role": "user", "content": "Hello"}],
    model=variant,
    stream=True
)
```

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

## Variant State Management

We use in-memory variant storage through the EmberService class:

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
        # ... implementation details ...
```

## Error Handling

The SDK provides specific exceptions we should handle:

```python
from goodfire.exceptions import InferenceAbortedException

try:
    response = await client.chat.completions.create(
        messages=messages,
        model=variant
    )
except InferenceAbortedException:
    return {"error": "Generation aborted by safety filters"}
except Exception as e:
    return {"error": f"Unexpected error: {str(e)}"}
```

## Best Practices

1. Always use `async/await` with the SDK for better performance
2. Use comprehensive logging for debugging and monitoring
3. Use Pydantic models for request/response validation
4. Handle streaming responses appropriately in the frontend
5. Use proper session and variant management through EmberService 