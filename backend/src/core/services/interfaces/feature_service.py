from typing import List, Optional, Dict
from abc import ABC, abstractmethod
from ....models.chat import ChatMessage
from ....models.features import (
    FeatureActivation, 
    SteerFeatureResponse, 
    ClearFeatureResponse,
    FeatureCluster
)

class IFeatureService(ABC):
    """Interface for feature management operations.
    
    The FeatureService handles feature inspection, search, steering,
    and clustering operations.
    """
    
    @abstractmethod
    async def inspect_features(
        self,
        messages: List[ChatMessage],
        session_id: str,
        variant_id: str
    ) -> List[FeatureActivation]:
        """Inspect feature activations in the current conversation.
        
        Args:
            messages: List of chat messages to inspect
            session_id: Session identifier
            variant_id: Variant ID
            
        Returns:
            List of feature activations
        """
        pass
    
    @abstractmethod
    async def search_features(
        self,
        query: str,
        session_id: str,
        variant_id: str,
        top_k: Optional[int] = 20
    ) -> List[FeatureActivation]:
        """Search for features based on semantic similarity to a query.
        
        Args:
            query: Search query
            session_id: Session identifier
            variant_id: Variant ID
            top_k: Maximum number of results to return
            
        Returns:
            List of matching features
        """
        pass
    
    @abstractmethod
    async def steer_feature(
        self,
        session_id: str,
        variant_id: str,
        feature_label: str,
        value: float
    ) -> SteerFeatureResponse:
        """Apply steering to a specific feature.
        
        Args:
            session_id: Session identifier
            variant_id: Variant ID
            feature_label: Label of the feature to steer
            value: Steering value to apply
            
        Returns:
            Response with details of the steered feature
        """
        pass
    
    @abstractmethod
    async def clear_feature(
        self,
        session_id: str,
        variant_id: str,
        feature_label: str
    ) -> ClearFeatureResponse:
        """Clear steering for a specific feature.
        
        Args:
            session_id: Session identifier
            variant_id: Variant ID
            feature_label: Label of the feature to clear
            
        Returns:
            Response confirming the cleared feature
        """
        pass
    
    @abstractmethod
    async def cluster_features(
        self,
        features: List[FeatureActivation],
        session_id: str,
        force_refresh: bool = False,
        num_categories: int = 5
    ) -> List[FeatureCluster]:
        """Cluster features into logical groups.
        
        Args:
            features: List of features to cluster
            session_id: Session identifier
            force_refresh: Whether to force a refresh of clusters
            num_categories: Number of categories to create
            
        Returns:
            List of feature clusters
        """
        pass 