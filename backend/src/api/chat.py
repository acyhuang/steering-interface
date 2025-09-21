from typing import AsyncGenerator
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from ..core.services import EmberService
from ..core.dependencies import get_ember_service
from ..models.chat import ChatRequest, ChatMessage, ChatResponse, ChatStreamChunk
import logging
import json

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/chat/completions")
async def create_chat_completion(
    request: ChatRequest,
    ember_service: EmberService = Depends(get_ember_service)
):
    """Create a chat completion with streaming-first approach and automatic fallback.
    
    Args:
        request: Chat completion request
        ember_service: Injected EmberService instance
        
    Returns:
        StreamingResponse for streaming mode or ChatResponse for non-streaming mode
        
    Raises:
        HTTPException: If the request fails
    """
    try:
        logger.info("Received chat request", extra={
            "message_count": len(request.messages) if request.messages else 0,
            "messages": [{"role": m.role, "content": m.content[:50] + "..." if len(m.content) > 50 else m.content} 
                        for m in request.messages] if request.messages else [],
            "auto_steer": request.auto_steer,
            "stream": request.stream
        })
        
        # For now, use a simple session ID. Later we'll implement proper session management
        session_id = "default_session"  # TODO: Implement proper session management
        
        # Try streaming first if requested
        if request.stream:
            try:
                logger.debug("Attempting streaming completion")
                
                # Create streaming generator
                async def generate_stream():
                    try:
                        completion_result = await ember_service.create_chat_completion(
                            messages=request.messages,
                            session_id=session_id,
                            variant_id=None,  # Use default variant
                            auto_steer=request.auto_steer,
                            stream=True,
                            max_completion_tokens=request.max_completion_tokens,
                            temperature=request.temperature,
                            top_p=request.top_p
                        )
                        
                        # The result should be an async generator for streaming
                        if hasattr(completion_result, '__aiter__'):
                            async for chunk in completion_result:
                                # Convert chunk to SSE format
                                chunk_json = chunk.model_dump_json()
                                yield f"data: {chunk_json}\n\n"
                        else:
                            # Fallback: convert regular response to streaming format
                            logger.warning("Expected streaming response but got regular response, converting")
                            yield f"data: {json.dumps({'type': 'chunk', 'delta': completion_result.content, 'variant_id': completion_result.variant_id})}\n\n"
                            yield f"data: {json.dumps({'type': 'done', 'variant_id': completion_result.variant_id})}\n\n"
                            
                    except Exception as e:
                        logger.error("Streaming generation failed", exc_info=True)
                        error_chunk = ChatStreamChunk(
                            type="error",
                            error=f"Streaming failed: {str(e)}"
                        )
                        yield f"data: {error_chunk.model_dump_json()}\n\n"
                
                return StreamingResponse(
                    generate_stream(),
                    media_type="text/plain",
                    headers={
                        "Cache-Control": "no-cache",
                        "Connection": "keep-alive",
                        "Content-Type": "text/plain; charset=utf-8"
                    }
                )
                
            except Exception as streaming_error:
                logger.warning("Streaming failed, falling back to regular completion", extra={
                    "error": str(streaming_error)
                })
                # Fall through to regular completion
        
        # Regular (non-streaming) completion
        logger.debug("Creating regular completion")
        response = await ember_service.create_chat_completion(
            messages=request.messages,
            session_id=session_id,
            variant_id=None,  # Use default variant
            auto_steer=request.auto_steer,
            stream=False,  # Force non-streaming
            max_completion_tokens=request.max_completion_tokens,
            temperature=request.temperature,
            top_p=request.top_p
        )
        
        # Ensure we return a ChatResponse for non-streaming
        if isinstance(response, ChatResponse):
            return response
        else:
            # This shouldn't happen, but handle it gracefully
            logger.error("Expected ChatResponse but got different type", extra={
                "response_type": type(response).__name__
            })
            raise HTTPException(status_code=500, detail="Unexpected response type from completion service")
        
    except Exception as e:
        logger.error("Error processing chat request", exc_info=True, extra={
            "error": str(e)
        })
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/health")
async def health_check():
    """Simple health check endpoint."""
    return {"status": "ok"} 