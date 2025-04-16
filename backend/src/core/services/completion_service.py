from typing import List, Optional, Dict
import logging
import json
from goodfire import AsyncClient
from ..config import Settings
from .interfaces.completion_service import ICompletionService
from .interfaces.variant_manager import IVariantManager
from .interfaces.analysis_service import IAnalysisService
from ...models.chat import ChatMessage, ChatResponse, AutoSteerResult
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
        stream: bool = False,
        max_completion_tokens: Optional[int] = 256,
        temperature: Optional[float] = 0.7,
        top_p: Optional[float] = 0.9
    ) -> ChatResponse:
        """Create a chat completion using the configured LLM."""
        try:
            logger.debug("Creating chat completion", extra={
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
                stream=stream,
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
                            stream=stream,
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
                auto_steer_result=auto_steer_result
            )
            
        except Exception as e:
            logger.error("Chat completion failed", exc_info=True, extra={
                "session_id": session_id,
                "variant_id": variant_id,
                "error": str(e),
                "auto_steer": auto_steer
            })
            raise 