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
    ClusteredFeaturesResponse
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

@router.post("/inspect", response_model=List[FeatureActivation])
async def inspect_features(
    request: InspectFeaturesRequest,
    ember_service: EmberService = Depends(get_ember_service)
) -> List[FeatureActivation]:
    """Inspect feature activations in the current conversation."""
    logger.info(f"(1 of 2) Received feature inspection request for session {request.session_id}")
    
    try:
        features = await ember_service.inspect_features(
            messages=request.messages,
            session_id=request.session_id,
            variant_id=request.variant_id
        )
        
        logger.info(f"(2 of 2) Successfully inspected features: found {len(features)} activations")
        return features
        
    except Exception as e:
        logger.error(f"Error during feature inspection: {str(e)}")
        raise

@router.post("/steer", response_model=SteerFeatureResponse)
async def steer_feature(
    request: SteerFeatureRequest,
    ember_service: EmberService = Depends(get_ember_service)
) -> SteerFeatureResponse:
    """Steer a feature's activation value."""
    logger.info(f"[API_DEBUG] steer_feature called with session_id={request.session_id}, variant_id={request.variant_id}")
    logger.info(f"Received steering request for feature {request.feature_label}")
    
    try:
        result = await ember_service.steer_feature(
            session_id=request.session_id,
            variant_id=request.variant_id,
            feature_label=request.feature_label,
            value=request.value
        )
        
        logger.info(f"Successfully steered feature {request.feature_label}")
        return result
        
    except Exception as e:
        logger.error(f"Error during feature steering: {str(e)}")
        raise

@router.get("/modified")
async def get_modified_features(
    session_id: str,
    variant_id: Optional[str] = None,
    ember_service: EmberService = Depends(get_ember_service)
) -> Dict:
    """Get raw variant JSON state"""
    logger.info(f"[API_DEBUG] get_modified_features called with session_id={session_id}, variant_id={variant_id}")
    return ember_service.get_modified_features(session_id, variant_id)

@router.post("/clear", response_model=ClearFeatureResponse)
async def clear_feature(
    request: ClearFeatureRequest,
    ember_service: EmberService = Depends(get_ember_service)
) -> ClearFeatureResponse:
    """Clear a feature's modifications from the variant."""
    logger.info(f"[API_DEBUG] clear_feature called with session_id={request.session_id}, variant_id={request.variant_id}")
    logger.info(f"Received clear request for feature {request.feature_label}")
    
    try:
        result = await ember_service.clear_feature(
            session_id=request.session_id,
            variant_id=request.variant_id,
            feature_label=request.feature_label
        )
        
        logger.info(f"Successfully cleared feature {request.feature_label}")
        return result
        
    except Exception as e:
        logger.error(f"Error during feature clearing: {str(e)}")
        raise

@router.post("/search", response_model=List[FeatureActivation])
async def search_features(
    request: SearchFeaturesRequest,
    ember_service: EmberService = Depends(get_ember_service)
) -> List[FeatureActivation]:
    """Search for features based on semantic similarity to a query string."""
    try:
        return await ember_service.search_features(
            query=request.query,
            session_id=request.session_id,
            variant_id=request.variant_id,
            top_k=request.top_k
        )
    except Exception as e:
        logger.error(f"Error searching features: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/cluster", response_model=ClusteredFeaturesResponse)
async def cluster_features(
    request: ClusterFeaturesRequest,
    ember_service: EmberService = Depends(get_ember_service)
) -> ClusteredFeaturesResponse:
    """Cluster features into logical groups."""
    try:
        clusters = await ember_service.cluster_features(
            features=request.features,
            session_id=request.session_id,
            variant_id=request.variant_id,
            force_refresh=request.force_refresh
        )
        
        return ClusteredFeaturesResponse(clusters=clusters)
    except Exception as e:
        logger.error(f"Error clustering features: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e)) 