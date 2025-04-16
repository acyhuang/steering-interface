from typing import List, Literal, Optional
from pydantic import BaseModel, Field
from .features import SteerFeatureResponse
from .base_models import ChatMessage

class AutoSteerResult(BaseModel):
    """Results from auto-steering, including original and steered content"""
    original_content: str
    steered_content: str
    applied_features: List[SteerFeatureResponse]

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    variant_id: str
    auto_steer: bool = False
    max_completion_tokens: int = 512
    temperature: float = 0.7
    top_p: float = 0.9

class ChatResponse(BaseModel):
    content: str
    variant_id: str
    auto_steered: bool = False
    auto_steer_result: Optional[AutoSteerResult] = None