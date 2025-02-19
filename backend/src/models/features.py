from pydantic import BaseModel

class FeatureActivation(BaseModel):
    """Model representing an activated feature and its strength.
    
    Attributes:
        label: Human-readable label for the feature
        activation: Activation strength value
    """
    label: str
    activation: float 