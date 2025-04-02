from typing import Dict, Optional
import logging
import uuid
from goodfire import Variant
from ..config import Settings
from .interfaces.variant_manager import IVariantManager
from ..logging import with_correlation_id, log_timing

logger = logging.getLogger(__name__)

class VariantManager(IVariantManager):
    """Manages variant creation, retrieval, and caching.
    
    This service handles all variant-related operations, maintaining
    a cache of variants by session and variant IDs.
    """
    
    def __init__(self, settings: Settings) -> None:
        """Initialize the variant manager.
        
        Args:
            settings: Application settings
        """
        self.settings = settings
        # Store variants by session_id -> variant_id -> variant
        self.variants: Dict[str, Dict[str, Variant]] = {}
        logger.info(f"Initialized VariantManager with default model: {settings.default_model}")
    
    @with_correlation_id()
    async def get_default_variant(self, session_id: str) -> Variant:
        """Get or create the default variant for a session."""
        if session_id not in self.variants:
            self.variants[session_id] = {}
        
        if "default" not in self.variants[session_id]:
            logger.debug("Creating default variant", extra={
                "session_id": session_id,
                "model": self.settings.default_model
            })
            self.variants[session_id]["default"] = Variant(self.settings.default_model)
        
        return self.variants[session_id]["default"]
    
    @with_correlation_id()
    async def create_variant(
        self, 
        session_id: str, 
        source_variant_id: Optional[str] = None,

    ) -> Variant:
        """Create a new variant, optionally based on an existing one."""
        # Determine variant ID (either "default" or generate a UUID)
        variant_id = str(uuid.uuid4())
            
        logger.info("Creating new variant", extra={
            "session_id": session_id,
            "variant_id": variant_id,
            "source_variant_id": source_variant_id,
        })
        
        if session_id not in self.variants:
            self.variants[session_id] = {}
            
        if source_variant_id:
            source = self.variants[session_id].get(source_variant_id)
            if not source:
                logger.error("Source variant not found", extra={
                    "session_id": session_id,
                    "source_variant_id": source_variant_id
                })
                raise ValueError(f"Source variant {source_variant_id} not found")
            
            # Create new variant with same settings as base
            source_variant_json = source.json()
            new_variant = Variant.from_json(source_variant_json)
        else:
            # Create fresh variant
            new_variant = Variant(self.settings.default_model)
            
        self.variants[session_id][variant_id] = new_variant
        logger.debug("Variant created successfully", extra={
            "session_id": session_id,
            "variant_id": variant_id,
            "model": new_variant.base_model
        })
        
        return new_variant
    
    @with_correlation_id()
    async def get_variant(
        self, 
        session_id: str, 
        variant_id: Optional[str] = None
    ) -> Variant:
        """Get a variant by session_id and variant_id."""
        variant_id = variant_id or "default"
        logger.debug("Getting variant", extra={
            "session_id": session_id,
            "variant_id": variant_id
        })
        
        try:
            # Check if we have this variant cached
            if session_id in self.variants and variant_id in self.variants[session_id]:
                logger.debug("Using cached variant", extra={
                    "session_id": session_id,
                    "variant_id": variant_id
                })
                return self.variants[session_id][variant_id]
            
            # Create a new variant
            logger.info("Creating new variant", extra={
                "session_id": session_id,
                "variant_id": variant_id
            })
            variant = await self.get_default_variant(session_id)
            
            # Cache the variant
            if session_id not in self.variants:
                self.variants[session_id] = {}
            self.variants[session_id][variant_id] = variant
            
            return variant
        except Exception as e:
            logger.error("Error getting variant", exc_info=True, extra={
                "session_id": session_id,
                "variant_id": variant_id,
                "error": str(e)
            })
            return await self.get_default_variant(session_id)
    
    @with_correlation_id()
    @log_timing(logger)
    async def get_variant_state(
        self, 
        session_id: str, 
        variant_id: Optional[str] = None
    ) -> Dict:
        """Get the complete state of a variant."""
        try:
            logger.debug("Getting variant state", extra={
                "session_id": session_id,
                "variant_id": variant_id
            })
            
            variant = await self.get_variant(session_id, variant_id)
            return variant.json()
            
        except Exception as e:
            logger.error("Failed to get variant state", exc_info=True, extra={
                "session_id": session_id,
                "variant_id": variant_id,
                "error": str(e)
            })
            raise 