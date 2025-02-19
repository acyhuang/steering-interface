from typing import List, Literal, Optional
from pydantic import BaseModel, Field

class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    variant_id: Optional[str] = None
    max_completion_tokens: int = 512
    temperature: float = 0.7
    top_p: float = 0.9

class ChatResponse(BaseModel):
    content: str
    variant_id: str
    variant_json: Optional[str] = None 