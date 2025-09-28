import uuid
import logging
from datetime import datetime
from typing import Optional, List, AsyncGenerator, Dict
from goodfire import AsyncClient
import goodfire

from ..core.constants import DEMO_CONVERSATION_ID, DEFAULT_BASE_MODEL
from ..schemas.conversation import ConversationCreateResponse, ChatMessage
from ..schemas.variant import VariantSummary
from ..schemas.feature import UnifiedFeature
from .variant_service import VariantService

logger = logging.getLogger(__name__)


class ConversationService:
    """
    Service for managing conversation lifecycle and state.
    Handles creation, variant switching, and Ember SDK integration.
    """
    
    # v2.0: In-memory storage for conversation data
    _conversation_messages: Dict[str, List[ChatMessage]] = {}
    _conversation_activated_features: Dict[str, Dict[str, str]] = {}  # {conv_id: {feature_uuid: label}}
    
    def create_conversation(
        self, 
        ember_client: AsyncClient,
        variant_id: Optional[str] = None
    ) -> ConversationCreateResponse:
        """
        Create a new conversation with specified or default variant.
        
        v2.0: Returns hardcoded demo conversation for MVP.
        
        Args:
            ember_client: Ember SDK client for API interactions
            variant_id: Optional UUID of existing variant to use.
                       Currently ignored in v2.0 - always uses demo variant.
        
        Returns:
            ConversationCreateResponse with new conversation details.
        
        Raises:
            ValueError: If specified variant_id doesn't exist (v2.1).
        """
        logger.info(f"Creating new conversation with variant_id={variant_id}")
        
        # v2.0: Use hardcoded conversation ID
        conversation_uuid = DEMO_CONVERSATION_ID
        
        # # Handle variant selection
        # if variant_id is None:
        #     current_variant = self._create_empty_variant()
        #     logger.debug(f"Created default variant for conversation {conversation_uuid}")
        # else:
        #     # TODO: Fetch existing variant by ID when variant service exists
        #     # For now, stub with the provided ID
        #     current_variant = VariantSummary(
        #         uuid=variant_id,
        #         label="Existing Variant"  # TODO: Get actual label from variant service
        #     )
        #     logger.debug(f"Using existing variant {variant_id} for conversation {conversation_uuid}")
        
        variant_service = VariantService()
        current_variant = variant_service.get_demo_variant()

        # Create response
        response = ConversationCreateResponse(
            uuid=conversation_uuid,
            current_variant=current_variant,
            created_at=datetime.now()
        )
        
        logger.debug(f"Successfully created conversation {conversation_uuid}")
        return response
    
    
    async def send_message(
        self,
        conversation_id: str,
        messages: List[ChatMessage],
        ember_client: AsyncClient,
        stream: bool = True
    ) -> AsyncGenerator[str, None]:
        """
        Send a message in a conversation and stream the response.
        
        Args:
            conversation_id: UUID of the conversation
            messages: List of chat messages (full conversation history)
            ember_client: Ember SDK client for API interactions
            stream: Whether to stream the response (currently always True for MVP)
            
        Yields:
            str: Streaming response content chunks
            
        Raises:
            ValueError: If conversation_id doesn't exist
            Exception: For Ember SDK or other unexpected errors
        """
        logger.info(f"Sending message to conversation {conversation_id}")
        
        # v2.0: Validate conversation exists (hardcoded demo check)
        if conversation_id != DEMO_CONVERSATION_ID:
            raise ValueError(f"Conversation {conversation_id} not found")
        
        # Store messages in conversation storage
        self._conversation_messages[conversation_id] = messages.copy()
        logger.debug(f"Stored {len(messages)} messages for conversation {conversation_id}")
        
        # Convert Pydantic models to dicts for Ember SDK
        ember_messages = [msg.model_dump() for msg in messages]
        
        # v2.0: Create variant with demo configuration
        # TODO: Retrieve actual variant modifications when variant service exists
        variant = goodfire.Variant(DEFAULT_BASE_MODEL)
        # TODO: Apply feature modifications from variant:
        # for feature_uuid, modification_value in variant.modified_features.items():
        #     feature = ember_client.features.get(feature_uuid)
        #     variant.set(feature, modification_value)
        
        logger.debug(f"Created variant with base model: {DEFAULT_BASE_MODEL}")
        
        try:
            # Stream chat completion using Ember SDK
            logger.debug("Starting streaming chat completion")
            logger.debug(f"Messages: {ember_messages}")
            logger.debug(f"Model: {variant}")
            
            # Stream chat completion using Ember SDK
            stream_response = await ember_client.chat.completions.create(
                messages=ember_messages,
                model=variant,
                stream=True,
                max_completion_tokens=1000  # TODO: Make configurable
            )
            
            # Iterate over the streaming response
            async for chunk in stream_response:
                if chunk.choices and len(chunk.choices) > 0:
                    delta = chunk.choices[0].delta
                    # Handle both dict and object formats for delta
                    if isinstance(delta, dict):
                        content = delta.get("content", "")
                    else:
                        content = getattr(delta, "content", "")
                    
                    if content:
                        logger.debug(f"Yielding streaming chunk: {repr(content)}")
                        yield content
                    
        except Exception as e:
            logger.error(f"Error during streaming chat completion: {str(e)}")
            raise
    
    async def get_conversation_features(
        self,
        conversation_id: str,
        ember_client: AsyncClient,
        variant_service: VariantService,
        top_k: int = 20
    ) -> List[UnifiedFeature]:
        """
        Get activated features for a conversation using Ember SDK inspect().
        
        Args:
            conversation_id: UUID of the conversation
            ember_client: Ember SDK client for feature operations
            variant_service: VariantService for building Ember variant
            top_k: Number of top activated features to return
            
        Returns:
            List[UnifiedFeature]: Features with activation, modification, and pending data
            
        Raises:
            ValueError: If conversation doesn't exist or has no messages
        """
        logger.info(f"Getting features for conversation {conversation_id}")
        
        # v2.0: Validate conversation exists (hardcoded demo check)
        if conversation_id != DEMO_CONVERSATION_ID:
            raise ValueError(f"Conversation {conversation_id} not found")
        
        # Get stored messages for conversation
        messages = self._conversation_messages.get(conversation_id, [])
        if not messages:
            logger.warning(f"No messages found for conversation {conversation_id}")
            return []
        
        logger.debug(f"Found {len(messages)} messages for inspection")
        
        # Get current variant (demo variant for v2.0)
        variant_summary = variant_service.get_demo_variant()
        
        # Build Ember variant with confirmed modifications
        try:
            ember_variant = await variant_service.build_ember_variant(
                variant_id=variant_summary.uuid,
                ember_client=ember_client
            )
            logger.debug("Successfully built Ember variant for inspection")
        except Exception as e:
            logger.error(f"Error building Ember variant: {str(e)}")
            raise
        
        # Convert messages to format expected by inspect()
        ember_messages = [msg.model_dump() for msg in messages]
        
        # Run feature inspection
        try:
            logger.debug("Running feature inspection")
            inspector = await ember_client.features.inspect(
                messages=ember_messages,
                model=ember_variant
            )
            
            # Extract top activated features
            top_activations = inspector.top(k=top_k)
            logger.debug(f"Found {len(top_activations)} top activated features")
            
        except Exception as e:
            logger.error(f"Error during feature inspection: {str(e)}")
            raise
        
        # Convert to unified feature format
        unified_features = []
        for activation in top_activations:
            try:
                # Create unified feature using variant service helper
                unified_feature = variant_service.create_unified_feature(
                    feature_uuid=activation.feature.uuid,
                    label=activation.feature.label,
                    activation=activation.activation,
                    variant_id=variant_summary.uuid
                )
                
                unified_features.append(unified_feature)
                
                # Update activated features storage
                if conversation_id not in self._conversation_activated_features:
                    self._conversation_activated_features[conversation_id] = {}
                
                self._conversation_activated_features[conversation_id][activation.feature.uuid] = activation.feature.label
                
            except Exception as e:
                logger.error(f"Error processing feature {activation.feature.uuid}: {str(e)}")
                # Continue with other features rather than failing entirely
                continue
        
        logger.info(f"Successfully processed {len(unified_features)} features for conversation {conversation_id}")
        return unified_features
    
    async def get_table_features(
        self,
        conversation_id: str,
        ember_client: AsyncClient,
        variant_service: VariantService,
        top_k: int = 20
    ) -> List[UnifiedFeature]:
        """
        Get all features relevant for the UI table (activated + modified).
        
        Combines recently activated features from inspection with all modified
        features from the variant, providing a complete view for the UI table.
        
        Args:
            conversation_id: UUID of the conversation
            ember_client: Ember SDK client for feature operations
            variant_service: VariantService for building Ember variant and getting modifications
            top_k: Number of top activated features to include
            
        Returns:
            List[UnifiedFeature]: All relevant features for UI table
            
        Raises:
            ValueError: If conversation doesn't exist
        """
        logger.info(f"Getting table features for conversation {conversation_id}")
        
        # v2.0: Validate conversation exists (hardcoded demo check)
        if conversation_id != DEMO_CONVERSATION_ID:
            raise ValueError(f"Conversation {conversation_id} not found")
        
        # Get current variant (demo variant for v2.0)
        variant_summary = variant_service.get_demo_variant()
        variant_id = variant_summary.uuid
        
        # Start with recently activated features (from inspection)
        try:
            activated_features = await self.get_conversation_features(
                conversation_id=conversation_id,
                ember_client=ember_client,
                variant_service=variant_service,
                top_k=top_k
            )
            logger.debug(f"Got {len(activated_features)} activated features from inspection")
        except Exception as e:
            logger.warning(f"Could not get activated features: {str(e)}")
            activated_features = []
        
        # Get all modified features from variant
        modified_feature_uuids = set(variant_service._variant_modified_features.get(variant_id, {}).keys())
        pending_feature_uuids = set(variant_service._variant_pending_features.get(variant_id, {}).keys())
        all_modified_uuids = modified_feature_uuids | pending_feature_uuids
        
        # Find modified features that aren't in the activated list
        activated_uuids = {f.uuid for f in activated_features}
        missing_modified_uuids = all_modified_uuids - activated_uuids
        
        logger.debug(f"Found {len(missing_modified_uuids)} modified features not in activated list")
        
        # Fetch data for missing modified features
        table_features = activated_features.copy()
        
        for feature_uuid in missing_modified_uuids:
            try:
                # Get feature label from Ember SDK
                feature_list = await ember_client.features._list(ids=[feature_uuid])
                if not feature_list or len(feature_list) == 0:
                    logger.warning(f"Modified feature {feature_uuid} not found in Ember SDK")
                    continue
                
                feature = feature_list[0]
                
                # Create unified feature using variant service helper (no activation since it wasn't in recent inspection)
                unified_feature = variant_service.create_unified_feature(
                    feature_uuid=feature_uuid,
                    label=feature.label,
                    activation=None,  # Not recently activated
                    variant_id=variant_id
                )
                
                table_features.append(unified_feature)
                logger.debug(f"Added modified feature {feature_uuid} to table")
                
            except Exception as e:
                logger.error(f"Error fetching data for modified feature {feature_uuid}: {str(e)}")
                # Continue with other features rather than failing entirely
                continue
        
        logger.info(f"Successfully compiled {len(table_features)} features for table (conversation {conversation_id})")
        return table_features
