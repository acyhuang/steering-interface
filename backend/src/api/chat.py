from typing import AsyncGenerator
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
import goodfire
from goodfire import AsyncClient
import asyncio
from ..core.config import Settings, get_settings
from ..models.chat import ChatRequest, ChatMessage
import logging

router = APIRouter()

logger = logging.getLogger(__name__)

@router.post("/chat/completions")
async def create_chat_completion(
    request: ChatRequest,
    settings: Settings = Depends(get_settings)
) -> dict:
    # Initialize Goodfire client with validated key
    client = AsyncClient(settings.get_ember_api_key)
    
    try:
        logger.info(f"Received chat request: {request}")
        
        # Call the Goodfire API for a non-streaming response
        response = await client.chat.completions.create(
            messages=[{"role": msg.role, "content": msg.content} for msg in request.messages],
            model=request.model,
            stream=False,  # Set stream to False for non-streaming
            max_completion_tokens=request.max_completion_tokens,
            temperature=request.temperature,
            top_p=request.top_p
        )
        
        # Extract the content from the response
        content = response.choices[0].message["content"] if response.choices else ""
        
        return {"content": content}
        
    except Exception as e:
        logger.error(f"Error processing chat request: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e)) 