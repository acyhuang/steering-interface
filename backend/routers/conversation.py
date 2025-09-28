import logging
from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.responses import StreamingResponse
from typing import Optional, List
from goodfire import AsyncClient

from ..schemas.conversation import (
    ConversationCreateRequest,
    ConversationCreateResponse,
    ConversationMessageRequest
)
from ..schemas.feature import UnifiedFeature
from ..services.conversation_service import ConversationService
from ..services.variant_service import VariantService
from ..dependencies import get_ember_client

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/conversations", tags=["conversations"])

conversation_service = ConversationService()


def get_variant_service() -> VariantService:
    """Dependency injection for VariantService."""
    return VariantService()


@router.post(
    "",
    response_model=ConversationCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create new conversation",
    description="Creates a new conversation with optional variant selection"
)
async def create_conversation(
    request: ConversationCreateRequest,
    ember_client: AsyncClient = Depends(get_ember_client)
) -> ConversationCreateResponse:
    """
    Create a new conversation.
    
    Args:
        request: ConversationCreateRequest containing optional variant_id
        ember_client: Ember SDK client injected via dependency
        
    Returns:
        ConversationCreateResponse with new conversation details
        
    Raises:
        HTTPException: 400 if variant_id is invalid
        HTTPException: 500 for internal server errors
    """
    try:
        logger.debug(f"Received conversation create request: variant_id={request.variant_id}")
        
        # Delegate to service layer
        response = conversation_service.create_conversation(
            ember_client=ember_client,
            variant_id=request.variant_id
        )
        
        logger.debug(f"Successfully created conversation {response.uuid}")
        return response
        
    except ValueError as e:
        # Handle business logic errors (e.g., invalid variant_id)
        logger.warning(f"Invalid request: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        # Handle unexpected errors
        logger.error(f"Unexpected error creating conversation: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.post(
    "/{conversation_id}/messages",
    status_code=status.HTTP_200_OK,
    summary="Send message to conversation",
    description="Send a message to a conversation and receive streaming response"
)
async def send_message(
    conversation_id: str,
    request: ConversationMessageRequest,
    ember_client: AsyncClient = Depends(get_ember_client)
):
    """
    Send a message to a conversation and receive a streaming response.
    
    Args:
        conversation_id: UUID of the conversation
        request: ConversationMessageRequest containing messages and stream flag
        ember_client: Ember SDK client injected via dependency
        
    Returns:
        StreamingResponse: Real-time streaming response from the AI model
        
    Raises:
        HTTPException: 404 if conversation not found
        HTTPException: 400 for invalid request data
        HTTPException: 500 for internal server errors
    """
    try:
        logger.debug(f"Received message request for conversation {conversation_id}")
        logger.debug(f"Request contains {len(request.messages)} messages, stream={request.stream}")
        
        # Validate request
        if not request.messages:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Messages list cannot be empty"
            )
        
        # For MVP, we only support streaming
        if not request.stream:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Non-streaming responses not yet supported in v2.0"
            )
        
        # Generate streaming response
        async def generate_response():
            try:
                async for content_chunk in conversation_service.send_message(
                    conversation_id=conversation_id,
                    messages=request.messages,
                    ember_client=ember_client,
                    stream=request.stream
                ):
                    yield content_chunk
            except Exception as e:
                logger.error(f"Error during message streaming: {str(e)}")
                # For streaming, we can't send HTTP errors once started
                # Just log and stop the stream
                return
        
        logger.debug(f"Starting streaming response for conversation {conversation_id}")
        return StreamingResponse(
            generate_response(),
            media_type="text/plain",
            headers={"Cache-Control": "no-cache"}
        )
        
    except ValueError as e:
        # Handle business logic errors (e.g., conversation not found)
        logger.warning(f"Invalid request: {str(e)}")
        if "not found" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(e)
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        # Handle unexpected errors
        logger.error(f"Unexpected error sending message: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.get("/{conversation_id}/features", response_model=List[UnifiedFeature])
async def get_conversation_features(
    conversation_id: str,
    ember_client: AsyncClient = Depends(get_ember_client),
    variant_service: VariantService = Depends(get_variant_service)
) -> List[UnifiedFeature]:
    """
    Get activated features for a conversation.
    
    Analyzes the conversation messages using Ember SDK inspect() to find
    the most activated features, combined with modification data.
    
    Args:
        conversation_id: UUID of the conversation
        ember_client: Ember SDK client
        variant_service: Injected variant service
        
    Returns:
        List[UnifiedFeature]: Top activated features with modification data
        
    Raises:
        HTTPException: For validation or service errors
    """
    logger.info(f"GET /conversations/{conversation_id}/features")
    
    try:
        features = await conversation_service.get_conversation_features(
            conversation_id=conversation_id,
            ember_client=ember_client,
            variant_service=variant_service,
            top_k=20
        )
        logger.info(f"Successfully retrieved {len(features)} features for conversation {conversation_id}")
        return features
        
    except ValueError as e:
        logger.warning(f"Validation error getting features: {str(e)}")
        if "not found" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(e)
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )
    except Exception as e:
        logger.error(f"Error getting conversation features: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get conversation features: {str(e)}"
        )


@router.get("/{conversation_id}/table-features", response_model=List[UnifiedFeature])
async def get_table_features(
    conversation_id: str,
    ember_client: AsyncClient = Depends(get_ember_client),
    variant_service: VariantService = Depends(get_variant_service)
) -> List[UnifiedFeature]:
    """
    Get all features relevant for the UI table (activated + modified).
    
    Combines recently activated features from conversation inspection with
    all modified features from the variant to provide a complete view for
    the UI feature table with filtering and sorting capabilities.
    
    Args:
        conversation_id: UUID of the conversation
        ember_client: Ember SDK client
        variant_service: Injected variant service
        
    Returns:
        List[UnifiedFeature]: All relevant features for UI table
        
    Raises:
        HTTPException: For validation or service errors
    """
    logger.info(f"GET /conversations/{conversation_id}/table-features")
    
    try:
        features = await conversation_service.get_table_features(
            conversation_id=conversation_id,
            ember_client=ember_client,
            variant_service=variant_service,
            top_k=20
        )
        logger.info(f"Successfully retrieved {len(features)} table features for conversation {conversation_id}")
        return features
        
    except ValueError as e:
        logger.warning(f"Validation error getting table features: {str(e)}")
        if "not found" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(e)
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )
    except Exception as e:
        logger.error(f"Error getting table features: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get table features: {str(e)}"
        )
