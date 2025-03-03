from pydantic import BaseModel
from typing import Optional, List, Literal

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

class ClearFeatureRequest(BaseModel):
    """Model for feature clearing requests."""
    session_id: str
    variant_id: Optional[str] = None
    feature_label: str

class ClearFeatureResponse(BaseModel):
    """Response model for feature clearing.
    
    Attributes:
        label: Feature label that was cleared
    """
    label: str

# New models for feature clustering

class FeatureCluster(BaseModel):
    """Model representing a cluster of features.
    
    Attributes:
        name: Name of the cluster
        features: List of features in the cluster
        type: Type of cluster (predefined or dynamic)
    """
    name: str
    features: List[FeatureActivation]
    type: Literal["predefined", "dynamic"]

class ClusterFeaturesRequest(BaseModel):
    """Model for feature clustering requests.
    
    Attributes:
        features: List of features to cluster
        session_id: Session ID
        variant_id: Optional variant ID
        force_refresh: Whether to force a refresh of cached results
    """
    features: List[FeatureActivation]
    session_id: str
    variant_id: Optional[str] = None
    force_refresh: bool = False

class ClusteredFeaturesResponse(BaseModel):
    """Response model for feature clustering.
    
    Attributes:
        clusters: List of feature clusters
    """
    clusters: List[FeatureCluster] 