from typing import List, Optional
from abc import ABC, abstractmethod
from ....models.chat import ChatMessage, ChatResponse

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
        stream: bool = False,
        max_completion_tokens: Optional[int] = 512,
        temperature: Optional[float] = 0.7,
        top_p: Optional[float] = 0.9
    ) -> ChatResponse:
        """Create a chat completion using the configured LLM.
        
        Args:
            messages: List of chat messages for context
            session_id: Session identifier
            variant_id: Optional variant ID (defaults to "default")
            stream: Whether to stream the response
            max_completion_tokens: Maximum tokens to generate
            temperature: Temperature parameter for generation
            top_p: Top-p parameter for generation
            
        Returns:
            ChatResponse containing the generated text
        """
        pass 