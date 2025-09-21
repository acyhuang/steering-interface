from typing import List, Optional, Union, AsyncGenerator
from abc import ABC, abstractmethod
from ....models.chat import ChatMessage, ChatResponse, ChatStreamChunk

class ICompletionService(ABC):
    """Interface for chat completion operations.
    
    The CompletionService handles generating text completions
    from the LLM based on user messages and variant configurations.
    """
    
    @abstractmethod
    async def create_chat_completion(
        self,
        messages: List[ChatMessage],
        session_id: str,
        variant_id: Optional[str] = None,
        auto_steer: bool = False,
        stream: bool = True,
        max_completion_tokens: Optional[int] = 512,
        temperature: Optional[float] = 0.7,
        top_p: Optional[float] = 0.9
    ) -> Union[ChatResponse, AsyncGenerator[ChatStreamChunk, None]]:
        """Create a chat completion using the configured LLM.
        
        Args:
            messages: List of chat messages for context
            session_id: Session identifier
            variant_id: Optional variant ID (defaults to "default")
            auto_steer: Whether to apply automatic steering based on query analysis
            stream: Whether to stream the response (defaults to True)
            max_completion_tokens: Maximum tokens to generate
            temperature: Temperature parameter for generation
            top_p: Top-p parameter for generation
            
        Returns:
            ChatResponse for non-streaming or AsyncGenerator[ChatStreamChunk] for streaming
        """
        pass 