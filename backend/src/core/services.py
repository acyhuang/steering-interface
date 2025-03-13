from typing import AsyncGenerator, List, Optional, Dict, Any
from goodfire import AsyncClient, Variant
from ..models.chat import ChatMessage, ChatRequest, ChatResponse
from ..models.features import (
    FeatureActivation, 
    SteerFeatureResponse, 
    ClearFeatureResponse, 
    ModifiedFeature, 
    FeatureCluster,
    ClusteredFeaturesResponse,
    PersonaAnalysis,
    FeatureAnalysis,
    FeatureImportance,
    QueryAnalysisResponse
)
import logging
from .config import Settings
import json
from .llm_client import LLMClient
from .clustering import cluster_features
from .logging import log_timing, with_correlation_id

# Initialize logger
logger = logging.getLogger(__name__)

# logger.setLevel(logging.DEBUG)

class EmberService:
    """Service for interacting with the Ember API.
    
    This service manages a single client instance and provides methods
    for all Ember API operations including chat, feature steering, and
    configuration management.
    """
    
    def __init__(self, settings: Settings) -> None:
        """Initialize the Ember service with configuration.
        
        Args:
            settings: Application settings including API keys
        """
        self.client = AsyncClient(settings.get_ember_api_key)
        self.settings = settings
        
        # Initialize LLM client with API key from settings
        api_key = settings.get_openai_api_key
        logger.info("Initializing EmberService", extra={
            "api_key_set": bool(api_key),
            "model": settings.openai_model
        })
        
        self.llm_client = LLMClient(
            api_key=api_key,
            model=settings.openai_model
        )
        
        # Store variants by session_id -> variant_id -> variant
        self.variants: Dict[str, Dict[str, Variant]] = {}
        logger.info(f"Initialized EmberService with default model: {settings.default_model}")
    
    def _get_default_variant(self, session_id: str) -> Variant:
        """Get or create the default variant for a session."""
        if session_id not in self.variants:
            self.variants[session_id] = {}
        
        if "default" not in self.variants[session_id]:
            logger.debug("Creating default variant", extra={
                "session_id": session_id,
                "model": self.settings.default_model
            })
            self.variants[session_id]["default"] = Variant(self.settings.default_model)
        
        return self.variants[session_id]["default"]
    
    @with_correlation_id()
    async def create_variant(self, session_id: str, variant_id: str, base_variant_id: Optional[str] = None) -> Variant:
        """Create a new variant, optionally based on an existing one."""
        logger.info("Creating new variant", extra={
            "session_id": session_id,
            "variant_id": variant_id,
            "base_variant_id": base_variant_id
        })
        
        if session_id not in self.variants:
            self.variants[session_id] = {}
            
        if base_variant_id:
            base = self.variants[session_id].get(base_variant_id)
            if not base:
                logger.error("Base variant not found", extra={
                    "session_id": session_id,
                    "base_variant_id": base_variant_id
                })
                raise ValueError(f"Base variant {base_variant_id} not found")
            
            # Create new variant with same settings as base
            new_variant = Variant(base.model_name)
        else:
            # Create fresh variant
            new_variant = Variant(self.settings.default_model)
            
        self.variants[session_id][variant_id] = new_variant
        logger.debug("Variant created successfully", extra={
            "session_id": session_id,
            "variant_id": variant_id,
            "model": new_variant.model_name
        })
        
        return new_variant
    
    @with_correlation_id()
    async def get_variant(self, session_id: str, variant_id: Optional[str] = None) -> Variant:
        """Get a variant by session_id and variant_id.
        
        Args:
            session_id: Session ID
            variant_id: Optional variant ID (defaults to "default")
            
        Returns:
            Variant object
        """
        variant_id = variant_id or "default"
        logger.debug("Getting variant", extra={
            "session_id": session_id,
            "variant_id": variant_id
        })
        
        try:
            # Check if we have this variant cached
            if session_id in self.variants and variant_id in self.variants[session_id]:
                logger.debug("Using cached variant", extra={
                    "session_id": session_id,
                    "variant_id": variant_id
                })
                return self.variants[session_id][variant_id]
            
            # Create a new variant
            logger.info("Creating new variant", extra={
                "session_id": session_id,
                "variant_id": variant_id
            })
            variant = self._get_default_variant(session_id)
            
            # Cache the variant
            if session_id not in self.variants:
                self.variants[session_id] = {}
            self.variants[session_id][variant_id] = variant
            
            return variant
        except Exception as e:
            logger.error("Error getting variant", exc_info=True, extra={
                "session_id": session_id,
                "variant_id": variant_id,
                "error": str(e)
            })
            return self._get_default_variant(session_id)
    
    @with_correlation_id()
    @log_timing(logger)
    async def create_chat_completion(
        self,
        messages: List[ChatMessage],
        session_id: str,
        variant_id: Optional[str] = None,
        stream: bool = False,
        max_completion_tokens: Optional[int] = 512,
        temperature: Optional[float] = 0.7,
        top_p: Optional[float] = 0.9
    ) -> ChatResponse:
        """Create a chat completion using the Ember API."""
        try:
            logger.debug("Creating chat completion", extra={
                "session_id": session_id,
                "variant_id": variant_id,
                "message_count": len(messages)
            })
            
            # Get variant asynchronously
            variant = await self.get_variant(session_id, variant_id)
            
            # Log full variant state at DEBUG level
            logger.debug("Using variant configuration", extra={
                "session_id": session_id,
                "variant_id": variant_id,
                "stream": stream,
                "max_tokens": max_completion_tokens,
                "temperature": temperature,
                "top_p": top_p,
                "variant_state": variant.json()
            })
            
            response = await self.client.chat.completions.create(
                messages=[{"role": msg.role, "content": msg.content} for msg in messages],
                model=variant,
                stream=stream,
                max_completion_tokens=max_completion_tokens or 512,
                temperature=temperature or 0.7,
                top_p=top_p or 0.9
            )
            
            content = response.choices[0].message["content"] if response.choices else ""
            
            # Convert variant.json() to a JSON string
            variant_json_str = json.dumps(variant.json())
            
            logger.debug("Chat completion successful", extra={
                "session_id": session_id,
                "variant_id": variant_id,
                "content_length": len(content)
            })
            
            return ChatResponse(
                content=content,
                variant_id=variant_id or "default",
                variant_json=variant_json_str
            )
            
        except Exception as e:
            logger.error("Chat completion failed", exc_info=True, extra={
                "session_id": session_id,
                "variant_id": variant_id,
                "error": str(e)
            })
            raise

    @with_correlation_id()
    @log_timing(logger)
    async def inspect_features(
        self,
        messages: List[ChatMessage],
        session_id: str,
        variant_id: Optional[str] = None
    ) -> List[FeatureActivation]:
        """Inspect feature activations in the current conversation."""
        try:
            logger.debug("Inspecting features", extra={
                "session_id": session_id,
                "variant_id": variant_id,
                "message_count": len(messages)
            })
            
            variant = await self.get_variant(session_id, variant_id)
            
            inspector = await self.client.features.inspect(
                messages=[{"role": msg.role, "content": msg.content} for msg in messages],
                model=variant
            )
            
            activations = []
            for activation in inspector.top(k=20):
                activations.append(FeatureActivation(
                    label=activation.feature.label,
                    activation=activation.activation
                ))
            
            logger.debug("Feature inspection complete", extra={
                "session_id": session_id,
                "variant_id": variant_id,
                "activation_count": len(activations)
            })
            
            return activations
            
        except Exception as e:
            logger.error("Feature inspection failed", exc_info=True, extra={
                "session_id": session_id,
                "variant_id": variant_id,
                "error": str(e)
            })
            raise

    @with_correlation_id()
    @log_timing(logger)
    async def steer_feature(
        self,
        session_id: str,
        variant_id: Optional[str],
        feature_label: str,
        value: float
    ) -> SteerFeatureResponse:
        """Steer a feature's activation value."""
        try:
            logger.info("Steering feature", extra={
                "session_id": session_id,
                "variant_id": variant_id,
                "feature": feature_label,
                "value": value
            })
            
            variant = await self.get_variant(session_id, variant_id)
            
            # Search for the feature
            features = await self.client.features.search(
                feature_label,
                model=variant,
                top_k=1
            )
            
            if not features:
                logger.warning("Feature not found", extra={
                    "session_id": session_id,
                    "variant_id": variant_id,
                    "feature": feature_label
                })
                raise ValueError(f"Feature '{feature_label}' not found")
                
            feature = features[0]
            
            # Apply the steering
            variant.set(feature, value)
            logger.debug("Feature steering applied", extra={
                "session_id": session_id,
                "variant_id": variant_id,
                "feature": feature_label,
                "value": value
            })
            
            # Return response with the values we set
            return SteerFeatureResponse(
                label=feature_label,
                activation=value,
                modified_value=value
            )
            
        except Exception as e:
            logger.error("Feature steering failed", exc_info=True, extra={
                "session_id": session_id,
                "variant_id": variant_id,
                "feature": feature_label,
                "value": value,
                "error": str(e)
            })
            raise

    @with_correlation_id()
    @log_timing(logger)
    async def get_modified_features(self, session_id: str, variant_id: Optional[str] = None) -> Dict:
        """Get the variant's raw JSON state.
        
        Returns the complete variant JSON which includes all modifications and settings.
        """
        try:
            logger.debug("Getting modified features", extra={
                "session_id": session_id,
                "variant_id": variant_id
            })
            
            variant = await self.get_variant(session_id, variant_id)
            variant_json = variant.json()
            
            # Log the complete variant JSON structure
            logger.info("Variant JSON structure", extra={
                "session_id": session_id,
                "variant_id": variant_id,
                "variant_json": variant_json,
                "variant_json_type": str(type(variant_json)),
                "variant_keys": list(variant_json.keys()) if isinstance(variant_json, dict) else None
            })
            
            return variant_json
            
        except Exception as e:
            logger.error("Failed to get modified features", exc_info=True, extra={
                "session_id": session_id,
                "variant_id": variant_id,
                "error": str(e)
            })
            raise

    @with_correlation_id()
    @log_timing(logger)
    async def clear_feature(
        self,
        session_id: str,
        variant_id: Optional[str],
        feature_label: str
    ) -> ClearFeatureResponse:
        """Clear a feature's modifications from the variant."""
        try:
            logger.info("Clearing feature", extra={
                "session_id": session_id,
                "variant_id": variant_id,
                "feature": feature_label
            })
            
            variant = await self.get_variant(session_id, variant_id)
            
            # Search for the feature
            features = await self.client.features.search(
                feature_label,
                model=variant,
                top_k=1
            )
            
            if not features:
                logger.warning("Feature not found for clearing", extra={
                    "session_id": session_id,
                    "variant_id": variant_id,
                    "feature": feature_label
                })
                raise ValueError(f"Feature '{feature_label}' not found")
                
            feature = features[0]
            
            # Clear the feature
            variant.clear(feature)
            logger.debug("Feature cleared", extra={
                "session_id": session_id,
                "variant_id": variant_id,
                "feature": feature_label
            })
            
            # Return response with the cleared feature label
            return ClearFeatureResponse(
                label=feature_label
            )
            
        except Exception as e:
            logger.error("Failed to clear feature", exc_info=True, extra={
                "session_id": session_id,
                "variant_id": variant_id,
                "feature": feature_label,
                "error": str(e)
            })
            raise

    @with_correlation_id()
    @log_timing(logger)
    async def search_features(
        self,
        query: str,
        session_id: str,
        variant_id: Optional[str] = None,
        top_k: Optional[int] = 20
    ) -> List[FeatureActivation]:
        """Search for features based on semantic similarity to a query string."""
        try:
            logger.debug("Starting feature search", extra={
                "session_id": session_id,
                "variant_id": variant_id,
                "query": query,
                "top_k": top_k
            })
            
            variant = await self.get_variant(session_id, variant_id)
            
            # Use the SDK to search for features
            features = await self.client.features.search(
                query=query,
                model=variant,
                top_k=top_k
            )
            
            # Convert to FeatureActivation format
            result = []
            for feature in features:
                # Check if this feature has been modified in the variant
                activation = 0.0
                
                # For now, just use 0.0 as the activation value
                # We'll fix the comparison logic once we understand the object structure
                
                result.append(FeatureActivation(
                    label=feature.label,
                    activation=activation
                ))
            
            logger.info("Feature search completed", extra={
                "session_id": session_id,
                "variant_id": variant_id,
                "query": query,
                "results_count": len(result)
            })
            
            return result
            
        except Exception as e:
            logger.error("Feature search failed", exc_info=True, extra={
                "session_id": session_id,
                "variant_id": variant_id,
                "query": query,
                "error": str(e)
            })
            raise

    async def cluster_features(
        self,
        features: List[FeatureActivation],
        session_id: str,
        variant_id: Optional[str] = None,
        force_refresh: bool = False,
        num_categories: int = 5
    ) -> List[FeatureCluster]:
        """Cluster features into logical groups."""
        try:
            logger.info(f"Starting feature clustering", extra={
                "session_id": session_id,
                "variant_id": variant_id,
                "feature_count": len(features)
            })
            
            # Get the variant
            variant = await self.get_variant(session_id, variant_id)
            
            # Cluster the features
            clusters = await cluster_features(
                llm_client=self.llm_client,
                features=features,
                num_categories=num_categories,
                force_refresh=force_refresh
            )
            
            logger.info("Feature clustering completed", extra={
                "session_id": session_id,
                "variant_id": variant_id,
                "cluster_count": len(clusters),
                "total_features": sum(len(c.features) for c in clusters)
            })
            
            return clusters
            
        except Exception as e:
            logger.error("Feature clustering failed", exc_info=True, extra={
                "session_id": session_id,
                "variant_id": variant_id,
                "feature_count": len(features),
                "error": str(e)
            })
            # Fallback: return a single cluster with all features
            logger.warning("Using fallback: single cluster for all features", extra={
                "session_id": session_id,
                "feature_count": len(features)
            })
            return [FeatureCluster(
                name="All Features",
                features=features,
                type="dynamic"
            )]

    @with_correlation_id()
    @log_timing(logger)
    async def analyze_query(
        self,
        query: str,
        session_id: str,
        variant_id: Optional[str] = None,
        context: Optional[Dict[str, List[ChatMessage]]] = None
    ) -> QueryAnalysisResponse:
        """Analyze a user query to determine optimal persona and feature categories.
        
        This method uses the LLM to:
        1. Analyze the query's intent and required expertise
        2. Determine the optimal persona for responding
        3. Identify relevant feature categories and their importance
        
        Args:
            query: The user's query to analyze
            session_id: Session identifier
            variant_id: Optional variant identifier
            context: Optional conversation context
            
        Returns:
            QueryAnalysisResponse containing persona and feature recommendations
        """
        logger.info("[TRACE] analyze_query called in EmberService", extra={
            "session_id": session_id,
            "variant_id": variant_id,
            "query_length": len(query),
            "has_context": bool(context)
        })
        try:
            logger.info("Starting query analysis", extra={
                "session_id": session_id,
                "variant_id": variant_id,
                "query": query
            })
            
            # Create the analysis prompt
            prompt = f"""Given the following user query, analyze it to determine the optimal AI assistant persona and relevant feature categories.

Query: "{query}"

Step 1: Intent Analysis
- What is the user trying to achieve?
- What level of expertise is required?
- What type of response would be most helpful?

Step 2: Persona Design
Based on the intent analysis, design an AI assistant persona that would be optimal for responding.
Consider:
- What role should the assistant take?
- What communication style would be most effective?
- What problem-solving approach would work best?

Step 3: Feature Categories
For each category below, suggest specific features that would help create this persona, with importance scores (1-4):

1. Writing Style (how the response should be communicated)
2. Reasoning Method (how the assistant should approach the problem)
3. Knowledge Domain (what expertise areas are relevant)

Format your response as JSON:
{{
  "persona": {{
    "role": "string",      // e.g., "writing coach", "technical expert"
    "style": "string",     // communication style description
    "approach": "string"   // problem-solving approach
  }},
  "features": {{
    "style": [
      {{ "label": "string", "importance": 3 }}
    ],
    "reasoning": [
      {{ "label": "string", "importance": 2 }}
    ],
    "knowledge": [
      {{ "label": "string", "importance": 2 }}
    ]
  }}
}}

Ensure feature labels are specific and actionable, like "formal writing", "step by step explanation", or "technical depth".
"""
            # Get analysis from LLM
            try:
                logger.info("[TRACE] Sending prompt to LLM", extra={"prompt": prompt})
                analysis_json = await self.llm_client.get_json_response(prompt)
                logger.debug("Received LLM response", extra={"raw_response": analysis_json})
                
                # Convert the JSON response to our Pydantic models
                persona = PersonaAnalysis(
                    role=analysis_json["persona"]["role"],
                    style=analysis_json["persona"]["style"],
                    approach=analysis_json["persona"]["approach"]
                )
                
                features = FeatureAnalysis(
                    style=[FeatureImportance(**f) for f in analysis_json["features"]["style"]],
                    reasoning=[FeatureImportance(**f) for f in analysis_json["features"]["reasoning"]],
                    knowledge=[FeatureImportance(**f) for f in analysis_json["features"]["knowledge"]]
                )
                
                response = QueryAnalysisResponse(
                    persona=persona,
                    features=features
                )
                
                logger.info("Query analysis completed", extra={
                    "session_id": session_id,
                    "persona_role": persona.role,
                    "feature_counts": {
                        "style": len(features.style),
                        "reasoning": len(features.reasoning),
                        "knowledge": len(features.knowledge)
                    }
                })
                
                # Auto-steer based on analysis
                try:
                    steered_features = await self.auto_steer(
                        analysis=response,
                        session_id=session_id,
                        variant_id=variant_id
                    )
                    logger.debug("Auto-steering applied after analysis", extra={
                        "session_id": session_id,
                        "steered_count": len(steered_features)
                    })
                except Exception as e:
                    logger.error("Failed to apply auto-steering after analysis", exc_info=True, extra={
                        "session_id": session_id,
                        "error": str(e)
                    })
                    # Continue even if auto-steering fails
                
                return response
                
            except Exception as e:
                logger.error("[TRACE] LLM analysis failed", exc_info=True, extra={
                    "session_id": session_id,
                    "error": str(e),
                    "error_type": type(e).__name__
                })
                raise
                
        except Exception as e:
            logger.error("Query analysis failed", exc_info=True, extra={
                "session_id": session_id,
                "variant_id": variant_id,
                "error": str(e)
            })
            raise

    @with_correlation_id()
    @log_timing(logger)
    async def auto_steer(
        self,
        analysis: QueryAnalysisResponse,
        session_id: str,
        variant_id: Optional[str] = None
    ) -> List[SteerFeatureResponse]:
        """Automatically steer features based on query analysis.
        
        Args:
            analysis: The QueryAnalysisResponse containing persona and feature recommendations
            session_id: Session identifier
            variant_id: Optional variant identifier
            
        Returns:
            List of successfully steered features with their values
        """
        try:
            logger.info("Starting auto-steer", extra={
                "session_id": session_id,
                "variant_id": variant_id,
                "persona_role": analysis.persona.role
            })
            
            steered_features: List[SteerFeatureResponse] = []
            
            # Process all feature categories
            all_features = (
                [("style", f) for f in analysis.features.style] +
                [("reasoning", f) for f in analysis.features.reasoning] +
                [("knowledge", f) for f in analysis.features.knowledge]
            )
            
            for category, feature in all_features:
                try:
                    # Convert importance (1-4) to steering value (0.1-0.4)
                    steering_value = feature.importance / 10.0
                    
                    # Search for the feature
                    search_results = await self.search_features(
                        query=feature.label,
                        session_id=session_id,
                        variant_id=variant_id,
                        top_k=1  # We only need the best match
                    )
                    
                    if not search_results:
                        logger.warning(f"Feature not found: {feature.label}", extra={
                            "session_id": session_id,
                            "category": category,
                            "feature": feature.label
                        })
                        continue
                    
                    # Get the best matching feature
                    best_match = search_results[0]
                    
                    # Apply steering
                    steered = await self.steer_feature(
                        session_id=session_id,
                        variant_id=variant_id,
                        feature_label=best_match.label,
                        value=steering_value
                    )
                    
                    steered_features.append(steered)
                    
                except Exception as e:
                    logger.warning(f"Failed to steer feature {feature.label}", exc_info=True, extra={
                        "session_id": session_id,
                        "category": category,
                        "feature": feature.label,
                        "error": str(e)
                    })
                    continue
            
            # Remove redundant completion log since we have detailed one below
            feature_counts_by_category = {
                "style": 0,
                "reasoning": 0,
                "knowledge": 0
            }
            feature_values_by_category = {
                "style": [],
                "reasoning": [],
                "knowledge": []
            }
            
            for category, feature in all_features:
                if any(sf.label == feature.label for sf in steered_features):
                    feature_counts_by_category[category] += 1
                    feature_values_by_category[category].append(feature.importance / 10.0)
            
            logger.info("[TRACE] Auto-steer results", extra={
                "session_id": session_id,
                "variant_id": variant_id,
                "total_steered": len(steered_features),
                "feature_counts": feature_counts_by_category,
                "average_values": {
                    cat: sum(vals)/len(vals) if vals else 0 
                    for cat, vals in feature_values_by_category.items()
                },
                "success_rate": len(steered_features) / len(all_features) if all_features else 0
            })
            
            return steered_features
            
        except Exception as e:
            logger.error("Auto-steer failed", exc_info=True, extra={
                "session_id": session_id,
                "variant_id": variant_id,
                "error": str(e)
            })
            raise 