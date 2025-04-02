import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from goodfire import AsyncClient

from src.core.services.feature_service import FeatureService
from src.core.services.interfaces.variant_manager import IVariantManager
from src.core.llm_client import LLMClient
from src.core.config import Settings
from src.models.chat import ChatMessage
from src.models.features import FeatureActivation, FeatureCluster

@pytest.fixture
def settings():
    """Create a mock Settings object for testing."""
    settings = MagicMock(spec=Settings)
    return settings

@pytest.fixture
def variant_manager():
    """Create a mock VariantManager for testing."""
    manager = MagicMock(spec=IVariantManager)
    # Set up the async methods using AsyncMock
    manager.get_variant = AsyncMock()
    return manager

@pytest.fixture
def ember_client():
    """Create a mock AsyncClient for testing."""
    client = MagicMock(spec=AsyncClient)
    
    # Set up nested attributes and async methods for features
    client.features = MagicMock()
    client.features.inspect = AsyncMock()
    client.features.search = AsyncMock()
    
    return client

@pytest.fixture
def llm_client():
    """Create a mock LLMClient for testing."""
    client = MagicMock(spec=LLMClient)
    client.get_completion = AsyncMock()
    return client

@pytest.fixture
def feature_service(ember_client, variant_manager, llm_client, settings):
    """Create a FeatureService instance for testing."""
    return FeatureService(ember_client, variant_manager, llm_client, settings)

class TestFeatureService:
    """Test suite for the FeatureService."""
    
    @pytest.mark.asyncio
    async def test_inspect_features_with_messages(self, feature_service, ember_client, variant_manager):
        """Test inspecting features with a non-empty message list."""
        # Arrange
        session_id = "test_session"
        variant_id = "test_variant"
        messages = [
            ChatMessage(role="system", content="You are a helpful assistant."),
            ChatMessage(role="user", content="Hello!")
        ]
        
        # Mock variant manager to return a variant
        mock_variant = MagicMock()
        variant_manager.get_variant.return_value = mock_variant
        
        # Mock inspect response
        mock_inspect = MagicMock()
        mock_inspect.top.return_value = [
            MagicMock(feature=MagicMock(label="feature1"), activation=0.8),
            MagicMock(feature=MagicMock(label="feature2"), activation=0.6)
        ]
        ember_client.features.inspect.return_value = mock_inspect
        
        # Act
        result = await feature_service.inspect_features(
            messages=messages,
            session_id=session_id,
            variant_id=variant_id
        )
        
        # Assert
        assert result is not None
        assert len(result) == 2
        assert isinstance(result[0], FeatureActivation)
        assert result[0].label == "feature1"
        assert result[0].activation == 0.8
        assert result[1].label == "feature2"
        assert result[1].activation == 0.6
        
        # Verify variant manager was called
        variant_manager.get_variant.assert_called_once_with(session_id, variant_id)
        
        # Verify inspect was called with correct parameters
        ember_client.features.inspect.assert_called_once()

    @pytest.mark.asyncio
    async def test_inspect_features_with_empty_messages(self, feature_service, ember_client, variant_manager):
        """Test inspecting features with an empty message list."""
        # Arrange
        session_id = "test_session"
        variant_id = "test_variant"
        messages = []
        
        # Mock variant manager to return a variant
        mock_variant = MagicMock()
        variant_manager.get_variant.return_value = mock_variant
        
        # Mock inspect response
        mock_inspect = MagicMock()
        mock_inspect.top.return_value = []  # Empty result for empty messages
        ember_client.features.inspect.return_value = mock_inspect
        
        # Act
        result = await feature_service.inspect_features(
            messages=messages,
            session_id=session_id,
            variant_id=variant_id
        )
        
        # Assert
        assert result is not None
        assert isinstance(result, list)
        assert len(result) == 0
        
        # Verify variant manager was called
        variant_manager.get_variant.assert_called_once_with(session_id, variant_id)
        
        # Verify inspect was called with correct parameters
        ember_client.features.inspect.assert_called_once()

    @pytest.mark.asyncio
    async def test_search_features_with_top_k(self, feature_service, ember_client, variant_manager):
        """Test that search_features respects the top_k parameter."""
        # Arrange
        session_id = "test_session"
        variant_id = "test_variant"
        query = "test query"
        top_k = 5
        
        # Mock variant manager to return a variant
        mock_variant = MagicMock()
        variant_manager.get_variant.return_value = mock_variant
        
        # Mock search response
        mock_features = [
            MagicMock(label=f"feature{i}") for i in range(top_k)
        ]
        ember_client.features.search.return_value = mock_features
        
        # Act
        result = await feature_service.search_features(
            query=query,
            session_id=session_id,
            variant_id=variant_id,
            top_k=top_k
        )
        
        # Assert
        assert result is not None
        assert len(result) == top_k
        for i in range(top_k):
            assert isinstance(result[i], FeatureActivation)
            assert result[i].label == f"feature{i}"
        
        # Verify variant manager was called
        variant_manager.get_variant.assert_called_once_with(session_id, variant_id)
        
        # Verify search was called with correct parameters
        ember_client.features.search.assert_called_once_with(
            query=query,
            model=mock_variant,
            top_k=top_k
        )
    
    @pytest.mark.asyncio
    async def test_steer_feature(self, feature_service, ember_client, variant_manager):
        """Test applying steering to a feature."""
        # Arrange
        session_id = "test_session"
        variant_id = "test_variant"
        feature_label = "test_feature"
        value = 0.75
        
        # Mock variant manager to return a variant
        mock_variant = MagicMock()
        mock_variant.set = MagicMock()
        variant_manager.get_variant.return_value = mock_variant
        
        # Mock search response
        mock_feature = MagicMock(label=feature_label)
        ember_client.features.search.return_value = [mock_feature]
        
        # Act
        result = await feature_service.steer_feature(
            session_id=session_id,
            variant_id=variant_id,
            feature_label=feature_label,
            value=value
        )
        
        # Assert
        assert result is not None
        assert result.label == feature_label
        assert result.activation == value
        assert result.modified_value == value
        
        # Verify variant manager was called
        variant_manager.get_variant.assert_called_once_with(session_id, variant_id)
        
        # Verify search was called with correct parameters
        ember_client.features.search.assert_called_once_with(
            feature_label,
            model=mock_variant,
            top_k=1
        )
        
        # Verify set was called on the variant
        mock_variant.set.assert_called_once_with(mock_feature, value)
    
    @pytest.mark.asyncio
    async def test_clear_feature(self, feature_service, ember_client, variant_manager):
        """Test clearing steering from a feature."""
        # Arrange
        session_id = "test_session"
        variant_id = "test_variant"
        feature_label = "test_feature"
        
        # Mock variant manager to return a variant
        mock_variant = MagicMock()
        mock_variant.clear = MagicMock()
        variant_manager.get_variant.return_value = mock_variant
        
        # Mock search response
        mock_feature = MagicMock(label=feature_label)
        ember_client.features.search.return_value = [mock_feature]
        
        # Act
        result = await feature_service.clear_feature(
            session_id=session_id,
            variant_id=variant_id,
            feature_label=feature_label
        )
        
        # Assert
        assert result is not None
        assert result.label == feature_label
        
        # Verify variant manager was called
        variant_manager.get_variant.assert_called_once_with(session_id, variant_id)
        
        # Verify search was called with correct parameters
        ember_client.features.search.assert_called_once_with(
            feature_label,
            model=mock_variant,
            top_k=1
        )
        
        # Verify clear was called on the variant
        mock_variant.clear.assert_called_once_with(mock_feature)
    
    @pytest.mark.asyncio
    async def test_clear_feature_not_steered(self, feature_service, ember_client, variant_manager):
        """Test clearing a feature that wasn't previously steered."""
        # Arrange
        session_id = "test_session"
        variant_id = "test_variant"
        feature_label = "test_feature"
        
        # Mock variant manager to return a variant
        mock_variant = MagicMock()
        mock_variant.clear = MagicMock()
        variant_manager.get_variant.return_value = mock_variant
        
        # Mock search response
        mock_feature = MagicMock(label=feature_label)
        ember_client.features.search.return_value = [mock_feature]
        
        # Act
        result = await feature_service.clear_feature(
            session_id=session_id,
            variant_id=variant_id,
            feature_label=feature_label
        )
        
        # Assert
        assert result is not None
        assert result.label == feature_label
        
        # Verify clear was called on the variant (should still work even if not steered)
        mock_variant.clear.assert_called_once_with(mock_feature)
    
    @pytest.mark.asyncio
    async def test_cluster_features(self, feature_service, llm_client):
        """Test clustering features returns valid result."""
        # Arrange
        session_id = "test_session"
        features = [
            FeatureActivation(label=f"feature{i}", activation=0.5) for i in range(10)
        ]
        
        # Mock the clustering function result
        mock_clusters = [
            FeatureCluster(
                name=f"Cluster {i}",
                features=[features[i*2], features[i*2+1]],
                type="dynamic"
            ) for i in range(5)
        ]
        
        # Patch the cluster_features function
        with patch("src.core.services.feature_service.cluster_features", AsyncMock(return_value=mock_clusters)):
            # Act
            result = await feature_service.cluster_features(
                features=features,
                session_id=session_id,
                num_categories=5
            )
        
        # Assert
        assert result is not None
        assert len(result) == 5
        assert all(isinstance(cluster, FeatureCluster) for cluster in result)
        assert sum(len(cluster.features) for cluster in result) == 10 