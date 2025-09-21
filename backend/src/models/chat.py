from typing import List, Literal, Optional, Union
from pydantic import BaseModel, Field
from .features import SteerFeatureResponse
from .base_models import ChatMessage

class AutoSteerResult(BaseModel):
    """Results from auto-steering, including original and steered content"""
    original_content: str
    steered_content: str
    applied_features: List[SteerFeatureResponse]

class ChatStreamChunk(BaseModel):
    """Individual chunk in a streaming response"""
    type: Literal["chunk", "done", "error"] = "chunk"
    content: Optional[str] = None
    delta: Optional[str] = None  # For incremental content
    variant_id: Optional[str] = None
    auto_steered: Optional[bool] = None
    auto_steer_result: Optional[AutoSteerResult] = None
    error: Optional[str] = None

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    variant_id: str
    auto_steer: bool = False
    stream: bool = True  # Default to streaming
    max_completion_tokens: int = 512
    temperature: float = 0.7
    top_p: float = 0.9

class ChatResponse(BaseModel):
    content: str
    variant_id: str
    auto_steered: bool = False
    auto_steer_result: Optional[AutoSteerResult] = None
    variant_json: Optional[str] = None  # Add missing field from existing usage