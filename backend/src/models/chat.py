from typing import List, Literal, Optional
from pydantic import BaseModel, Field

class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    model: str = Field(default="meta-llama/Llama-3.3-70B-Instruct")
    stream: bool = Field(default=True)
    max_completion_tokens: Optional[int] = Field(default=512)
    temperature: Optional[float] = Field(default=0.6)
    top_p: Optional[float] = Field(default=0.9)

class ChatResponse(BaseModel):
    content: str 