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
        logger.info("Received chat request with structure:", extra={
            "message_count": len(request.messages) if request.messages else 0,
            "messages": [{"role": m.role, "content": m.content[:50] + "..." if len(m.content) > 50 else m.content} 
                        for m in request.messages] if request.messages else []
        })
        
        # For now, use a simple session ID. Later we'll implement proper session management
        session_id = "default_session"  # TODO: Implement proper session management
        
        # First, analyze the query to determine optimal persona and features
        last_message = request.messages[-1] if request.messages else None
        logger.info("[TRACE] About to check if should run analyze_query", extra={
            "has_last_message": bool(last_message),
            "message_role": last_message.role if last_message else None
        })
        if last_message and last_message.role == "user":
            try:
                logger.info("[TRACE] Starting analyze_query call", extra={
                    "query": last_message.content,
                    "session_id": session_id,
                    "context_length": len(request.messages[:-1]) if len(request.messages) > 1 else 0
                })
                analysis = await ember_service.analyze_query(
                    query=last_message.content,
                    session_id=session_id,
                    context={"messages": request.messages[:-1]} if len(request.messages) > 1 else None
                )
                print("[DEBUG] Got analysis response:", analysis)  # Debug print
                print("[DEBUG] Analysis dict:", analysis.dict())  # Debug print
                logger.info("Query analysis results:", extra={
                    "persona": {
                        "role": analysis.persona.role,
                        "style": analysis.persona.style,
                        "approach": analysis.persona.approach
                    },
                    "feature_counts": {
                        "style": len(analysis.features.style),
                        "reasoning": len(analysis.features.reasoning),
                        "knowledge": len(analysis.features.knowledge)
                    },
                    "features": {
                        "style": [{"label": f.label, "importance": f.importance} for f in analysis.features.style],
                        "reasoning": [{"label": f.label, "importance": f.importance} for f in analysis.features.reasoning],
                        "knowledge": [{"label": f.label, "importance": f.importance} for f in analysis.features.knowledge]
                    }
                })
            except Exception as e:
                logger.error("Error during query analysis:", exc_info=True)
                # Continue with chat completion even if analysis fails
        
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