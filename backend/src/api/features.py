from fastapi import APIRouter, Depends
from typing import List, Optional, Dict
from ..models.chat import ChatMessage
from ..models.features import (
    FeatureActivation,
    SteerFeatureRequest,
    SteerFeatureResponse,
    ModifiedFeature,
    ClearFeatureRequest,
    ClearFeatureResponse,
    FeatureCluster,
    ClusterFeaturesRequest,
    ClusteredFeaturesResponse,
    QueryAnalysisRequest,
    QueryAnalysisResponse,
    AutoSteerRequest,
    AutoSteerResponse
)
from ..core.services import EmberService
from ..core.dependencies import get_ember_service
from ..core.config import get_settings
from pydantic import BaseModel
import logging
from fastapi import HTTPException

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/features")

class InspectFeaturesRequest(BaseModel):
    messages: List[ChatMessage]
    session_id: str
    variant_id: Optional[str] = None

class SearchFeaturesRequest(BaseModel):
    query: str
    session_id: str
    variant_id: Optional[str] = None
    top_k: Optional[int] = 20

class CreateVariantRequest(BaseModel):
    """Model for variant creation requests."""
    session_id: str
    base_variant_id: Optional[str] = None

class CreateVariantResponse(BaseModel):
    """Model for variant creation responses."""
    variant_id: str
    model: str

@router.post("/inspect", response_model=List[FeatureActivation])
async def inspect_features(
    request: InspectFeaturesRequest,
    ember_service: EmberService = Depends(get_ember_service)
) -> List[FeatureActivation]:
    """Inspect feature activations in the current conversation."""    
    try:
        logger.debug("Received feature inspection request", extra={
            "session_id": request.session_id,
            "message_count": len(request.messages)
        })
        
        features = await ember_service.inspect_features(
            messages=request.messages,
            session_id=request.session_id,
            variant_id=request.variant_id
        )
        
        return features
        
    except Exception as e:
        logger.error("Feature inspection request failed", extra={
            "session_id": request.session_id,
            "error": str(e)
        })
        raise

@router.post("/steer", response_model=SteerFeatureResponse)
async def steer_feature(
    request: SteerFeatureRequest,
    ember_service: EmberService = Depends(get_ember_service)
) -> SteerFeatureResponse:
    """Steer a feature's activation value."""
    try:
        logger.debug("Received feature steering request", extra={
            "session_id": request.session_id,
            "variant_id": request.variant_id,
            "feature_label": request.feature_label
        })
        
        result = await ember_service.steer_feature(
            session_id=request.session_id,
            variant_id=request.variant_id,
            feature_label=request.feature_label,
            value=request.value
        )
        
        return result
        
    except Exception as e:
        logger.error("Feature steering request failed", extra={
            "session_id": request.session_id,
            "variant_id": request.variant_id,
            "feature_label": request.feature_label,
            "error": str(e)
        })
        raise

@router.get("/modified")
async def get_modified_features(
    session_id: str,
    variant_id: Optional[str] = None,
    ember_service: EmberService = Depends(get_ember_service)
) -> Dict:
    """Get raw variant JSON state"""
    logger.debug("Received modified features request", extra={
        "session_id": session_id,
        "variant_id": variant_id
    })
    return await ember_service.get_modified_features(session_id, variant_id)

@router.post("/clear", response_model=ClearFeatureResponse)
async def clear_feature(
    request: ClearFeatureRequest,
    ember_service: EmberService = Depends(get_ember_service)
) -> ClearFeatureResponse:
    """Clear a feature's modifications from the variant."""
    try:
        logger.debug("Received feature clearing request", extra={
            "session_id": request.session_id,
            "variant_id": request.variant_id,
            "feature_label": request.feature_label
        })
        
        result = await ember_service.clear_feature(
            session_id=request.session_id,
            variant_id=request.variant_id,
            feature_label=request.feature_label
        )
        
        return result
        
    except Exception as e:
        logger.error("Feature clearing request failed", extra={
            "session_id": request.session_id,
            "variant_id": request.variant_id,
            "feature_label": request.feature_label,
            "error": str(e)
        })
        raise

@router.post("/search", response_model=List[FeatureActivation])
async def search_features(
    request: SearchFeaturesRequest,
    ember_service: EmberService = Depends(get_ember_service)
) -> List[FeatureActivation]:
    """Search for features based on semantic similarity to a query string."""
    try:
        logger.debug("Received feature search request", extra={
            "session_id": request.session_id,
            "variant_id": request.variant_id,
            "query": request.query,
            "top_k": request.top_k
        })
        
        return await ember_service.search_features(
            query=request.query,
            session_id=request.session_id,
            variant_id=request.variant_id,
            top_k=request.top_k
        )
    except Exception as e:
        logger.error("Feature search request failed", extra={
            "session_id": request.session_id,
            "variant_id": request.variant_id,
            "query": request.query,
            "error": str(e)
        })
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/cluster", response_model=ClusteredFeaturesResponse)
async def cluster_features(
    request: ClusterFeaturesRequest,
    ember_service: EmberService = Depends(get_ember_service)
) -> ClusteredFeaturesResponse:
    """Cluster features into logical groups."""
    try:
        logger.debug("Received feature clustering request", extra={
            "session_id": request.session_id,
            "variant_id": request.variant_id,
            "feature_count": len(request.features),
            "force_refresh": request.force_refresh
        })
        
        clusters = await ember_service.cluster_features(
            features=request.features,
            session_id=request.session_id,
            variant_id=request.variant_id,
            force_refresh=request.force_refresh
        )
        
        return ClusteredFeaturesResponse(clusters=clusters)
    except Exception as e:
        logger.error("Feature clustering request failed", extra={
            "session_id": request.session_id,
            "variant_id": request.variant_id,
            "feature_count": len(request.features),
            "error": str(e)
        })
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/analyze-query", response_model=QueryAnalysisResponse)
async def analyze_query(
    request: QueryAnalysisRequest,
    ember_service: EmberService = Depends(get_ember_service)
) -> QueryAnalysisResponse:
    """Analyze a user query to determine optimal persona and feature categories."""
    try:
        logger.debug("Received query analysis request", extra={
            "session_id": request.session_id,
            "variant_id": request.variant_id,
            "query_length": len(request.query)
        })
        
        analysis = await ember_service.analyze_query(
            query=request.query,
            session_id=request.session_id,
            variant_id=request.variant_id,
            context=request.context
        )
        
        return analysis
        
    except Exception as e:
        logger.error("Query analysis request failed", extra={
            "session_id": request.session_id,
            "variant_id": request.variant_id,
            "error": str(e)
        })
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/auto-steer", response_model=AutoSteerResponse)
async def auto_steer(
    request: AutoSteerRequest,
    ember_service: EmberService = Depends(get_ember_service)
) -> AutoSteerResponse:
    """Automatically apply feature steering based on query analysis."""
    try:
        logger.debug("Received auto-steer request", extra={
            "session_id": request.session_id,
            "variant_id": request.variant_id,
            "max_features": request.max_features
        })
        
        result = await ember_service.auto_steer(
            analysis=request.analysis,
            session_id=request.session_id,
            variant_id=request.variant_id,
            max_features=request.max_features
        )
        
        return result
        
    except Exception as e:
        logger.error("Auto-steering request failed", extra={
            "session_id": request.session_id,
            "variant_id": request.variant_id,
            "error": str(e)
        })
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/variants", response_model=CreateVariantResponse)
async def create_variant(
    request: CreateVariantRequest,
    ember_service: EmberService = Depends(get_ember_service)
) -> CreateVariantResponse:
    """Create a new variant, optionally based on an existing one.
    
    A UUID will be generated automatically.
    """
    try:
        logger.debug("Received variant creation request", extra={
            "session_id": request.session_id,
            "base_variant_id": request.base_variant_id
        })
        
        variant = await ember_service.create_variant(
            session_id=request.session_id,
            base_variant_id=request.base_variant_id,
        )
        
        # Determine variant ID (UUID)
        variant_id = str(variant).split('/')[-1]
        
        logger.debug("Variant created successfully", extra={
            "session_id": request.session_id,
            "variant_id": variant_id
        })
        
        return CreateVariantResponse(
            variant_id=variant_id,
            model=variant.model_name
        )
        
    except Exception as e:
        logger.error("Variant creation request failed", extra={
            "session_id": request.session_id,
            "base_variant_id": request.base_variant_id,
            "error": str(e)
        })
        raise HTTPException(status_code=500, detail=str(e)) 