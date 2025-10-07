from typing import Dict, List, Optional
from uuid import UUID
from pydantic import BaseModel

class VariantSteerRequest(BaseModel):
    """Request to give feature a pending modification"""
    value: float 

class VariantSteerResponse(BaseModel):
    """Response after proposing a feature modification"""
    success: bool
    feature_uuid: str
    pending_modification: float

class UnifiedFeature(BaseModel):
    """
    Unified feature representation combining Ember SDK data with modifications.
    Used for API responses showing complete feature state.
    """
    uuid: str
    label: str
    activation: Optional[float] = None
    modification: Optional[float] = 0.0
    pending_modification: Optional[float] = None