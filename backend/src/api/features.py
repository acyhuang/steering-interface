from fastapi import APIRouter, Depends
from typing import List, Optional, Dict
from ..models.chat import ChatMessage
from ..models.features import FeatureActivation, SteerFeatureRequest, SteerFeatureResponse, ModifiedFeature
from ..core.services import EmberService
from ..core.dependencies import get_ember_service
from ..core.config import get_settings
from pydantic import BaseModel
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/features")

class InspectFeaturesRequest(BaseModel):
    messages: List[ChatMessage]
    session_id: str
    variant_id: Optional[str] = None

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