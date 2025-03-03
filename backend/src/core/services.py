from typing import AsyncGenerator, List, Optional, Dict, Any
from goodfire import AsyncClient, Variant
from ..models.chat import ChatMessage, ChatRequest, ChatResponse
from ..models.features import FeatureActivation, SteerFeatureResponse, ClearFeatureResponse, ModifiedFeature, FeatureCluster, ClusteredFeaturesResponse
import logging
from .config import Settings
import json  # Add this import at the top
from .llm_client import LLMClient
from .clustering import cluster_features

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
        
        # Initialize LLM client with API key from settings
        api_key = settings.get_openai_api_key
        logger.info(f"Initializing LLM client with API key: {'Set' if api_key else 'Not set'}")
        self.llm_client = LLMClient(
            api_key=api_key,
            model=settings.openai_model
        )
        
        # Store variants by session_id -> variant_id -> variant
        self.variants: Dict[str, Dict[str, Variant]] = {}
        logger.info(f"Initialized EmberService with default model: {settings.default_model}")
    
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
        """Get a variant by session_id and variant_id.
        
        Args:
            session_id: Session ID
            variant_id: Optional variant ID (defaults to "default")
            
        Returns:
            Variant object
        """
        variant_id = variant_id or "default"
        logger.info(f"Getting variant for session {session_id}, variant {variant_id}")
        
        try:
            # Check if we have this variant cached
            if session_id in self.variants and variant_id in self.variants[session_id]:
                logger.info(f"Using cached variant for session {session_id}, variant {variant_id}")
                return self.variants[session_id][variant_id]
            
            # Create a new variant
            logger.info(f"Creating new variant for session {session_id}, variant {variant_id}")
            variant = self._get_default_variant(session_id)
            
            # Cache the variant
            if session_id not in self.variants:
                self.variants[session_id] = {}
            self.variants[session_id][variant_id] = variant
            
            return variant
        except Exception as e:
            logger.error(f"Error getting variant: {str(e)}")
            logger.error(f"Using default variant as fallback")
            return self._get_default_variant(session_id)
    
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

    async def search_features(
        self,
        query: str,
        session_id: str,
        variant_id: Optional[str] = None,
        top_k: Optional[int] = 20
    ) -> List[FeatureActivation]:
        """Search for features based on semantic similarity to a query string."""
        try:
            variant = self.get_variant(session_id, variant_id)
            
            # Use the SDK to search for features
            features = await self.client.features.search(
                query=query,
                model=variant,
                top_k=top_k
            )
            
            # Convert to FeatureActivation format
            result = []
            for feature in features:
                # Check if this feature has been modified in the variant
                activation = 0.0
                
                # For now, just use 0.0 as the activation value
                # We'll fix the comparison logic once we understand the object structure
                
                result.append(FeatureActivation(
                    label=feature.label,
                    activation=activation
                ))
            
            logger.info(f"Found {len(result)} features for query: {query}")
            return result
        except Exception as e:
            logger.error(f"Error searching features: {str(e)}")
            raise 

    async def cluster_features(
        self,
        features: List[FeatureActivation],
        session_id: str,
        variant_id: Optional[str] = None,
        force_refresh: bool = False,
        num_categories: int = 5
    ) -> List[FeatureCluster]:
        """Cluster features into logical groups.
        
        Args:
            features: List of features to cluster
            session_id: Session ID
            variant_id: Optional variant ID
            force_refresh: Whether to force a refresh of cached results
            num_categories: Target number of categories
            
        Returns:
            List of feature clusters
        """
        try:
            logger.info(f"EmberService.cluster_features called with {len(features)} features for session {session_id}")
            # logger.info(f"Feature labels: {[f.label for f in features]}")
            
            # Get the variant
            variant = self.get_variant(session_id, variant_id)
            # logger.info(f"Using variant: {variant}")
            
            # Cluster the features
            logger.info(f"Calling cluster_features with num_categories={num_categories}, force_refresh={force_refresh}")
            clusters = await cluster_features(
                llm_client=self.llm_client,
                features=features,
                num_categories=num_categories,
                force_refresh=force_refresh
            )
            
            # logger.info(f"Received {len(clusters)} clusters from cluster_features")
            # for i, cluster in enumerate(clusters):
            #     logger.info(f"Cluster {i+1}: {cluster.name} (Type: {cluster.type}) with {len(cluster.features)} features")
            #     logger.info(f"Features in cluster {i+1}: {[f.label for f in cluster.features]}")
            
            return clusters
        except Exception as e:
            logger.error(f"Error in EmberService.cluster_features: {str(e)}")
            logger.error(f"Exception type: {type(e).__name__}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            # Fallback: return a single cluster with all features
            logger.warning(f"Using fallback: returning all {len(features)} features in a single cluster")
            return [FeatureCluster(
                name="All Features",
                features=features,
                type="dynamic"
            )] 