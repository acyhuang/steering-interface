from typing import AsyncGenerator
from fastapi import Depends
from .config import Settings, get_settings
from .services import EmberService

async def get_ember_service(
    settings: Settings = Depends(get_settings)
) -> EmberService:
    """Dependency provider for EmberService.
    
    Args:
        settings: Application settings from dependency injection
        
    Returns:
        Configured EmberService instance
    """
    return EmberService(settings) 