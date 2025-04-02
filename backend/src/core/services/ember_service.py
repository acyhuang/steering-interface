from typing import AsyncGenerator, List, Optional, Dict, Any
import logging
from goodfire import AsyncClient
from ..config import Settings
from ...models.chat import ChatMessage, ChatRequest, ChatResponse
from ...models.features import (
    FeatureActivation, 
    SteerFeatureResponse, 
    ClearFeatureResponse, 
    FeatureCluster,
    ClusteredFeaturesResponse,
    QueryAnalysisResponse
)
from ..llm_client import LLMClient
from .variant_manager import VariantManager
from .completion_service import CompletionService
from .feature_service import FeatureService
from .analysis_service import AnalysisService

# Initialize logger
logger = logging.getLogger(__name__)

class EmberService:
    """Facade service for interacting with the Ember API.
    
    This service coordinates all operations through specialized service
    components and provides a unified interface for API routes.
    """
    
    def __init__(self, settings: Settings) -> None:
        """Initialize the Ember service with configuration.
        
        Args:
            settings: Application settings including API keys
        """
        # Initialize the shared client
        self.client = AsyncClient(settings.get_ember_api_key)
        self.settings = settings
        
        # Initialize LLM client with API key from settings
        api_key = settings.get_openai_api_key
        logger.info("Initializing EmberService", extra={
            "api_key_set": bool(api_key),
            "model": settings.openai_model
        })
        
        # Create LLM client
        self.llm_client = LLMClient(
            api_key=api_key,
            model=settings.openai_model
        )
        
        # Initialize service components
        self.variant_manager = VariantManager(settings)
        
        self.completion_service = CompletionService(
            client=self.client,
            variant_manager=self.variant_manager,
            settings=settings
        )
        
        self.feature_service = FeatureService(
            client=self.client,
            variant_manager=self.variant_manager,
            llm_client=self.llm_client,
            settings=settings
        )
        
        self.analysis_service = AnalysisService(
            variant_manager=self.variant_manager,
            feature_service=self.feature_service,
            llm_client=self.llm_client,
            settings=settings
        )
        
        logger.info(f"Initialized EmberService with default model: {settings.default_model}")
    
    # =========================================================================
    # Variant Management Methods
    # =========================================================================
    
    async def create_variant(
        self, 
        session_id: str,
        base_variant_id: Optional[str] = None,
        is_default: bool = False
    ):
        """Create a new variant, optionally based on an existing one."""
        return await self.variant_manager.create_variant(
            session_id=session_id,
            base_variant_id=base_variant_id,
            is_default=is_default
        )
    
    async def get_variant(self, session_id: str, variant_id: Optional[str] = None):
        """Get a variant by session_id and variant_id."""
        return await self.variant_manager.get_variant(session_id, variant_id)
    
    # =========================================================================
    # Chat Completion Methods
    # =========================================================================
    
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
        return await self.completion_service.create_chat_completion(
            messages, 
            session_id, 
            variant_id, 
            stream, 
            max_completion_tokens, 
            temperature, 
            top_p
        )
    
    # =========================================================================
    # Feature Management Methods
    # =========================================================================
    
    async def inspect_features(
        self,
        messages: List[ChatMessage],
        session_id: str,
        variant_id: Optional[str] = None
    ) -> List[FeatureActivation]:
        """Inspect feature activations in the current conversation."""
        return await self.feature_service.inspect_features(messages, session_id, variant_id)
    
    async def search_features(
        self,
        query: str,
        session_id: str,
        variant_id: Optional[str] = None,
        top_k: Optional[int] = 20
    ) -> List[FeatureActivation]:
        """Search for features based on semantic similarity to a query string."""
        return await self.feature_service.search_features(query, session_id, variant_id, top_k)
    
    async def steer_feature(
        self,
        session_id: str,
        variant_id: Optional[str],
        feature_label: str,
        value: float
    ) -> SteerFeatureResponse:
        """Steer a feature's activation value."""
        return await self.feature_service.steer_feature(session_id, variant_id, feature_label, value)
    
    async def get_modified_features(self, session_id: str, variant_id: Optional[str] = None) -> Dict:
        """Get the variant's raw JSON state."""
        return await self.variant_manager.get_variant_state(session_id, variant_id)
    
    async def clear_feature(
        self,
        session_id: str,
        variant_id: Optional[str],
        feature_label: str
    ) -> ClearFeatureResponse:
        """Clear a feature's modifications from the variant."""
        return await self.feature_service.clear_feature(session_id, variant_id, feature_label)
    
    async def cluster_features(
        self,
        features: List[FeatureActivation],
        session_id: str,
        variant_id: Optional[str] = None,
        force_refresh: bool = False,
        num_categories: int = 5
    ) -> List[FeatureCluster]:
        """Cluster features into logical groups."""
        return await self.feature_service.cluster_features(
            features, 
            session_id, 
            variant_id, 
            force_refresh, 
            num_categories
        )
    
    # =========================================================================
    # Analysis Methods
    # =========================================================================
    
    async def analyze_query(
        self,
        query: str,
        session_id: str,
        variant_id: Optional[str] = None,
        context: Optional[Dict[str, List[ChatMessage]]] = None
    ) -> QueryAnalysisResponse:
        """Analyze a user query to determine optimal persona and feature categories."""
        return await self.analysis_service.analyze_query(query, session_id, variant_id, context)
    
    async def auto_steer(
        self,
        analysis: QueryAnalysisResponse,
        session_id: str,
        variant_id: Optional[str] = None
    ) -> List[SteerFeatureResponse]:
        """Automatically steer features based on query analysis."""
        return await self.analysis_service.auto_steer(analysis, session_id, variant_id) 