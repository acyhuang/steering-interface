import pytest
from unittest.mock import MagicMock, AsyncMock, patch
import json
from goodfire import AsyncClient

from src.core.services.completion_service import CompletionService
from src.core.services.interfaces.variant_manager import IVariantManager
from src.core.config import Settings
from src.models.chat import ChatMessage, ChatResponse

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
    # Set up nested attributes and async methods
    client.chat = MagicMock()
    client.chat.completions = MagicMock()
    client.chat.completions.create = AsyncMock()
    return client

@pytest.fixture
def completion_service(ember_client, variant_manager, settings):
    """Create a CompletionService instance for testing."""
    return CompletionService(ember_client, variant_manager, settings)

class TestCompletionService:
    """Test suite for the CompletionService."""
    
    @pytest.mark.asyncio
    async def test_create_chat_completion_with_variant_id(self, completion_service, ember_client, variant_manager):
        """Test creating a chat completion with a specified variant ID."""
        # Arrange
        session_id = "test_session"
        variant_id = "test_variant"
        messages = [
            ChatMessage(role="system", content="You are a helpful assistant."),
            ChatMessage(role="user", content="Hello!")
        ]
        
        # Mock variant manager to return a variant
        mock_variant = MagicMock()
        mock_variant.json.return_value = {"model": "test-model", "features": {}}
        variant_manager.get_variant.return_value = mock_variant
        
        # Mock client response
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message = {"content": "Hello! How can I help you today?"}
        ember_client.chat.completions.create.return_value = mock_response
        
        # Act
        response = await completion_service.create_chat_completion(
            messages=messages,
            session_id=session_id,
            variant_id=variant_id
        )
        
        # Assert
        assert response is not None
        # assert response.content == "Hello! How can I help you today?"
        assert response.variant_id == variant_id
        
        # Verify variant manager was called
        variant_manager.get_variant.assert_called_once_with(session_id, variant_id)
        
        # Verify client was called with correct parameters
        ember_client.chat.completions.create.assert_called_once()
        call_kwargs = ember_client.chat.completions.create.call_args.kwargs
        assert call_kwargs["model"] == mock_variant
        assert call_kwargs["stream"] is False
        assert call_kwargs["max_completion_tokens"] == 512
        assert call_kwargs["temperature"] == 0.7
        assert call_kwargs["top_p"] == 0.9
    
    @pytest.mark.asyncio
    async def test_create_chat_completion_without_variant_id(self, completion_service, ember_client, variant_manager):
        """Test creating a chat completion without a variant ID (should use default)."""
        # Arrange
        session_id = "test_session"
        variant_id = None
        messages = [
            ChatMessage(role="system", content="You are a helpful assistant."),
            ChatMessage(role="user", content="Hello!")
        ]
        
        # Mock variant manager to return a default variant
        mock_variant = MagicMock()
        mock_variant.json.return_value = {"model": "default-model", "features": {}}
        variant_manager.get_variant.return_value = mock_variant
        
        # Mock client response
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message = {"content": "Hi there! How can I assist you?"}
        ember_client.chat.completions.create.return_value = mock_response
        
        # Act
        response = await completion_service.create_chat_completion(
            messages=messages,
            session_id=session_id,
            variant_id=variant_id
        )
        
        # Assert
        assert response is not None
        # assert response.content == "Hi there! How can I assist you?"
        assert response.variant_id == "default"
        
        # Verify variant manager was called with None variant_id
        variant_manager.get_variant.assert_called_once_with(session_id, variant_id)
        
        # Verify client was called with correct parameters
        ember_client.chat.completions.create.assert_called_once()
        call_kwargs = ember_client.chat.completions.create.call_args.kwargs
        assert call_kwargs["model"] == mock_variant
        assert call_kwargs["stream"] is False 