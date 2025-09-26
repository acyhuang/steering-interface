from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

from .variant import VariantSummary

class ConversationCreateRequest(BaseModel):
    variant_id: Optional[str] = None

class ConversationCreateResponse(BaseModel):
    uuid: str
    current_variant: VariantSummary
    created_at: datetime

class ConversationResponse(BaseModel):
    uuid: str
    current_variant: VariantSummary
    features: List[Feature]