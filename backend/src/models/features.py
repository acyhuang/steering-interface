from pydantic import BaseModel
from typing import Optional, List, Literal, Dict
from ..models.chat import ChatMessage

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
    variant_id: str
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
    variant_id: str
    feature_label: str

class ClearFeatureResponse(BaseModel):
    """Response model for feature clearing.
    
    Attributes:
        label: Feature label that was cleared
    """
    label: str

# New models for feature clustering

class FeatureCluster(BaseModel):
    """Model for a cluster of features.
    
    Attributes:
        name: Name of the cluster
        features: List of features in the cluster
    """
    name: str
    features: List[FeatureActivation]

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
    variant_id: str
    force_refresh: bool = False

class ClusteredFeaturesResponse(BaseModel):
    """Response model for feature clustering.
    
    Attributes:
        clusters: List of feature clusters
    """
    clusters: List[FeatureCluster]

class PersonaAnalysis(BaseModel):
    """Model for persona analysis results.
    
    Attributes:
        role: The role the assistant should take (e.g., "writing coach")
        style: Description of communication style
        approach: Description of problem-solving approach
    """
    role: str
    style: str
    approach: str

class FeatureImportance(BaseModel):
    """Model for a feature with its importance score.
    
    Attributes:
        label: Feature identifier
        importance: Importance score (0-1)
    """
    label: str
    importance: float

class FeatureAnalysis(BaseModel):
    """Model for feature analysis results.
    
    Attributes:
        style: Writing style features
        reasoning: Reasoning method features
        knowledge: Knowledge domain features
    """
    style: List[FeatureImportance]
    reasoning: List[FeatureImportance]
    knowledge: List[FeatureImportance]

class QueryAnalysisRequest(BaseModel):
    """Model for query analysis requests.
    
    Attributes:
        query: User's query
        session_id: Session ID
        variant_id: Optional variant ID
        context: Optional conversation context
    """
    query: str
    session_id: str
    variant_id: str
    context: Optional[Dict[str, List[ChatMessage]]] = None

class QueryAnalysisResponse(BaseModel):
    """Model for query analysis responses.
    
    Attributes:
        persona: Persona analysis results
        features: Feature analysis results
    """
    persona: PersonaAnalysis
    features: FeatureAnalysis

class AppliedFeature(BaseModel):
    """Model for an applied feature modification.
    
    Attributes:
        label: Feature identifier
        value: Applied steering value
        category: Feature category
    """
    label: str
    value: float
    category: str

class AutoSteerRequest(BaseModel):
    """Model for auto-steering requests.
    
    Attributes:
        analysis: Output from analyze-query
        session_id: Session ID
        variant_id: Optional variant ID
        max_features: Optional maximum features to steer per category
    """
    analysis: QueryAnalysisResponse
    session_id: str
    variant_id: str
    max_features: Optional[int] = 5

class AutoSteerResponse(BaseModel):
    """Model for auto-steering responses.
    
    Attributes:
        applied_features: List of applied feature modifications
        variant_id: ID of modified variant
        variant_json: Complete variant configuration
    """
    applied_features: List[AppliedFeature]
    variant_id: str
    variant_json: str 