"""
FastAPI dependency injection functions.

This module provides dependency functions for injecting shared resources
into route handlers and services.
"""
import logging
from fastapi import Request
from goodfire import AsyncClient

logger = logging.getLogger(__name__)


def get_ember_client(request: Request) -> AsyncClient:
    """
    Get the Ember SDK AsyncClient from application state.
    
    The client is initialized once during application startup
    and reused for all requests (singleton pattern).
    
    Args:
        request: FastAPI request object containing app state
        
    Returns:
        AsyncClient: Configured Ember SDK client
        
    Raises:
        AttributeError: If ember_client is not initialized in app state
    """
    if not hasattr(request.app.state, 'ember_client'):
        logger.error("Ember client not found in app state - ensure startup event ran")
        raise AttributeError("Ember client not initialized")
    
    return request.app.state.ember_client
