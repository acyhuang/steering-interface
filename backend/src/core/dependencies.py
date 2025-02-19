from typing import AsyncGenerator
from fastapi import Depends
from .config import Settings, get_settings
from .services import EmberService

# Create a single instance of EmberService
_ember_service: EmberService = None

def get_ember_service(settings: Settings = Depends(get_settings)) -> EmberService:
    """Get or create the singleton EmberService instance.
    
    Args:
        settings: Application settings from dependency injection
        
    Returns:
        Configured EmberService instance
    """
    global _ember_service
    if _ember_service is None:
        _ember_service = EmberService(settings)
    return _ember_service

async def get_ember_service_async(
    settings: Settings = Depends(get_settings)
) -> EmberService:
    """Dependency provider for EmberService.
    
    Args:
        settings: Application settings from dependency injection
        
    Returns:
        Configured EmberService instance
    """
    return EmberService(settings) 