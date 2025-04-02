import os
import pytest
import pytest_asyncio
import uuid
import logging
from typing import Dict, List, Any

from src.core.config import Settings
from src.core.services.variant_manager import VariantManager
from src.core.services.feature_service import FeatureService
from src.core.services.completion_service import CompletionService
from src.core.llm_client import LLMClient
from goodfire import AsyncClient

# Set up logger
logger = logging.getLogger(__name__)

# Register custom marks
def pytest_configure(config):
    config.addinivalue_line("markers", "integration: mark test as an integration test")

# Mark tests as integration tests
pytestmark = [
    pytest.mark.integration,
    pytest.mark.skipif(
        os.environ.get("CI") == "true", 
        reason="Skipping integration tests in CI environment"
    )
]

@pytest.fixture
def settings():
    """Load settings for integration tests."""
    return Settings()

@pytest_asyncio.fixture
async def ember_client(settings):
    """Create a real client for integration tests."""
    client = AsyncClient(api_key=settings.get_ember_api_key)
    yield client
    # No close method needed

@pytest_asyncio.fixture
async def variant_manager(settings):
    """Create a real variant manager for integration tests."""
    return VariantManager(settings)

@pytest_asyncio.fixture
async def llm_client(settings):
    """Create a real LLM client for integration tests."""
    return LLMClient(api_key=settings.get_openai_api_key, model=settings.openai_model)

@pytest_asyncio.fixture
async def feature_service(ember_client, variant_manager, llm_client, settings):
    """Create a real feature service for integration tests."""
    return FeatureService(ember_client, variant_manager, llm_client, settings)

class TestFeatureIntegration:
    """Integration tests for feature steering and variant management."""
    
    @pytest.mark.asyncio
    async def test_feature_steering_flow(self, variant_manager, feature_service):
        """
        Test the end-to-end flow of creating a variant, searching for a feature,
        steering on that feature, and verifying the steering was applied.
        """
        # Generate a unique session ID for this test
        session_id = f"test-session-{uuid.uuid4()}"
        logger.info(f"Starting integration test with session ID: {session_id}")
        
        # Step 1: Create the default variant
        variant = await variant_manager.get_default_variant(session_id)
        variant_id = "default"
        logger.info(f"Created default variant with ID: {variant_id}")
        
        # Step 2: Search for a feature
        # Using a feature that's likely to exist in most language models
        search_query = "formality"
        feature_results = await feature_service.search_features(
            query=search_query,
            session_id=session_id,
            variant_id=variant_id,
            top_k=5
        )
        
        assert feature_results, f"No features found for query: {search_query}"
        logger.info(f"Found {len(feature_results)} features for query: {search_query}")
        
        # Get the first feature
        feature_to_steer = feature_results[0].label
        logger.info(f"Selected feature for steering: {feature_to_steer}")
        
        # Step 3: Apply steering to the feature
        steering_value = 0.75
        steer_response = await feature_service.steer_feature(
            session_id=session_id,
            variant_id=variant_id,
            feature_label=feature_to_steer,
            value=steering_value
        )
        
        assert steer_response, "Failed to steer feature"
        assert steer_response.label == feature_to_steer, "Feature label mismatch"
        assert steer_response.activation == steering_value, "Steering value mismatch"
        logger.info(f"Successfully steered feature: {feature_to_steer}={steering_value}")
        
        # Step 4: Get the variant state and verify steering was applied
        variant_state = await variant_manager.get_variant_state(session_id, variant_id)
        
        assert variant_state, "Failed to get variant state"
        assert "edits" in variant_state, "No edits found in variant state"
        
        # Check if the feature was actually steered in the variant
        edits = variant_state.get("edits", [])
        assert edits, "No edits found in variant state"
        
        # Find the edit for our steered feature
        feature_edit = None
        for edit in edits:
            if feature_to_steer.lower() in edit.get("feature_label", "").lower():
                feature_edit = edit
                break
        
        assert feature_edit, f"No edit found for feature: {feature_to_steer}"
        assert abs(feature_edit["value"] - steering_value) < 0.001, f"Steering value mismatch: {feature_edit['value']} != {steering_value}"
        logger.info(f"Verified steering value for feature: {feature_edit['feature_label']}")
        
        logger.info("Feature steering integration test completed successfully")
