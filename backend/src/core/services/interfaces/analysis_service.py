from typing import List, Optional, Dict
from abc import ABC, abstractmethod
from ....models.chat import ChatMessage
from ....models.features import (
    QueryAnalysisResponse,
    SteerFeatureResponse
)

class IAnalysisService(ABC):
    """Interface for query analysis operations.
    
    The AnalysisService handles analyzing user queries to determine
    optimal personas and feature configurations.
    """
    
    @abstractmethod
    async def analyze_query(
        self,
        query: str,
        session_id: str,
        variant_id: Optional[str] = None,
        context: Optional[Dict[str, List[ChatMessage]]] = None
    ) -> QueryAnalysisResponse:
        """Analyze a user query to determine optimal persona and feature categories.
        
        Args:
            query: User query to analyze
            session_id: Session identifier
            variant_id: Optional variant ID
            context: Optional conversation context
            
        Returns:
            Analysis of the query with persona and feature recommendations
        """
        pass
    
    @abstractmethod
    async def auto_steer(
        self,
        analysis: QueryAnalysisResponse,
        session_id: str,
        variant_id: Optional[str] = None
    ) -> List[SteerFeatureResponse]:
        """Automatically steer features based on query analysis.
        
        Args:
            analysis: Query analysis results
            session_id: Session identifier
            variant_id: Optional variant ID
            
        Returns:
            List of successfully steered features
        """
        pass 