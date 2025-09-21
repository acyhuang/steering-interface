from typing import List, Optional, Dict, Union, AsyncGenerator
import logging
import json
from goodfire import AsyncClient
from ..config import Settings
from .interfaces.completion_service import ICompletionService
from .interfaces.variant_manager import IVariantManager
from .interfaces.analysis_service import IAnalysisService
from ...models.chat import ChatMessage, ChatResponse, AutoSteerResult, ChatStreamChunk
from ..logging import with_correlation_id, log_timing

logger = logging.getLogger(__name__)

class CompletionService(ICompletionService):
    """Service for generating chat completions.
    
    This service handles the generation of text completions
    from the LLM based on user messages and variant configurations.
    """
    
    def __init__(
        self, 
        client: AsyncClient, 
        variant_manager: IVariantManager,
        analysis_service: IAnalysisService,
        settings: Settings
    ) -> None:
        """Initialize the completion service.
        
        Args:
            client: Ember API client
            variant_manager: Variant manager service
            analysis_service: Analysis service for query analysis
            settings: Application settings
        """
        self.client = client
        self.variant_manager = variant_manager
        self.analysis_service = analysis_service
        self.settings = settings
        logger.info("Initialized CompletionService")
    
    @with_correlation_id()
    @log_timing(logger)
    async def create_chat_completion(
        self,
        messages: List[ChatMessage],
        session_id: str,
        variant_id: Optional[str] = None,
        auto_steer: bool = False,
        stream: bool = True,
        max_completion_tokens: Optional[int] = 256,
        temperature: Optional[float] = 0.7,
        top_p: Optional[float] = 0.9
    ) -> Union[ChatResponse, AsyncGenerator[ChatStreamChunk, None]]:
        """Create a chat completion using the configured LLM."""
        if stream:
            return self._create_streaming_completion(
                messages, session_id, variant_id, auto_steer,
                max_completion_tokens, temperature, top_p
            )
        else:
            return await self._create_regular_completion(
                messages, session_id, variant_id, auto_steer,
                max_completion_tokens, temperature, top_p
            )
    
    async def _create_regular_completion(
        self,
        messages: List[ChatMessage],
        session_id: str,
        variant_id: Optional[str] = None,
        auto_steer: bool = False,
        max_completion_tokens: Optional[int] = 256,
        temperature: Optional[float] = 0.7,
        top_p: Optional[float] = 0.9
    ) -> ChatResponse:
        """Create a regular (non-streaming) chat completion."""
        try:
            logger.debug("Creating regular chat completion", extra={
                "session_id": session_id,
                "variant_id": variant_id,
                "message_count": len(messages),
                "auto_steer": auto_steer
            })
            
            # Get variant from variant manager
            variant = await self.variant_manager.get_variant(session_id, variant_id)
            
            # Log full variant state at DEBUG level
            logger.debug("Using variant configuration", extra={
                "session_id": session_id,
                "variant_id": variant_id,
                "variant_state": variant.json(),
                "auto_steer_enabled": auto_steer
            })
            
            # Generate the original response first
            response = await self.client.chat.completions.create(
                messages=[{"role": msg.role, "content": msg.content} for msg in messages],
                model=variant,
                stream=False,
                max_completion_tokens=max_completion_tokens or 512,
                temperature=temperature or 0.7,
                top_p=top_p or 0.9
            )
            
            original_content = response.choices[0].message["content"] if response.choices else ""
            
            # When auto-steer is enabled, generate a steered response
            auto_steer_result = None
            if auto_steer and messages and messages[-1].role == "user":
                try:
                    logger.info("Auto-steer enabled, generating steered response", extra={
                        "session_id": session_id,
                        "variant_id": variant_id,
                        "user_query": messages[-1].content[:50] + "..." if len(messages[-1].content) > 50 else messages[-1].content
                    })
                    
                    # Step 1: Analyze the query to determine optimal features
                    user_query = messages[-1].content
                    analysis = await self.analysis_service.analyze_query(
                        query=user_query,
                        session_id=session_id,
                        variant_id=variant_id,
                        context={"messages": messages[:-1]} if len(messages) > 1 else None
                    )
                    
                    # Step 2: Generate auto-steer suggestions
                    steered_features = await self.analysis_service.auto_steer(
                        analysis=analysis,
                        session_id=session_id,
                        variant_id=variant_id
                    )
                    
                    # Log the features we're going to apply
                    logger.debug("Auto-steered features to apply", extra={
                        "session_id": session_id,
                        "feature_count": len(steered_features),
                        "features": [
                            {"label": f.label, "value": f.modified_value} 
                            for f in steered_features
                        ]
                    })
                    
                    # Don't continue if no features were suggested
                    if not steered_features:
                        logger.info("No auto-steered features found, skipping steered response")
                        auto_steer_result = None
                    else:
                        # Generate steered response with the suggested features
                        steered_response = await self.client.chat.completions.create(
                            messages=[{"role": msg.role, "content": msg.content} for msg in messages],
                            model=variant,  # The auto_steer call already applied features to this variant
                            stream=False,
                            max_completion_tokens=max_completion_tokens or 512,
                            temperature=temperature or 0.7,
                            top_p=top_p or 0.9
                        )
                        
                        steered_content = steered_response.choices[0].message["content"] if steered_response.choices else ""
                        
                        # Create the auto-steer result
                        auto_steer_result = AutoSteerResult(
                            original_content=original_content,
                            steered_content=steered_content,
                            applied_features=steered_features
                        )
                        
                        logger.info("Successfully generated auto-steered response", extra={
                            "session_id": session_id,
                            "feature_count": len(steered_features),
                            "original_length": len(original_content),
                            "steered_length": len(steered_content)
                        })
                except Exception as e:
                    logger.error("Failed to generate auto-steered response", exc_info=True, extra={
                        "session_id": session_id,
                        "variant_id": variant_id,
                        "error": str(e)
                    })
                    # Continue with just the original response if auto-steer fails
                    auto_steer_result = None
            
            # Decide on the content to return
            final_content = original_content
            
            logger.debug("Chat completion successful", extra={
                "session_id": session_id,
                "variant_id": variant_id,
                "content_length": len(final_content),
                "auto_steer": auto_steer,
                "has_steered_response": auto_steer_result is not None
            })
            
            return ChatResponse(
                content=final_content,
                variant_id=variant_id or "default",
                auto_steered=auto_steer and auto_steer_result is not None,
                auto_steer_result=auto_steer_result,
                variant_json=variant.json()
            )
            
        except Exception as e:
            logger.error("Regular chat completion failed", exc_info=True, extra={
                "session_id": session_id,
                "variant_id": variant_id,
                "error": str(e),
                "auto_steer": auto_steer
            })
            raise
    
    async def _create_streaming_completion(
        self,
        messages: List[ChatMessage],
        session_id: str,
        variant_id: Optional[str] = None,
        auto_steer: bool = False,
        max_completion_tokens: Optional[int] = 256,
        temperature: Optional[float] = 0.7,
        top_p: Optional[float] = 0.9
    ) -> AsyncGenerator[ChatStreamChunk, None]:
        """Create a streaming chat completion."""
        try:
            logger.debug("Creating streaming chat completion", extra={
                "session_id": session_id,
                "variant_id": variant_id,
                "message_count": len(messages),
                "auto_steer": auto_steer
            })
            
            # Get variant from variant manager
            variant = await self.variant_manager.get_variant(session_id, variant_id)
            
            # Log full variant state at DEBUG level
            logger.debug("Using variant configuration", extra={
                "session_id": session_id,
                "variant_id": variant_id,
                "variant_state": variant.json(),
                "auto_steer_enabled": auto_steer
            })
            
            # Handle auto-steer workflow for streaming
            if auto_steer and messages and messages[-1].role == "user":
                # For auto-steer, we need to generate both original and steered responses
                # We'll stream the original first, then the steered response
                async for chunk in self._stream_auto_steer_completion(
                    messages, session_id, variant_id, variant,
                    max_completion_tokens, temperature, top_p
                ):
                    yield chunk
            else:
                # Regular streaming completion
                async for chunk in self._stream_regular_completion(
                    messages, variant, variant_id,
                    max_completion_tokens, temperature, top_p
                ):
                    yield chunk
                    
        except Exception as e:
            logger.error("Streaming chat completion failed", exc_info=True, extra={
                "session_id": session_id,
                "variant_id": variant_id,
                "error": str(e),
                "auto_steer": auto_steer
            })
            # Yield error chunk
            yield ChatStreamChunk(
                type="error",
                error=f"Streaming completion failed: {str(e)}",
                variant_id=variant_id or "default"
            )
    
    async def _stream_regular_completion(
        self,
        messages: List[ChatMessage],
        variant,
        variant_id: Optional[str],
        max_completion_tokens: Optional[int],
        temperature: Optional[float],
        top_p: Optional[float]
    ) -> AsyncGenerator[ChatStreamChunk, None]:
        """Stream a regular completion without auto-steer."""
        try:
            # Create the streaming request
            stream = await self.client.chat.completions.create(
                messages=[{"role": msg.role, "content": msg.content} for msg in messages],
                model=variant,
                stream=True,
                max_completion_tokens=max_completion_tokens or 512,
                temperature=temperature or 0.7,
                top_p=top_p or 0.9
            )
            
            # Stream the response from Ember SDK
            async for chunk in stream:
                # Extract content from the chunk
                content = ""
                if chunk.choices and len(chunk.choices) > 0:
                    delta = chunk.choices[0].delta
                    if hasattr(delta, 'content') and delta.content:
                        content = delta.content
                
                # Yield the chunk
                yield ChatStreamChunk(
                    type="chunk",
                    delta=content,
                    variant_id=variant_id or "default"
                )
            
            # Send completion signal
            yield ChatStreamChunk(
                type="done",
                variant_id=variant_id or "default"
            )
            
        except Exception as e:
            logger.error("Regular streaming failed", exc_info=True)
            yield ChatStreamChunk(
                type="error",
                error=f"Regular streaming failed: {str(e)}",
                variant_id=variant_id or "default"
            )
    
    async def _stream_auto_steer_completion(
        self,
        messages: List[ChatMessage],
        session_id: str,
        variant_id: Optional[str],
        variant,
        max_completion_tokens: Optional[int],
        temperature: Optional[float],
        top_p: Optional[float]
    ) -> AsyncGenerator[ChatStreamChunk, None]:
        """Stream auto-steer completion with both original and steered responses."""
        try:
            logger.info("Auto-steer streaming enabled", extra={
                "session_id": session_id,
                "variant_id": variant_id,
                "user_query": messages[-1].content[:50] + "..." if len(messages[-1].content) > 50 else messages[-1].content
            })
            
            # Step 1: Analyze the query to determine optimal features
            user_query = messages[-1].content
            analysis = await self.analysis_service.analyze_query(
                query=user_query,
                session_id=session_id,
                variant_id=variant_id,
                context={"messages": messages[:-1]} if len(messages) > 1 else None
            )
            
            # Step 2: Generate auto-steer suggestions
            steered_features = await self.analysis_service.auto_steer(
                analysis=analysis,
                session_id=session_id,
                variant_id=variant_id
            )
            
            # Log the features we're going to apply
            logger.debug("Auto-steered features to apply", extra={
                "session_id": session_id,
                "feature_count": len(steered_features),
                "features": [
                    {"label": f.label, "value": f.modified_value} 
                    for f in steered_features
                ]
            })
            
            if not steered_features:
                logger.info("No auto-steered features found, streaming regular response only")
                # Fall back to regular streaming
                async for chunk in self._stream_regular_completion(
                    messages, variant, variant_id,
                    max_completion_tokens, temperature, top_p
                ):
                    yield chunk
                return
            
            # Stream original response first
            original_content = ""
            original_stream = await self.client.chat.completions.create(
                messages=[{"role": msg.role, "content": msg.content} for msg in messages],
                model=variant,
                stream=True,
                max_completion_tokens=max_completion_tokens or 512,
                temperature=temperature or 0.7,
                top_p=top_p or 0.9
            )
            
            async for chunk in original_stream:
                # Extract content from the chunk
                delta_content = ""
                if chunk.choices and len(chunk.choices) > 0:
                    delta = chunk.choices[0].delta
                    if hasattr(delta, 'content') and delta.content:
                        delta_content = delta.content
                        original_content += delta_content
                
                # Yield the chunk for original response
                yield ChatStreamChunk(
                    type="chunk",
                    delta=delta_content,
                    variant_id=variant_id or "default"
                )
            
            # Stream steered response
            steered_content = ""
            steered_stream = await self.client.chat.completions.create(
                messages=[{"role": msg.role, "content": msg.content} for msg in messages],
                model=variant,  # Features already applied by auto_steer
                stream=True,
                max_completion_tokens=max_completion_tokens or 512,
                temperature=temperature or 0.7,
                top_p=top_p or 0.9
            )
            
            async for chunk in steered_stream:
                # Extract content from the chunk
                delta_content = ""
                if chunk.choices and len(chunk.choices) > 0:
                    delta = chunk.choices[0].delta
                    if hasattr(delta, 'content') and delta.content:
                        delta_content = delta.content
                        steered_content += delta_content
                
                # Yield the chunk for steered response
                yield ChatStreamChunk(
                    type="chunk",
                    delta=delta_content,
                    variant_id=variant_id or "default"
                )
            
            # Create auto-steer result
            auto_steer_result = AutoSteerResult(
                original_content=original_content,
                steered_content=steered_content,
                applied_features=steered_features
            )
            
            # Send completion with auto-steer result
            yield ChatStreamChunk(
                type="done",
                variant_id=variant_id or "default",
                auto_steered=True,
                auto_steer_result=auto_steer_result
            )
            
            logger.info("Successfully streamed auto-steered response", extra={
                "session_id": session_id,
                "feature_count": len(steered_features),
                "original_length": len(original_content),
                "steered_length": len(steered_content)
            })
            
        except Exception as e:
            logger.error("Auto-steer streaming failed", exc_info=True, extra={
                "session_id": session_id,
                "variant_id": variant_id,
                "error": str(e)
            })
            yield ChatStreamChunk(
                type="error",
                error=f"Auto-steer streaming failed: {str(e)}",
                variant_id=variant_id or "default"
            ) 