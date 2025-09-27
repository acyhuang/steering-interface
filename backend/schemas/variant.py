from typing import List, Dict, Optional
from pydantic import BaseModel

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