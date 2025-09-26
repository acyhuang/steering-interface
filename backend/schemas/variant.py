from typing import List, Dict, Optional
from pydantic import BaseModel

class VariantCreateRequest(BaseModel):
    label: str

class VariantCreateResponse(BaseModel):
    uuid: str
    label: str
    modified_features: Dict[str, float]
    pending_features: Dict[str, float]

class VariantResponse(BaseModel):
    uuid: str
    label: str
    modified_features: Dict[str, float]
    pending_features: Dict[str, float]

class VariantSummary(BaseModel):
    uuid: str
    label: str