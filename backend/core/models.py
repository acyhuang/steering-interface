from typing import Dict, List, Optional
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel


class Conversation(BaseModel):
    uuid: str
    current_variant: Variant
    detected_features: List[Feature]
    
class Feature(BaseModel):
    uuid: str
    label: str
    index_in_sae: int

class Variant(BaseModel):
    uuid: str
    label: str
    modified_features: Dict[str, float]
    pending_features: Dict[str, float]

