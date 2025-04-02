from typing import Dict, Optional
from abc import ABC, abstractmethod
from goodfire import Variant

class IVariantManager(ABC):
    """Interface for variant management operations.
    
    The VariantManager handles the creation, retrieval, and caching
    of model variants across different sessions.
    """
    
    @abstractmethod
    async def get_default_variant(self, session_id: str) -> Variant:
        """Get or create the default variant for a session.
        
        Args:
            session_id: Unique session identifier
            
        Returns:
            The default variant for the session
        """
        pass
    
    @abstractmethod
    async def create_variant(
        self, 
        session_id: str, 
        source_variant_id: Optional[str] = None,

    ) -> Variant:
        """Create a new variant, optionally based on an existing one.
        
        Args:
            session_id: Session identifier
            base_variant_id: Optional base variant to clone from
            
        Returns:
            Newly created variant with a generated UUID identifier 
        """
        pass
    
    @abstractmethod
    async def get_variant(
        self, 
        session_id: str, 
        variant_id: Optional[str] = None
    ) -> Variant:
        """Get a variant by session_id and variant_id.
        
        Args:
            session_id: Session identifier
            variant_id: Optional variant ID (defaults to "default")
            
        Returns:
            Retrieved variant
        """
        pass
    
    @abstractmethod
    async def get_variant_state(
        self, 
        session_id: str, 
        variant_id: Optional[str] = None
    ) -> Dict:
        """Get the complete state of a variant.
        
        Args:
            session_id: Session identifier
            variant_id: Optional variant ID (defaults to "default")
            
        Returns:
            Complete variant configuration as a dictionary
        """
        pass 