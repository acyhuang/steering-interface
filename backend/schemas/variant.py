from typing import List, Dict, Optional
from pydantic import BaseModel
from .feature import UnifiedFeature

class VariantSummary(BaseModel):
    uuid: str
    label: str

class VariantCreateRequest(BaseModel):
    label: str
    base_model: Optional[str] = "meta-llama/Llama-3.1-70B-Instruct"

class VariantResponse(BaseModel):
    """
    Complete variant information including all feature modifications.
    Used when fetching variant details or after operations.
    """
    uuid: str
    label: str
    base_model: str
    modified_features: Dict[str, float]
    pending_features: Dict[str, float]

class VariantSwitchResponse(VariantResponse):
    """
    Response model for switching variants.
    Inherits all fields from VariantResponse.
    """
    pass

class VariantOperationResponse(BaseModel):
    """Simple success response for variant operations like commit/reject/clear"""
    success: bool

class FeatureSearchRequest(BaseModel):
    query: str
    top_k: int

class FeatureSearchResponse(BaseModel):
    features: List[UnifiedFeature]

class AutoSteerRequest(BaseModel):
    query: str
    current_variant_id: str
    conversation_context: Optional[List[str]]

class AutoSteerResponse(BaseModel):
    success: bool
    search_keywords: List[str] # Keywords used to search for features
    suggested_features: List[UnifiedFeature]
