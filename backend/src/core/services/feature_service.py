from typing import List, Optional, Dict
import logging
from goodfire import AsyncClient
from ..config import Settings
from .interfaces.feature_service import IFeatureService
from .interfaces.variant_manager import IVariantManager
from ...models.chat import ChatMessage
from ...models.features import (
    FeatureActivation, 
    SteerFeatureResponse, 
    ClearFeatureResponse,
    FeatureCluster
)
from ..llm_client import LLMClient
from ..clustering import cluster_features
from ..logging import with_correlation_id, log_timing

logger = logging.getLogger(__name__)

class FeatureService(IFeatureService):
    """Service for feature management operations.
    
    This service handles feature inspection, search, steering,
    and clustering operations.
    """
    
    def __init__(
        self, 
        client: AsyncClient, 
        variant_manager: IVariantManager,
        llm_client: LLMClient,
        settings: Settings
    ) -> None:
        """Initialize the feature service.
        
        Args:
            client: Ember API client
            variant_manager: Variant manager service
            llm_client: LLM client for analysis operations
            settings: Application settings
        """
        self.client = client
        self.variant_manager = variant_manager
        self.llm_client = llm_client
        self.settings = settings
        logger.info("Initialized FeatureService")
    
    @with_correlation_id()
    @log_timing(logger)
    async def inspect_features(
        self,
        messages: List[ChatMessage],
        session_id: str,
        variant_id: str
    ) -> List[FeatureActivation]:
        """Inspect feature activations in the current conversation."""
        try:
            logger.debug("Inspecting features", extra={
                "session_id": session_id,
                "variant_id": variant_id,
                "message_count": len(messages)
            })
            
            variant = await self.variant_manager.get_variant(session_id, variant_id)
            
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
            
            logger.debug("Feature inspection complete", extra={
                "session_id": session_id,
                "variant_id": variant_id,
                "activation_count": len(activations)
            })
            
            return activations
            
        except Exception as e:
            logger.error("Feature inspection failed", exc_info=True, extra={
                "session_id": session_id,
                "variant_id": variant_id,
                "error": str(e)
            })
            raise
    
    @with_correlation_id()
    @log_timing(logger)
    async def search_features(
        self,
        query: str,
        session_id: str,
        variant_id: str,
        top_k: Optional[int] = 20
    ) -> List[FeatureActivation]:
        """Search for features based on semantic similarity to a query."""
        try:
            logger.debug("Starting feature search", extra={
                "session_id": session_id,
                "variant_id": variant_id,
                "query": query,
                "top_k": top_k
            })
            
            variant = await self.variant_manager.get_variant(session_id, variant_id)
            
            # Use the SDK to search for features
            features = await self.client.features.search(
                query=query,
                model=variant,
                top_k=top_k
            )
            
            # Convert to FeatureActivation format
            result = []
            for feature in features:
                # For now, just use 0.0 as the activation value
                result.append(FeatureActivation(
                    label=feature.label,
                    activation=0.0
                ))
            
            logger.info("Feature search completed", extra={
                "session_id": session_id,
                "variant_id": variant_id,
                "query": query,
                "results_count": len(result)
            })
            
            return result
            
        except Exception as e:
            logger.error("Feature search failed", exc_info=True, extra={
                "session_id": session_id,
                "variant_id": variant_id,
                "query": query,
                "error": str(e)
            })
            raise
    
    @with_correlation_id()
    @log_timing(logger)
    async def steer_feature(
        self,
        session_id: str,
        variant_id: str,
        feature_label: str,
        value: float
    ) -> SteerFeatureResponse:
        """Apply steering to a specific feature."""
        try:
            logger.info("Steering feature", extra={
                "session_id": session_id,
                "variant_id": variant_id,
                "feature": feature_label,
                "value": value
            })
            
            variant = await self.variant_manager.get_variant(session_id, variant_id)
            
            # Search for the feature
            features = await self.client.features.search(
                feature_label,
                model=variant,
                top_k=1
            )
            
            if not features:
                logger.warning("Feature not found", extra={
                    "session_id": session_id,
                    "variant_id": variant_id,
                    "feature": feature_label
                })
                raise ValueError(f"Feature '{feature_label}' not found")
                
            feature = features[0]
            
            # Apply the steering
            variant.set(feature, value)
            logger.debug("Feature steering applied", extra={
                "session_id": session_id,
                "variant_id": variant_id,
                "feature": feature_label,
                "value": value
            })
            
            # Return response with the values we set
            return SteerFeatureResponse(
                label=feature_label,
                activation=value,
                modified_value=value
            )
            
        except Exception as e:
            logger.error("Feature steering failed", exc_info=True, extra={
                "session_id": session_id,
                "variant_id": variant_id,
                "feature": feature_label,
                "value": value,
                "error": str(e)
            })
            raise
    
    @with_correlation_id()
    @log_timing(logger)
    async def clear_feature(
        self,
        session_id: str,
        variant_id: str,
        feature_label: str
    ) -> ClearFeatureResponse:
        """Clear steering for a specific feature."""
        try:
            logger.info("Clearing feature", extra={
                "session_id": session_id,
                "variant_id": variant_id,
                "feature": feature_label
            })
            
            variant = await self.variant_manager.get_variant(session_id, variant_id)
            
            # Search for the feature
            features = await self.client.features.search(
                feature_label,
                model=variant,
                top_k=1
            )
            
            if not features:
                logger.warning("Feature not found for clearing", extra={
                    "session_id": session_id,
                    "variant_id": variant_id,
                    "feature": feature_label
                })
                raise ValueError(f"Feature '{feature_label}' not found")
                
            feature = features[0]
            
            # Clear the feature
            variant.clear(feature)
            logger.debug("Feature cleared", extra={
                "session_id": session_id,
                "variant_id": variant_id,
                "feature": feature_label
            })
            
            # Return response with the cleared feature label
            return ClearFeatureResponse(
                label=feature_label
            )
            
        except Exception as e:
            logger.error("Failed to clear feature", exc_info=True, extra={
                "session_id": session_id,
                "variant_id": variant_id,
                "feature": feature_label,
                "error": str(e)
            })
            raise
    
    async def cluster_features(
        self,
        features: List[FeatureActivation],
        session_id: str,
        force_refresh: bool = False,
        num_categories: int = 5
    ) -> List[FeatureCluster]:
        """Cluster features into logical groups."""
        try:
            logger.info(f"Starting feature clustering", extra={
                "session_id": session_id,
                "feature_count": len(features)
            })
            
            # Cluster the features
            clusters = await cluster_features(
                llm_client=self.llm_client,
                features=features,
                num_categories=num_categories,
                force_refresh=force_refresh
            )
            
            logger.info("Feature clustering completed", extra={
                "session_id": session_id,
                "cluster_count": len(clusters),
                "total_features": sum(len(c.features) for c in clusters)
            })
            
            return clusters
            
        except Exception as e:
            logger.error("Feature clustering failed", exc_info=True, extra={
                "session_id": session_id,
                "feature_count": len(features),
                "error": str(e)
            })
            # Fallback: return a single cluster with all features
            logger.warning("Using fallback: single cluster for all features", extra={
                "session_id": session_id,
                "feature_count": len(features)
            })
            return [FeatureCluster(
                name="All Features",
                features=features,
                type="dynamic"
            )] 