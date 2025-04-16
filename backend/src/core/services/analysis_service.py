from typing import List, Optional, Dict
import logging
from ..config import Settings
from .interfaces.analysis_service import IAnalysisService
from .interfaces.variant_manager import IVariantManager
from .interfaces.feature_service import IFeatureService
from ...models.chat import ChatMessage
from ...models.features import (
    QueryAnalysisResponse,
    SteerFeatureResponse,
    PersonaAnalysis,
    FeatureAnalysis,
    FeatureImportance
)
from ..llm_client import LLMClient
from ..logging import with_correlation_id, log_timing

logger = logging.getLogger(__name__)

class AnalysisService(IAnalysisService):
    """Service for query analysis operations.
    
    This service handles analyzing user queries to determine
    optimal personas and feature configurations.
    """
    
    def __init__(
        self, 
        variant_manager: IVariantManager,
        feature_service: IFeatureService,
        llm_client: LLMClient,
        settings: Settings
    ) -> None:
        """Initialize the analysis service.
        
        Args:
            variant_manager: Variant manager service
            feature_service: Feature service for steering operations
            llm_client: LLM client for analysis operations
            settings: Application settings
        """
        self.variant_manager = variant_manager
        self.feature_service = feature_service
        self.llm_client = llm_client
        self.settings = settings
        logger.info("Initialized AnalysisService")
    
    @with_correlation_id()
    @log_timing(logger)
    async def analyze_query(
        self,
        query: str,
        session_id: str,
        variant_id: Optional[str] = None,
        context: Optional[Dict[str, List[ChatMessage]]] = None
    ) -> QueryAnalysisResponse:
        """Analyze a user query to determine optimal persona and feature categories."""
        logger.info("[TRACE] analyze_query called in AnalysisService", extra={
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
For each category below, suggest 1-2 specific features that would help create this persona, with importance scores (1-4):

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
      {{ "label": "string", "importance": 1 }}
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
        """Automatically steer features based on query analysis."""
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
                    search_results = await self.feature_service.search_features(
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
                    steered = await self.feature_service.steer_feature(
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
            
            # Calculate stats by category
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