import logging
from typing import Optional, Dict
from goodfire import AsyncClient
import goodfire

from ..core.constants import DEMO_VARIANT_ID, DEMO_VARIANT_LABEL, DEFAULT_BASE_MODEL
from ..schemas.variant import VariantSummary, VariantCreateRequest, VariantResponse, VariantOperationResponse, FeatureSearchRequest, FeatureSearchResponse, AutoSteerRequest, AutoSteerResponse
from ..schemas.feature import VariantSteerRequest, VariantSteerResponse, UnifiedFeature
from .llm_service import LLMService

logger = logging.getLogger(__name__)


class VariantService:
    """
    Service for managing variant lifecycle and operations.
    Handles variant creation, modifications, and Ember SDK integration.
    """
    
    # v2.0: In-memory storage for feature modifications
    _variant_modified_features: Dict[str, Dict[str, float]] = {}
    _variant_pending_features: Dict[str, Dict[str, float]] = {}
    
    def get_demo_variant(self) -> VariantSummary:
        """
        Get the hardcoded demo variant for v2.0 MVP.

        Returns:
            VariantSummary for the demo variant.
        """
        return VariantSummary(
            uuid=DEMO_VARIANT_ID,
            label=DEMO_VARIANT_LABEL
        )
    
    def create_variant(
        self, 
        request: VariantCreateRequest,
        ember_client: AsyncClient
    ) -> VariantResponse:
        """
        Create a new variant.
        
        v2.0: Returns hardcoded demo variant for MVP, ignoring input parameters.
        
        Args:
            request: Variant creation parameters (label, base_model)
            ember_client: Ember SDK client for API interactions
        
        Returns:
            VariantResponse with new variant details.
        """
        logger.info(f"Creating new variant with label='{request.label}', base_model='{request.base_model}'")
        
        # v2.0: Return hardcoded demo variant regardless of input
        response = VariantResponse(
            uuid=DEMO_VARIANT_ID,
            label=DEMO_VARIANT_LABEL,
            base_model=DEFAULT_BASE_MODEL,
            modified_features={},
            pending_features={}
        )
        
        logger.debug(f"Successfully created variant {response.uuid}")
        return response
    
    async def steer_feature(
        self,
        variant_id: str,
        feature_uuid: str,
        request: VariantSteerRequest,
        ember_client: AsyncClient
    ) -> VariantSteerResponse:
        """
        Apply a pending modification to a feature in a variant.
        
        Args:
            variant_id: UUID of the variant to modify
            feature_uuid: UUID of the feature to steer
            request: Steering request with modification value
            ember_client: Ember SDK client for feature validation
            
        Returns:
            VariantSteerResponse with steering result
            
        Raises:
            ValueError: If variant doesn't exist, feature doesn't exist, or value out of range
        """
        logger.info(f"Steering feature {feature_uuid} in variant {variant_id} to value {request.value}")
        
        # v2.0: Validate variant exists (hardcoded demo check)
        if variant_id != DEMO_VARIANT_ID:
            raise ValueError(f"Variant {variant_id} not found")
        
        # Validate steering value range
        if not (-1.0 <= request.value <= 1.0):
            raise ValueError(f"Steering value {request.value} must be between -1.0 and 1.0")
        
        # Validate feature exists via Ember SDK
        try:
            logger.debug(f"Validating feature {feature_uuid} exists")
            feature_list = await ember_client.features._list(ids=[feature_uuid])
            if not feature_list or len(feature_list) == 0:
                raise ValueError(f"Feature {feature_uuid} not found")
            feature = feature_list[0]
            logger.debug(f"Feature validated: {feature.label if hasattr(feature, 'label') else 'unlabeled'}")
        except Exception as e:
            logger.error(f"Feature {feature_uuid} not found: {str(e)}")
            raise ValueError(f"Feature {feature_uuid} not found")
        
        # Initialize variant pending features if not exists
        if variant_id not in self._variant_pending_features:
            self._variant_pending_features[variant_id] = {}
        
        # Store pending modification
        self._variant_pending_features[variant_id][feature_uuid] = request.value
        
        logger.info(f"Successfully set pending modification for feature {feature_uuid} to {request.value}")
        
        return VariantSteerResponse(
            success=True,
            feature_uuid=feature_uuid,
            pending_modification=request.value
        )
    
    async def commit_changes(
        self,
        variant_id: str,
        ember_client: AsyncClient
    ) -> VariantOperationResponse:
        """
        Commit all pending modifications to confirmed modifications.
        
        Args:
            variant_id: UUID of the variant to commit changes for
            ember_client: Ember SDK client for feature operations
            
        Returns:
            VariantOperationResponse with operation result
            
        Raises:
            ValueError: If variant doesn't exist or no pending changes
        """
        logger.info(f"Committing pending changes for variant {variant_id}")
        
        # v2.0: Validate variant exists (hardcoded demo check)
        if variant_id != DEMO_VARIANT_ID:
            raise ValueError(f"Variant {variant_id} not found")
        
        # Check if there are pending changes to commit
        pending_features = self._variant_pending_features.get(variant_id, {})
        if not pending_features:
            logger.warning(f"No pending changes to commit for variant {variant_id}")
            return VariantOperationResponse(success=True)
        
        # Initialize confirmed features if not exists
        if variant_id not in self._variant_modified_features:
            self._variant_modified_features[variant_id] = {}
        
        # Move pending modifications to confirmed modifications
        for feature_uuid, value in pending_features.items():
            if value == 0.0:
                # Remove from confirmed modifications if it exists (zero = no modification)
                if feature_uuid in self._variant_modified_features[variant_id]:
                    del self._variant_modified_features[variant_id][feature_uuid]
                    logger.debug(f"Removed zero-value modification for feature {feature_uuid}")
                else:
                    logger.debug(f"Skipped zero-value modification for feature {feature_uuid} (not previously modified)")
            else:
                # Add/update confirmed modification
                self._variant_modified_features[variant_id][feature_uuid] = value
                logger.debug(f"Committed feature {feature_uuid} modification: {value}")
        
        # Clear pending modifications
        self._variant_pending_features[variant_id] = {}
        
        logger.info(f"Successfully committed {len(pending_features)} modifications for variant {variant_id}")
        return VariantOperationResponse(success=True)
    
    async def reject_changes(
        self,
        variant_id: str
    ) -> VariantOperationResponse:
        """
        Reject all pending modifications without applying them.
        
        Args:
            variant_id: UUID of the variant to reject changes for
            
        Returns:
            VariantOperationResponse with operation result
            
        Raises:
            ValueError: If variant doesn't exist
        """
        logger.info(f"Rejecting pending changes for variant {variant_id}")
        
        # v2.0: Validate variant exists (hardcoded demo check)
        if variant_id != DEMO_VARIANT_ID:
            raise ValueError(f"Variant {variant_id} not found")
        
        # Check if there are pending changes to reject
        pending_features = self._variant_pending_features.get(variant_id, {})
        if not pending_features:
            logger.warning(f"No pending changes to reject for variant {variant_id}")
            return VariantOperationResponse(success=True)
        
        # Clear pending modifications
        self._variant_pending_features[variant_id] = {}
        
        logger.info(f"Successfully rejected {len(pending_features)} pending modifications for variant {variant_id}")
        return VariantOperationResponse(success=True)
    
    async def build_ember_variant(
        self,
        variant_id: str,
        ember_client: AsyncClient
    ) -> goodfire.Variant:
        """
        Build an Ember variant with confirmed modifications applied.
        
        Args:
            variant_id: UUID of the variant to build
            ember_client: Ember SDK client for feature operations
            
        Returns:
            goodfire.Variant with confirmed modifications applied
            
        Raises:
            ValueError: If variant doesn't exist
        """
        logger.debug(f"Building Ember variant for variant {variant_id}")
        
        # v2.0: Validate variant exists (hardcoded demo check)
        if variant_id != DEMO_VARIANT_ID:
            raise ValueError(f"Variant {variant_id} not found")
        
        # Create base variant
        variant = goodfire.Variant(DEFAULT_BASE_MODEL)
        
        # Apply confirmed modifications
        confirmed_features = self._variant_modified_features.get(variant_id, {})
        if confirmed_features:
            logger.debug(f"Applying {len(confirmed_features)} confirmed modifications")
            for feature_uuid, value in confirmed_features.items():
                try:
                    # Get feature object from Ember SDK
                    feature_list = await ember_client.features._list(ids=[feature_uuid])
                    if feature_list and len(feature_list) > 0:
                        feature = feature_list[0]
                        variant.set(feature, value)
                        logger.debug(f"Applied modification {feature_uuid}: {value}")
                    else:
                        logger.warning(f"Feature {feature_uuid} not found when building variant")
                except Exception as e:
                    logger.error(f"Error applying modification {feature_uuid}: {str(e)}")
                    # Continue with other modifications rather than failing entirely
        else:
            logger.debug("No confirmed modifications to apply")
        
        logger.debug(f"Successfully built Ember variant for {variant_id}")
        return variant
    
    def create_unified_feature(
        self,
        feature_uuid: str,
        label: str,
        activation: Optional[float] = None,
        variant_id: Optional[str] = None
    ) -> UnifiedFeature:
        """
        Create a UnifiedFeature with variant modification data populated.
        
        Args:
            feature_uuid: UUID of the feature
            label: Human-readable label for the feature
            activation: Optional activation value from inspection
            variant_id: Optional variant ID (defaults to demo variant)
            
        Returns:
            UnifiedFeature with complete modification data
        """
        # Use demo variant if not specified
        if variant_id is None:
            variant_id = DEMO_VARIANT_ID
        
        # Get modification and pending modification data

        feature_uuid_str = str(feature_uuid)
        modification = self._variant_modified_features.get(variant_id, {}).get(feature_uuid_str, 0.0)
        pending_modification = self._variant_pending_features.get(variant_id, {}).get(feature_uuid_str)
        
        return UnifiedFeature(
            uuid=feature_uuid_str,
            label=label,
            activation=activation,
            modification=modification,
            pending_modification=pending_modification
        )
    
    async def search_features(
        self,
        variant_id: str,
        request: FeatureSearchRequest,
        ember_client: AsyncClient,
        activated_features: Optional[Dict[str, float]] = None
    ) -> FeatureSearchResponse:
        """
        Search for features using semantic similarity.
        
        Args:
            variant_id: UUID of the variant to search within
            request: Search request with query and top_k parameters
            ember_client: Ember SDK client for feature operations
            activated_features: Optional dict mapping feature UUIDs to activation values
                               from a conversation context
            
        Returns:
            FeatureSearchResponse with matching features
            
        Raises:
            ValueError: If variant doesn't exist
        """
        logger.info(f"Searching features for variant {variant_id} with query: '{request.query}', top_k: {request.top_k}")
        
        # v2.0: Validate variant exists (hardcoded demo check)
        if variant_id != DEMO_VARIANT_ID:
            raise ValueError(f"Variant {variant_id} not found")
        
        # Validate search parameters
        if not request.query.strip():
            raise ValueError("Search query cannot be empty")
        
        if request.top_k <= 0:
            raise ValueError("top_k must be greater than 0")
        
        if request.top_k > 100:  
            raise ValueError("top_k cannot exceed 100")
        
        try:
            # Create base variant for search (using default model)
            variant = goodfire.Variant(DEFAULT_BASE_MODEL)
            
            # Perform semantic search using Ember SDK
            logger.debug(f"Performing semantic search with query: '{request.query}'")
            search_results = await ember_client.features.search(
                query=request.query,
                model=variant,
                top_k=request.top_k
            )
            
            # Transform results to UnifiedFeature objects with modification data
            features = []
            for result in search_results:
                feature_uuid = str(result.uuid)
                
                # Check if this feature has an activation value from conversation context
                activation = None
                if activated_features and feature_uuid in activated_features:
                    activation = activated_features[feature_uuid]
                
                unified_feature = self.create_unified_feature(
                    feature_uuid=feature_uuid,
                    label=result.label,
                    activation=activation,
                    variant_id=variant_id
                )
                features.append(unified_feature)
            
            logger.info(f"Found {len(features)} matching features for query: '{request.query}'")
            return FeatureSearchResponse(features=features)
            
        except Exception as e:
            logger.error(f"Error searching features: {str(e)}")
            raise ValueError(f"Failed to search features: {str(e)}")
    
    async def auto_steer(
        self,
        request: AutoSteerRequest,
        ember_client: AsyncClient
    ) -> AutoSteerResponse:
        """
        Automatically steer features based on user query using LLM analysis.
        
        Args:
            request: AutoSteerRequest with query, variant_id, and conversation context
            ember_client: Ember SDK client for feature operations
            
        Returns:
            AutoSteerResponse with suggested features and modifications
            
        Raises:
            ValueError: If variant doesn't exist or other validation errors
            Exception: If LLM operations fail
        """
        logger.info(f"Auto-steering for variant {request.current_variant_id} with query: '{request.query}'")
        
        # v2.0: Validate variant exists (hardcoded demo check)
        if request.current_variant_id != DEMO_VARIANT_ID:
            raise ValueError(f"Variant {request.current_variant_id} not found")
        
        try:
            # Initialize LLM service
            llm_service = LLMService()
            
            # Get current modifications for context
            current_modifications = self._variant_modified_features.get(request.current_variant_id, {})
            pending_modifications = self._variant_pending_features.get(request.current_variant_id, {})
            
            # Build current modifications info for LLM (feature labels + values)
            # For now, we'll use a simplified approach since we don't have feature labels readily available
            # In a real implementation, you'd want to fetch feature details from Ember SDK
            current_mods_info = {}
            if current_modifications:
                # This is a simplified version - in practice you'd want to get actual feature labels
                for feature_uuid, value in current_modifications.items():
                    current_mods_info[f"Feature {feature_uuid}"] = value
            
            # Step 1: Generate search keywords and persona using LLM
            logger.debug("Generating search keywords and persona with LLM")
            keywords, persona = await llm_service.generate_search_keywords(
                user_query=request.query,
                conversation_context=request.conversation_context,
                current_modifications=current_mods_info
            )
            
            if not keywords:
                logger.warning("No keywords generated by LLM")
                return AutoSteerResponse(
                    success=False,
                    search_keywords=[],
                    suggested_features=[]
                )
            
            # Step 2: Combine keywords into single search query
            combined_query = " ".join(keywords)
            logger.debug(f"Searching features with combined query: '{combined_query}'")
            
            # Step 3: Search for features using existing search method
            search_request = FeatureSearchRequest(query=combined_query, top_k=10)
            search_response = await self.search_features(
                variant_id=request.current_variant_id,
                request=search_request,
                ember_client=ember_client
            )
            
            if not search_response.features:
                logger.warning("No features found in search")
                return AutoSteerResponse(
                    success=False,
                    search_keywords=keywords,
                    suggested_features=[]
                )
            
            # Step 4: Use LLM to select features to modify
            logger.debug("Selecting features to modify with LLM")
            feature_selections = await llm_service.select_features_to_modify(
                search_results=search_response.features,
                user_query=request.query,
                current_modifications=current_mods_info,
                persona=persona
            )
            
            if not feature_selections:
                logger.warning("No features selected by LLM for modification")
                return AutoSteerResponse(
                    success=False,
                    search_keywords=keywords,
                    suggested_features=[]
                )
            
            # Step 5: Apply modifications using existing steer_feature method
            suggested_features = []
            applied_count = 0
            
            for feature_uuid, modification_value in feature_selections.items():
                try:
                    # Find the feature in search results to get its details
                    feature_info = None
                    for feature in search_response.features:
                        if feature.uuid == feature_uuid:
                            feature_info = feature
                            break
                    
                    if not feature_info:
                        logger.warning(f"Feature {feature_uuid} not found in search results")
                        continue
                    
                    # Apply the modification using existing steer_feature method
                    steer_request = VariantSteerRequest(value=modification_value)
                    await self.steer_feature(
                        variant_id=request.current_variant_id,
                        feature_uuid=feature_uuid,
                        request=steer_request,
                        ember_client=ember_client
                    )
                    
                    # Create UnifiedFeature with the new pending modification
                    suggested_feature = self.create_unified_feature(
                        feature_uuid=feature_uuid,
                        label=feature_info.label,
                        activation=feature_info.activation,
                        variant_id=request.current_variant_id
                    )
                    suggested_features.append(suggested_feature)
                    applied_count += 1
                    
                    logger.info(f"Applied auto-steer to feature {feature_uuid} with value {modification_value}")
                    
                except Exception as e:
                    logger.error(f"Error applying modification to feature {feature_uuid}: {str(e)}")
                    # Continue with other features rather than failing entirely
                    continue
            
            logger.info(f"Auto-steer completed: {applied_count} features modified")
            return AutoSteerResponse(
                success=True,
                search_keywords=keywords,
                suggested_features=suggested_features
            )
            
        except Exception as e:
            logger.error(f"Error in auto-steer: {str(e)}")
            raise Exception(f"Auto-steer failed: {str(e)}")
