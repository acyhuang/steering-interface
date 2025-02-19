from pydantic import BaseModel
from typing import Optional

class FeatureActivation(BaseModel):
    """Model representing an activated feature and its strength.
    
    Attributes:
        label: Human-readable label for the feature
        activation: Activation strength value
    """
    label: str
    activation: float

class SteerFeatureRequest(BaseModel):
    """Model for feature steering requests."""
    session_id: str
    variant_id: Optional[str] = None
    feature_label: str
    value: float

class SteerFeatureResponse(BaseModel):
    """Response model for feature steering.
    
    Attributes:
        label: Feature label
        activation: Current activation value
        modified_value: The steering value that was applied
    """
    label: str
    activation: float
    modified_value: float

class ModifiedFeature(BaseModel):
    label: str
    value: float 