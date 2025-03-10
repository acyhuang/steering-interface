from typing import AsyncGenerator
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from ..core.services import EmberService
from ..core.dependencies import get_ember_service
from ..models.chat import ChatRequest, ChatMessage, ChatResponse
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/chat/completions")
async def create_chat_completion(
    request: ChatRequest,
    ember_service: EmberService = Depends(get_ember_service)
) -> ChatResponse:
    """Create a chat completion.
    
    Args:
        request: Chat completion request
        ember_service: Injected EmberService instance
        
    Returns:
        ChatResponse containing the model's response
        
    Raises:
        HTTPException: If the request fails
    """
    try:
        logger.info(f"Received chat request")
        # logger.info(f"Received chat request: {request}")
        
        # For now, use a simple session ID. Later we'll implement proper session management
        session_id = "default_session"  # TODO: Implement proper session management
        
        response = await ember_service.create_chat_completion(
            messages=request.messages,
            session_id=session_id,
            variant_id=None,  # Use default variant
            max_completion_tokens=request.max_completion_tokens,
            temperature=request.temperature,
            top_p=request.top_p
        )
        
        return response
        
    except Exception as e:
        logger.error(f"Error processing chat request: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/health")
async def health_check():
    """Simple health check endpoint."""
    return {"status": "ok"} 