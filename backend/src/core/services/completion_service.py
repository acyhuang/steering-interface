from typing import List, Optional
import logging
import json
from goodfire import AsyncClient
from ..config import Settings
from .interfaces.completion_service import ICompletionService
from .interfaces.variant_manager import IVariantManager
from ...models.chat import ChatMessage, ChatResponse
from ..logging import with_correlation_id, log_timing

logger = logging.getLogger(__name__)

class CompletionService(ICompletionService):
    """Service for generating chat completions.
    
    This service handles the generation of text completions
    from the LLM based on user messages and variant configurations.
    """
    
    def __init__(
        self, 
        client: AsyncClient, 
        variant_manager: IVariantManager, 
        settings: Settings
    ) -> None:
        """Initialize the completion service.
        
        Args:
            client: Ember API client
            variant_manager: Variant manager service
            settings: Application settings
        """
        self.client = client
        self.variant_manager = variant_manager
        self.settings = settings
        logger.info("Initialized CompletionService")
    
    @with_correlation_id()
    @log_timing(logger)
    async def create_chat_completion(
        self,
        messages: List[ChatMessage],
        session_id: str,
        variant_id: Optional[str] = None,
        stream: bool = False,
        max_completion_tokens: Optional[int] = 256,
        temperature: Optional[float] = 0.7,
        top_p: Optional[float] = 0.9
    ) -> ChatResponse:
        """Create a chat completion using the configured LLM."""
        try:
            logger.debug("Creating chat completion", extra={
                "session_id": session_id,
                "variant_id": variant_id,
                "message_count": len(messages)
            })
            
            # Get variant from variant manager
            variant = await self.variant_manager.get_variant(session_id, variant_id)
            
            # Log full variant state at DEBUG level
            logger.debug("Using variant configuration", extra={
                "session_id": session_id,
                "variant_id": variant_id,
                "variant_state": variant.json()
            })
            
            response = await self.client.chat.completions.create(
                messages=[{"role": msg.role, "content": msg.content} for msg in messages],
                model=variant,
                stream=stream,
                max_completion_tokens=max_completion_tokens or 512,
                temperature=temperature or 0.7,
                top_p=top_p or 0.9
            )
            
            content = response.choices[0].message["content"] if response.choices else ""
            
            logger.debug("Chat completion successful", extra={
                "session_id": session_id,
                "variant_id": variant_id,
                "content_length": len(content)
            })
            
            return ChatResponse(
                content=content,
                variant_id=variant_id or "default",
            )
            
        except Exception as e:
            logger.error("Chat completion failed", exc_info=True, extra={
                "session_id": session_id,
                "variant_id": variant_id,
                "error": str(e)
            })
            raise 