from pydantic import BaseModel
from typing import Literal

class ChatMessage(BaseModel):
    """Base model for chat messages shared between multiple modules.
    
    This model is placed in base_models to avoid circular import issues.
    """
    role: Literal["user", "assistant", "system"]
    content: str 