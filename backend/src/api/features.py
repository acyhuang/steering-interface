from fastapi import APIRouter, Depends
from typing import List, Optional
from ..models.chat import ChatMessage
from ..models.features import FeatureActivation
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