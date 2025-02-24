from typing import AsyncGenerator, List, Optional, Dict
from goodfire import AsyncClient, Variant
from ..models.chat import ChatMessage, ChatRequest, ChatResponse
from ..models.features import FeatureActivation, SteerFeatureResponse, ClearFeatureResponse
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
        """Create a chat completion using the Ember API."""
        try:
            logger.info(f"Creating chat completion for variant {variant_id}")
            
            variant = self.get_variant(session_id, variant_id)
            variant_json = variant.json()
            logger.info(f"Variant JSON: {json.dumps(variant_json, indent=2)}")
            
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
                variant_json=json.dumps(variant_json)  # Convert dict to JSON string
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
            logger.info(f"[VARIANT_DEBUG] Steering feature for session={session_id}, variant={variant_id}")
            variant = self.get_variant(session_id, variant_id)
            logger.info(f"[VARIANT_DEBUG] Pre-steering variant state: {json.dumps(variant.json(), indent=2)}")
            
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
            logger.info(f"[VARIANT_DEBUG] Post-steering variant state: {json.dumps(variant.json(), indent=2)}")
            
            # Return response with the values we set
            return SteerFeatureResponse(
                label=feature_label,
                activation=value,  # Use the value we set since we can't verify
                modified_value=value
            )
            
        except Exception as e:
            logger.error(f"Error in steer_feature: {str(e)}")
            raise 

    def get_modified_features(self, session_id: str, variant_id: Optional[str] = None) -> Dict:
        """Get the variant's raw JSON state.
        
        Returns the complete variant JSON which includes all modifications and settings.
        """
        try:
            logger.info(f"[VARIANT_DEBUG] Getting modified features for session={session_id}, variant={variant_id}")
            variant = self.get_variant(session_id, variant_id)
            variant_json = variant.json()
            logger.info(f"[VARIANT_DEBUG] Current variant state: {json.dumps(variant_json, indent=2)}")
            return variant_json  # Return raw dict for API endpoint
            
        except Exception as e:
            logger.error(f"Error getting variant JSON: {str(e)}")
            raise

    async def clear_feature(
        self,
        session_id: str,
        variant_id: Optional[str],
        feature_label: str
    ) -> ClearFeatureResponse:
        """Clear a feature's modifications from the variant."""
        try:
            logger.info(f"[VARIANT_DEBUG] Clearing feature for session={session_id}, variant={variant_id}")
            variant = self.get_variant(session_id, variant_id)
            logger.info(f"[VARIANT_DEBUG] Pre-clearing variant state: {json.dumps(variant.json(), indent=2)}")
            
            # Search for the feature
            features = await self.client.features.search(
                feature_label,
                model=variant,
                top_k=1
            )
            
            if not features:
                raise ValueError(f"Feature '{feature_label}' not found")
                
            feature = features[0]
            
            # Clear the feature
            variant.clear(feature)
            logger.info(f"[VARIANT_DEBUG] Post-clearing variant state: {json.dumps(variant.json(), indent=2)}")
            
            # Return response with the cleared feature label
            return ClearFeatureResponse(
                label=feature_label
            )
            
        except Exception as e:
            logger.error(f"Error in clear_feature: {str(e)}")
            raise 