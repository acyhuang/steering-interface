from typing import Dict, List, Optional
from uuid import UUID
from pydantic import BaseModel

class Feature(BaseModel):
    """
    Feature with all state information for UI display.
    Combines SDK feature metadata with conversation analysis and user modifications.
    """
    uuid: str
    label: str
    index_in_sae: Optional[int] = None
    activation: Optional[float] = None
    modification: Optional[float] = 0
    pending_modification: Optional[float] = None

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