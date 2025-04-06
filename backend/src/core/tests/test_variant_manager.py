import pytest
from unittest.mock import MagicMock, patch, AsyncMock
from src.core.services.variant_manager import VariantManager
from src.core.config import Settings

@pytest.fixture
def settings():
    """Create a mock Settings object for testing."""
    settings = MagicMock(spec=Settings)
    settings.default_model = "meta-llama/Llama-3.3-70B-Instruct"
    return settings

@pytest.fixture
def variant_manager(settings):
    """Create a VariantManager instance for testing."""
    return VariantManager(settings)

class TestVariantManager:
    """Test suite for the VariantManager service."""
    
    @pytest.mark.asyncio
    async def test_get_default_variant(self, variant_manager):
        """Test getting the default variant."""
        # Arrange
        session_id = "test_session"
        
        # Act
        variant = await variant_manager.get_default_variant(session_id)
        
        # Assert
        assert variant is not None
        assert variant.base_model == "meta-llama/Llama-3.3-70B-Instruct"
        
        # Verify it's cached
        assert session_id in variant_manager.variants
        assert "default" in variant_manager.variants[session_id]
    
    @pytest.mark.asyncio
    async def test_create_variant(self, variant_manager):
        """Test creating a new variant."""
        # Arrange
        session_id = "test_session"
        
        # Act
        variant = await variant_manager.create_variant(session_id)
        
        # Assert
        assert variant is not None
        assert variant.base_model == "meta-llama/Llama-3.3-70B-Instruct"
        
        # Verify it's cached
        assert session_id in variant_manager.variants
        
        # Get the variant_id (should be a UUID)
        variant_ids = [vid for vid in variant_manager.variants[session_id].keys() if vid != "default"]
        assert len(variant_ids) == 1
        
        # Ensure it's in the cache with the generated id
        variant_id = variant_ids[0]
        assert variant_id in variant_manager.variants[session_id]
    
    @pytest.mark.asyncio
    async def test_create_variant_from_source(self, variant_manager):
        """Test creating a variant based on another variant."""
        # Arrange
        session_id = "test_session"
        
        # Create base variant
        source_variant = await variant_manager.create_variant(session_id)
        
        # Get the source_variant_id
        source_variant_ids = [vid for vid in variant_manager.variants[session_id].keys() if vid != "default"]
        assert len(source_variant_ids) == 1
        source_variant_id = source_variant_ids[0]
        
        # Act
        variant = await variant_manager.create_variant(
            session_id, 
            source_variant_id=source_variant_id
        )
        
        # Assert
        assert variant is not None
        assert session_id in variant_manager.variants
        
        # Should now have two non-default variants
        variant_ids = [vid for vid in variant_manager.variants[session_id].keys() if vid != "default"]
        assert len(variant_ids) == 2
    
    @pytest.mark.asyncio
    async def test_get_variant(self, variant_manager):
        """Test getting a variant."""
        # Arrange
        session_id = "test_session"
        
        # Create the variant first
        created_variant = await variant_manager.create_variant(session_id)
        
        # Get the variant_id
        variant_ids = [vid for vid in variant_manager.variants[session_id].keys() if vid != "default"]
        assert len(variant_ids) == 1
        variant_id = variant_ids[0]
        
        # Act
        variant = await variant_manager.get_variant(session_id, variant_id)
        
        # Assert
        assert variant is not None
        assert variant.base_model == "meta-llama/Llama-3.3-70B-Instruct"
        assert variant is created_variant  # Should be the same object
    
    @pytest.mark.asyncio
    async def test_get_variant_not_found_returns_default(self, variant_manager):
        """Test that getting a non-existent variant returns the default."""
        # Arrange
        session_id = "test_session"
        
        # Act
        variant = await variant_manager.get_variant(session_id, "nonexistent")
        
        # Assert
        assert variant is not None
        assert variant.base_model == "meta-llama/Llama-3.3-70B-Instruct"
        
        # Verify default was created
        assert session_id in variant_manager.variants
        assert "default" in variant_manager.variants[session_id]
    
    @pytest.mark.asyncio
    async def test_get_variant_state(self, variant_manager):
        """Test getting the variant state."""
        # Arrange
        session_id = "test_session"
        
        # Create a variant
        variant = await variant_manager.create_variant(session_id)
        
        # Get the variant_id
        variant_ids = [vid for vid in variant_manager.variants[session_id].keys() if vid != "default"]
        assert len(variant_ids) == 1
        variant_id = variant_ids[0]
        
        # Mock the variant.json() method
        variant.json = MagicMock(return_value={"model": "test-model", "features": {}})
        
        # Act
        state = await variant_manager.get_variant_state(session_id, variant_id)
        
        # Assert
        assert state is not None
        assert "model" in state
        assert state["model"] == "test-model" 