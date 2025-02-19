from typing import AsyncGenerator, List, Optional
from goodfire import AsyncClient
from ..models.chat import ChatMessage, ChatRequest, ChatResponse
import logging
from .config import Settings

logger = logging.getLogger(__name__)

class EmberService:
    """Service for interacting with the Ember API.
    
    This service manages a singleton client instance and provides methods
    for all Ember API operations including chat, feature steering, and
    configuration management.
    """
    
    def __init__(self, settings: Settings) -> None:
        """Initialize the Ember service with configuration.
        
        Args:
            settings: Application settings including API keys
        """
        self.client = AsyncClient(settings.get_ember_api_key)
        self.settings = settings
        logger.info("EmberService initialized")
    
    async def create_chat_completion(
        self,
        messages: List[ChatMessage],
        model: Optional[str] = None,
        stream: bool = False,
        max_completion_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
        top_p: Optional[float] = None
    ) -> ChatResponse:
        """Create a chat completion using the Ember API.
        
        Args:
            messages: List of chat messages
            model: Model to use for completion
            stream: Whether to stream the response
            max_completion_tokens: Maximum tokens in completion
            temperature: Sampling temperature
            top_p: Nucleus sampling parameter
            
        Returns:
            ChatResponse containing the model's response
            
        Raises:
            Exception: If the API call fails
        """
        try:
            logger.info(f"Creating chat completion with {len(messages)} messages")
            
            response = await self.client.chat.completions.create(
                messages=[{"role": msg.role, "content": msg.content} for msg in messages],
                model=model,
                stream=stream,
                max_completion_tokens=max_completion_tokens,
                temperature=temperature,
                top_p=top_p
            )
            
            content = response.choices[0].message["content"] if response.choices else ""
            logger.debug(f"Received response: {content[:100]}...")
            
            return ChatResponse(content=content)
            
        except Exception as e:
            logger.error(f"Error in create_chat_completion: {str(e)}")
            raise 