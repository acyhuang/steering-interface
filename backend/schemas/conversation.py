from typing import List, Optional, Literal
from datetime import datetime
from pydantic import BaseModel

from .variant import VariantSummary
from .feature import Feature

class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str

class ConversationCreateRequest(BaseModel):
    """Request to create a new conversation, optionally with a specific variant"""
    variant_id: Optional[str] = None

class ConversationCreateResponse(BaseModel):
    """Response after creating a new conversation"""
    uuid: str
    current_variant: VariantSummary
    created_at: datetime

class ConversationResponse(BaseModel):
    """
    Full conversation data including current variant and all features.
    Features include detected levels from conversation analysis.
    """
    uuid: str
    current_variant: VariantSummary
    features: List[Feature]

class ConversationMessageRequest(BaseModel):
    """Request to send a message in the conversation"""
    messages: List[ChatMessage]
    stream: bool

class ConversationMessageResponse(BaseModel):
    """Response after sending a message in the conversation"""
    message: ChatMessage