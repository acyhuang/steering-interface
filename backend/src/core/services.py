from typing import AsyncGenerator, List, Optional, Dict
from goodfire import AsyncClient, Variant
from ..models.chat import ChatMessage, ChatRequest, ChatResponse
from ..models.features import FeatureActivation, SteerFeatureResponse
import logging
from .config import Settings
import json  # Add this import at the top

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
# Set httpx logger to WARNING to reduce noise
logging.getLogger("httpx").setLevel(logging.WARNING)

logger = logging.getLogger(__name__)

class EmberService:
    """Service for interacting with the Ember API.
    
    This service manages a single client instance and provides methods
    for all Ember API operations including chat, feature steering, and
    configuration management.
    """
    
    def __init__(self, settings: Settings) -> None:
        """Initialize the Ember service with configuration.
        
        Args:
            settings: Application settings including API keys
        """
        self.client = AsyncClient(settings.get_ember_api_key)
        self.settings = settings
        # Store variants by session_id -> variant_id -> variant
        self.variants: Dict[str, Dict[str, Variant]] = {}
        logger.info("EmberService initialized")
    
    def _get_default_variant(self, session_id: str) -> Variant:
        """Get or create the default variant for a session."""
        if session_id not in self.variants:
            self.variants[session_id] = {}
        
        if "default" not in self.variants[session_id]:
            self.variants[session_id]["default"] = Variant("meta-llama/Llama-3.3-70B-Instruct")
        
        return self.variants[session_id]["default"]
    
    def create_variant(self, session_id: str, variant_id: str, base_variant_id: Optional[str] = None) -> Variant:
        """Create a new variant, optionally based on an existing one."""
        if session_id not in self.variants:
            self.variants[session_id] = {}
            
        if base_variant_id:
            base = self.variants[session_id].get(base_variant_id)
            if not base:
                raise ValueError(f"Base variant {base_variant_id} not found")
            # Create new variant with same settings as base
            new_variant = Variant(base.model_name)  # You might need to copy other settings
        else:
            # Create fresh variant
            new_variant = Variant("meta-llama/Llama-3.3-70B-Instruct")
            
        self.variants[session_id][variant_id] = new_variant
        return new_variant
    
    def get_variant(self, session_id: str, variant_id: Optional[str] = None) -> Variant:
        """Get a specific variant or the default if none specified."""
        if variant_id is None:
            return self._get_default_variant(session_id)
            
        if session_id not in self.variants:
            raise ValueError(f"No variants found for session {session_id}")
            
        variant = self.variants[session_id].get(variant_id)
        if not variant:
            raise ValueError(f"Variant {variant_id} not found")
            
        return variant
    
    async def create_chat_completion(
        self,
        messages: List[ChatMessage],
        session_id: str,
        variant_id: Optional[str] = None,
        stream: bool = False,
        max_completion_tokens: Optional[int] = 512,
        temperature: Optional[float] = 0.7,
        top_p: Optional[float] = 0.9
    ) -> ChatResponse:
        """Create a chat completion using the Ember API.
        
        Args:
            messages: List of chat messages
            session_id: Session ID
            variant_id: Variant ID
            stream: Whether to stream the response
            max_completion_tokens: Maximum tokens in completion
            temperature: Sampling temperature
            top_p: Nucleus sampling parameter
            
        Returns:
            ChatResponse containing the model's response
            
        Raises:
            Exception: If the API call fails
        """
        try:
            logger.info(f"Creating chat completion for variant {variant_id}")
            
            variant = self.get_variant(session_id, variant_id)
            # Convert the dictionary to a JSON string
            variant_json = json.dumps(variant.json(), indent=2)
            logger.info(f"Variant JSON: {variant_json}")
            
            response = await self.client.chat.completions.create(
                messages=[{"role": msg.role, "content": msg.content} for msg in messages],
                model=variant,
                stream=stream,
                max_completion_tokens=max_completion_tokens or 512,
                temperature=temperature or 0.7,
                top_p=top_p or 0.9
            )
            
            content = response.choices[0].message["content"] if response.choices else ""
            
            return ChatResponse(
                content=content,
                variant_id=variant_id or "default",
                variant_json=variant_json
            )
            
        except Exception as e:
            logger.error(f"Error in create_chat_completion: {str(e)}")
            raise 

    async def inspect_features(self, messages: List[ChatMessage], session_id: str, variant_id: Optional[str] = None) -> List[FeatureActivation]:
        """Inspect feature activations in the current conversation."""
        try:
            variant = self.get_variant(session_id, variant_id)
            
            inspector = await self.client.features.inspect(
                messages=[{"role": msg.role, "content": msg.content} for msg in messages],
                model=variant
            )
            
            activations = []
            for activation in inspector.top(k=20):
                activations.append(FeatureActivation(
                    label=activation.feature.label,
                    activation=activation.activation
                ))
            
            return activations
            
        except Exception as e:
            logger.error(f"Error in inspect_features: {str(e)}")
            raise 

    async def steer_feature(
        self,
        session_id: str,
        variant_id: Optional[str],
        feature_label: str,
        value: float
    ) -> SteerFeatureResponse:
        """Steer a feature's activation value."""
        try:
            variant = self.get_variant(session_id, variant_id)
            
            # Search for the feature
            features = await self.client.features.search(
                feature_label,
                model=variant,
                top_k=1
            )
            
            if not features:
                raise ValueError(f"Feature '{feature_label}' not found")
                
            feature = features[0]
            
            # Apply the steering
            variant.set(feature, value)
            
            # Return response with the values we set
            return SteerFeatureResponse(
                label=feature_label,
                activation=value,  # Use the value we set since we can't verify
                modified_value=value
            )
            
        except Exception as e:
            logger.error(f"Error in steer_feature: {str(e)}")
            raise 

    def get_modified_features(self, session_id: str, variant_id: Optional[str] = None) -> List[Dict]:
        """Get list of modified features from variant."""
        variant = self.get_variant(session_id, variant_id)
        variant_data = variant.json()
        
        return [{
            'label': edit['feature_label'],
            'value': edit['value']
        } for edit in variant_data.get('edits', [])] 