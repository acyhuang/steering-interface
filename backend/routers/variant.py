import logging
from fastapi import APIRouter, Depends, HTTPException
from goodfire import AsyncClient

from ..dependencies import get_ember_client
from ..services.variant_service import VariantService
from ..schemas.variant import VariantCreateRequest, VariantResponse, VariantOperationResponse, FeatureSearchRequest, FeatureSearchResponse, AutoSteerRequest, AutoSteerResponse
from ..schemas.feature import VariantSteerRequest, VariantSteerResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/variants", tags=["variants"])


def get_variant_service() -> VariantService:
    """Dependency injection for VariantService."""
    return VariantService()




@router.post("/", response_model=VariantResponse)
async def create_variant(
    request: VariantCreateRequest,
    ember_client: AsyncClient = Depends(get_ember_client),
    variant_service: VariantService = Depends(get_variant_service)
) -> VariantResponse:
    """
    Create a new variant.
    
    v2.0: Returns hardcoded demo variant for MVP testing.
    
    Args:
        request: Variant creation parameters
        ember_client: Ember SDK client
        variant_service: Injected variant service
        
    Returns:
        VariantResponse: Created variant details
        
    Raises:
        HTTPException: For validation or service errors
    """
    logger.info(f"POST /variants - Creating variant with label: {request.label}")
    
    try:
        response = variant_service.create_variant(request, ember_client)
        logger.info(f"Successfully created variant {response.uuid}")
        return response
        
    except Exception as e:
        logger.error(f"Error creating variant: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create variant: {str(e)}"
        )


@router.post("/{variant_id}/features/{feature_uuid}/steer", response_model=VariantSteerResponse)
async def steer_feature(
    variant_id: str,
    feature_uuid: str,
    request: VariantSteerRequest,
    ember_client: AsyncClient = Depends(get_ember_client),
    variant_service: VariantService = Depends(get_variant_service)
) -> VariantSteerResponse:
    """
    Apply a pending modification to a feature in a variant.
    
    Args:
        variant_id: UUID of the variant to modify
        feature_uuid: UUID of the feature to steer
        request: Steering request with modification value
        ember_client: Ember SDK client
        variant_service: Injected variant service
        
    Returns:
        VariantSteerResponse: Steering operation result
        
    Raises:
        HTTPException: For validation or service errors
    """
    logger.info(f"POST /variants/{variant_id}/features/{feature_uuid}/steer - value: {request.value}")
    
    try:
        response = await variant_service.steer_feature(
            variant_id=variant_id,
            feature_uuid=feature_uuid,
            request=request,
            ember_client=ember_client
        )
        logger.info(f"Successfully steered feature {feature_uuid} to {request.value}")
        return response
        
    except ValueError as e:
        logger.warning(f"Validation error steering feature: {str(e)}")
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error steering feature: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to steer feature: {str(e)}"
        )


@router.post("/{variant_id}/commit-changes", response_model=VariantOperationResponse)
async def commit_changes(
    variant_id: str,
    ember_client: AsyncClient = Depends(get_ember_client),
    variant_service: VariantService = Depends(get_variant_service)
) -> VariantOperationResponse:
    """
    Commit all pending modifications to confirmed modifications.
    
    Args:
        variant_id: UUID of the variant to commit changes for
        ember_client: Ember SDK client
        variant_service: Injected variant service
        
    Returns:
        VariantOperationResponse: Operation result
        
    Raises:
        HTTPException: For validation or service errors
    """
    logger.info(f"POST /variants/{variant_id}/commit-changes")
    
    try:
        response = await variant_service.commit_changes(
            variant_id=variant_id,
            ember_client=ember_client
        )
        logger.info(f"Successfully committed changes for variant {variant_id}")
        return response
        
    except ValueError as e:
        logger.warning(f"Validation error committing changes: {str(e)}")
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error committing changes: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to commit changes: {str(e)}"
        )


@router.post("/{variant_id}/reject-changes", response_model=VariantOperationResponse)
async def reject_changes(
    variant_id: str,
    variant_service: VariantService = Depends(get_variant_service)
) -> VariantOperationResponse:
    """
    Reject all pending modifications without applying them.
    
    Args:
        variant_id: UUID of the variant to reject changes for
        variant_service: Injected variant service
        
    Returns:
        VariantOperationResponse: Operation result
        
    Raises:
        HTTPException: For validation or service errors
    """
    logger.info(f"POST /variants/{variant_id}/reject-changes")
    
    try:
        response = await variant_service.reject_changes(variant_id=variant_id)
        logger.info(f"Successfully rejected changes for variant {variant_id}")
        return response
        
    except ValueError as e:
        logger.warning(f"Validation error rejecting changes: {str(e)}")
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error rejecting changes: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to reject changes: {str(e)}"
        )


@router.get("/{variant_id}/features/search", response_model=FeatureSearchResponse)
async def search_features(
    variant_id: str,
    query: str,
    top_k: int = 10,
    conversation_id: str = None,
    ember_client: AsyncClient = Depends(get_ember_client),
    variant_service: VariantService = Depends(get_variant_service)
) -> FeatureSearchResponse:
    """
    Search for features using semantic similarity.
    
    Args:
        variant_id: UUID of the variant to search within
        query: Search query string
        top_k: Maximum number of results to return (default: 10, max: 100)
        conversation_id: Optional conversation ID to populate activation values
        ember_client: Ember SDK client
        variant_service: Injected variant service
        
    Returns:
        FeatureSearchResponse: List of matching features
        
    Raises:
        HTTPException: For validation or service errors
    """
    logger.info(f"GET /variants/{variant_id}/features/search - query: '{query}', top_k: {top_k}, conversation_id: {conversation_id}")
    
    try:
        # Create search request
        search_request = FeatureSearchRequest(query=query, top_k=top_k)
        
        # Get activated features if conversation_id is provided
        activated_features = None
        if conversation_id:
            # Import here to avoid circular imports
            from ..services.conversation_service import ConversationService
            activated_features = ConversationService._conversation_activated_features.get(conversation_id, {})
            # Extract just the activation values from UnifiedFeature objects
            activated_features = {uuid: feature.activation for uuid, feature in activated_features.items() if feature.activation is not None}
            logger.debug(f"Found {len(activated_features)} activated features for conversation {conversation_id}")
        
        response = await variant_service.search_features(
            variant_id=variant_id,
            request=search_request,
            ember_client=ember_client,
            activated_features=activated_features
        )
        logger.info(f"Successfully found {len(response.features)} features for query: '{query}'")
        return response
        
    except ValueError as e:
        logger.warning(f"Validation error searching features: {str(e)}")
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error searching features: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to search features: {str(e)}"
        )


@router.post("/{variant_id}/auto-steer", response_model=AutoSteerResponse)
async def auto_steer(
    variant_id: str,
    request: AutoSteerRequest,
    ember_client: AsyncClient = Depends(get_ember_client),
    variant_service: VariantService = Depends(get_variant_service)
) -> AutoSteerResponse:
    """
    Automatically steer features based on user query using LLM analysis.
    
    Analyzes the user's query and current variant state to suggest and apply
    feature modifications that align with the user's intent.
    
    Args:
        variant_id: UUID of the variant to auto-steer
        request: AutoSteerRequest with query and conversation context
        ember_client: Ember SDK client
        variant_service: Injected variant service
        
    Returns:
        AutoSteerResponse with suggested features and modifications
        
    Raises:
        HTTPException: For validation or service errors
    """
    logger.info(f"POST /variants/{variant_id}/auto-steer - query: '{request.query}'")
    
    try:
        # Validate that the variant_id in the path matches the request
        if variant_id != request.current_variant_id:
            raise HTTPException(
                status_code=400,
                detail="Variant ID in path must match current_variant_id in request"
            )
        
        response = await variant_service.auto_steer(
            request=request,
            ember_client=ember_client
        )
        logger.info(f"Auto-steer completed successfully for variant {variant_id}")
        return response
        
    except ValueError as e:
        logger.warning(f"Validation error in auto-steer: {str(e)}")
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error in auto-steer: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Auto-steer failed: {str(e)}"
        )
