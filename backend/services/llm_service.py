import logging
from typing import List, Dict, Optional
import openai
from openai import AsyncOpenAI

from ..core.config import settings
from ..schemas.feature import UnifiedFeature

logger = logging.getLogger(__name__)


class LLMService:
    """
    Service for handling OpenAI API calls for auto-steer functionality.
    Handles keyword generation and feature selection based on user queries.
    """
    
    def __init__(self):
        """Initialize OpenAI client with API key from settings."""
        if not settings.OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY not set in environment variables")
        
        self.client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        logger.info("LLMService initialized with OpenAI client")
    
    def _get_keyword_generation_functions(self) -> List[Dict]:
        """Get function schema for keyword generation."""
        return [
            {
                "name": "generate_keywords",
                "description": "Generate search keywords for AI model feature discovery",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "keywords": {
                            "type": "array",
                            "items": {"type": "string"},
                            "minItems": 1,
                            "maxItems": 5,
                            "description": "Keywords for searching AI model features"
                        }
                    },
                    "required": ["keywords"]
                }
            }
        ]
    
    def _get_feature_selection_functions(self) -> List[Dict]:
        """Get function schema for feature selection."""
        return [
            {
                "name": "select_features",
                "description": "Select AI model features to modify for behavior steering",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "selections": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "feature_uuid": {
                                        "type": "string",
                                        "description": "UUID of the feature to modify"
                                    },
                                    "modification_value": {
                                        "type": "number",
                                        "minimum": -0.6,
                                        "maximum": 0.6,
                                        "description": "Modification value between -0.6 and 0.6"
                                    }
                                },
                                "required": ["feature_uuid", "modification_value"]
                            },
                            "minItems": 1,
                            "maxItems": 2,
                            "description": "Selected features with modification values"
                        }
                    },
                    "required": ["selections"]
                }
            }
        ]
    
    async def generate_search_keywords(
        self,
        user_query: str,
        conversation_context: Optional[List[str]] = None,
        current_modifications: Optional[Dict[str, float]] = None
    ) -> List[str]:
        """
        Generate search keywords based on user query and context.
        
        Uses a three-step process:
        1. Intent Analysis - understand what user is trying to achieve
        2. Persona Design - design optimal AI assistant persona
        3. Keyword Generation - extract keywords from the designed persona
        
        Args:
            user_query: The user's current query/message
            conversation_context: Last 3 messages for context (optional)
            current_modifications: Current feature modifications (feature labels + values)
            
        Returns:
            List[str]: Up to 5 keywords for feature search
            
        Raises:
            Exception: If OpenAI API call fails
        """
        logger.info(f"Generating search keywords for query: '{user_query}'")
        
        # Build context information
        context_info = ""
        if conversation_context:
            context_info += f"Recent conversation:\n"
            for i, msg in enumerate(conversation_context[-3:], 1):
                context_info += f"{i}. {msg}\n"
            context_info += "\n"
        
        if current_modifications:
            context_info += f"Current feature modifications:\n"
            for feature_label, value in current_modifications.items():
                context_info += f"- {feature_label}: {value}\n"
            context_info += "\n"
        
        prompt = f"""You are an expert at analyzing user intent and designing AI assistant personas for optimal steering.

{context_info}User Query: "{user_query}"

Please follow this three-step process:

**Step 1: Intent Analysis**
- What is the user trying to achieve?
- What level of expertise is required?
- What type of response would be most helpful?

**Step 2: Persona Design**
Based on the intent analysis, design an AI assistant persona that would be optimal for responding.
Consider:
- What role should the assistant take?
- What communication style would be most effective?
- What problem-solving approach would work best?

**Step 3: Keyword Generation**
Based on the designed persona, generate at most 5 keywords that would help find AI model features to steer the assistant's behavior in that direction."""

        try:
            # Try function calling first
            response = await self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are an expert at analyzing user intent and designing AI assistant personas."},
                    {"role": "user", "content": prompt}
                ],
                functions=self._get_keyword_generation_functions(),
                function_call={"name": "generate_keywords"},
                max_tokens=500,
                temperature=0.7
            )
            
            # Extract keywords from function call
            function_call = response.choices[0].message.function_call
            if function_call and function_call.name == "generate_keywords":
                import json
                args = json.loads(function_call.arguments)
                keywords = args.get('keywords', [])
                logger.info(f"Generated {len(keywords)} keywords via function calling: {keywords}")
                # Truncate keywords to fit query length limit
                truncated_keywords = self._truncate_keywords_to_query_limit(keywords)
                return truncated_keywords
            
        except Exception as e:
            logger.warning(f"Function calling failed, falling back to JSON parsing: {str(e)}")
        
        # Fallback to original JSON parsing approach
        try:
            response = await self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are an expert at analyzing user intent and designing AI assistant personas."},
                    {"role": "user", "content": prompt + "\n\nRespond with JSON only: {\"keywords\": [\"word1\", \"word2\", \"word3\", \"word4\", \"word5\"]}"}
                ],
                max_tokens=500,
                temperature=0.7
            )
            
            content = response.choices[0].message.content
            logger.debug(f"OpenAI response: {content}")
            
            # Extract keywords from response
            keywords = self._extract_keywords(content)
            logger.info(f"Generated {len(keywords)} keywords via fallback: {keywords}")
            # Truncate keywords to fit query length limit
            truncated_keywords = self._truncate_keywords_to_query_limit(keywords)
            return truncated_keywords
            
        except Exception as e:
            logger.error(f"Error generating search keywords: {str(e)}")
            raise Exception(f"Failed to generate search keywords: {str(e)}")
    
    async def select_features_to_modify(
        self,
        search_results: List[UnifiedFeature],
        user_query: str,
        current_modifications: Optional[Dict[str, float]] = None
    ) -> Dict[str, float]:
        """
        Select 1-2 features from search results and suggest modification values.
        
        Args:
            search_results: List of UnifiedFeature objects from feature search
            user_query: The user's original query
            current_modifications: Current feature modifications (optional)
            
        Returns:
            Dict[str, float]: Mapping of feature_uuid -> modification_value (1-2 features)
            
        Raises:
            Exception: If OpenAI API call fails
        """
        logger.info(f"Selecting features to modify from {len(search_results)} search results")
        
        if not search_results:
            logger.warning("No search results provided for feature selection")
            return {}
        
        # Build feature list for LLM
        features_info = ""
        for i, feature in enumerate(search_results, 1):
            features_info += f"{i}. {feature.label} (UUID: {feature.uuid})\n"
            if feature.activation is not None:
                features_info += f"   Current activation: {feature.activation}\n"
            if feature.modification != 0.0:
                features_info += f"   Current modification: {feature.modification}\n"
            features_info += "\n"
        
        current_mods_info = ""
        if current_modifications:
            current_mods_info = f"Current modifications:\n"
            for label, value in current_modifications.items():
                current_mods_info += f"- {label}: {value}\n"
            current_mods_info += "\n"
        
        prompt = f"""You are an expert at selecting AI model features for steering behavior.

{current_mods_info}User Query: "{user_query}"

Available features from search:
{features_info}

Please select 1-2 features that would best help achieve the user's intent. For each selected feature, suggest a modification value between -0.6 and 0.6 in increments of 0.2:
- Positive values (0.1 to 0.6) increase the feature's influence
- Negative values (-0.1 to -0.6) decrease the feature's influence
- Values closer to 0 have subtle effects, values closer to ±1 have strong effects

Consider:
- Which features are most relevant to the user's request?
- What modification strength would be appropriate?
- Don't over-modify (avoid too many features or extreme values)"""

        try:
            # Try function calling first
            response = await self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are an expert at selecting and modifying AI model features for behavior steering."},
                    {"role": "user", "content": prompt}
                ],
                functions=self._get_feature_selection_functions(),
                function_call={"name": "select_features"},
                max_tokens=400,
                temperature=0.5
            )
            
            # Extract selections from function call
            function_call = response.choices[0].message.function_call
            if function_call and function_call.name == "select_features":
                import json
                args = json.loads(function_call.arguments)
                selections_data = args.get('selections', [])
                
                # Convert to expected format (feature_uuid -> modification_value)
                selections = {}
                for selection in selections_data:
                    feature_uuid = selection.get('feature_uuid')
                    modification_value = selection.get('modification_value')
                    if feature_uuid and modification_value is not None:
                        selections[feature_uuid] = float(modification_value)
                
                logger.info(f"Selected {len(selections)} features via function calling: {list(selections.keys())}")
                return selections
            
        except Exception as e:
            logger.warning(f"Function calling failed, falling back to JSON parsing: {str(e)}")
        
        # Fallback to original JSON parsing approach
        try:
            response = await self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are an expert at selecting and modifying AI model features for behavior steering."},
                    {"role": "user", "content": prompt + "\n\nRespond with JSON only: {\n  \"selections\": [\n    {\"label\": \"explanation style\", \"value\": 0.4},\n    {\"label\": \"beginner friendly\", \"value\": -0.2}\n  ]\n}"}
                ],
                max_tokens=400,
                temperature=0.5
            )
            
            content = response.choices[0].message.content
            logger.debug(f"OpenAI response: {content}")
            
            # Extract feature selections from response
            selections = self._extract_feature_selections(content, search_results)
            logger.info(f"Selected {len(selections)} features via fallback: {list(selections.keys())}")
            return selections
            
        except Exception as e:
            logger.error(f"Error selecting features to modify: {str(e)}")
            raise Exception(f"Failed to select features to modify: {str(e)}")
    
    def _extract_keywords(self, content: str) -> List[str]:
        """Extract keywords from OpenAI JSON response."""
        try:
            import json
            
            # Try to parse the entire response as JSON
            response_data = json.loads(content.strip())
            keywords = response_data.get('keywords', [])
            
            # Validate and clean keywords
            if isinstance(keywords, list):
                # Clean up keywords (lowercase, strip whitespace)
                keywords = [kw.strip().lower() for kw in keywords if isinstance(kw, str) and kw.strip()]
                # Limit to 5 keywords
                keywords = keywords[:5]
                logger.debug(f"Extracted keywords from JSON: {keywords}")
                return keywords
            else:
                logger.warning(f"Keywords field is not a list: {keywords}")
                return []
                
        except json.JSONDecodeError as e:
            logger.warning(f"Could not parse JSON response: {str(e)}")
            logger.debug(f"Raw response content: {content}")
            
            # Fallback: try to extract JSON from the response
            try:
                # Look for JSON-like content in the response
                import re
                json_match = re.search(r'\{[^}]*"keywords"[^}]*\}', content)
                if json_match:
                    json_str = json_match.group(0)
                    response_data = json.loads(json_str)
                    keywords = response_data.get('keywords', [])
                    if isinstance(keywords, list):
                        keywords = [kw.strip().lower() for kw in keywords if isinstance(kw, str) and kw.strip()]
                        return keywords[:5]
            except Exception as fallback_e:
                logger.warning(f"Fallback JSON extraction failed: {str(fallback_e)}")
            
            return []
            
        except Exception as e:
            logger.error(f"Error extracting keywords: {str(e)}")
            return []
    
    def _extract_feature_selections(self, content: str, search_results: List[UnifiedFeature]) -> Dict[str, float]:
        """Extract feature selections from OpenAI JSON response."""
        try:
            import json
            
            # Try to parse the entire response as JSON
            response_data = json.loads(content.strip())
            selections_data = response_data.get('selections', [])
            
            selections = {}
            
            # Validate and process selections
            if isinstance(selections_data, list):
                for selection in selections_data:
                    if isinstance(selection, dict):
                        label = selection.get('label', '').strip()
                        value = selection.get('value')
                        
                        if label and value is not None:
                            try:
                                value_float = float(value)
                                # Validate value range (-0.6 to 0.6 as per your update)
                                if -0.6 <= value_float <= 0.6:
                                    # Find the feature UUID by matching the label
                                    feature_uuid = self._find_feature_uuid_by_label(label, search_results)
                                    if feature_uuid:
                                        selections[feature_uuid] = value_float
                                        logger.debug(f"Selected feature '{label}' (UUID: {feature_uuid}) with value {value_float}")
                                    else:
                                        logger.warning(f"Could not find feature with label '{label}' in search results")
                                else:
                                    logger.warning(f"Feature '{label}' has value {value_float} outside range [-0.6, 0.6], skipping")
                            except (ValueError, TypeError) as e:
                                logger.warning(f"Invalid value for feature '{label}': {value}, error: {str(e)}")
                                continue
                        else:
                            logger.warning(f"Invalid selection format: {selection}")
                    else:
                        logger.warning(f"Selection is not a dict: {selection}")
            else:
                logger.warning(f"Selections field is not a list: {selections_data}")
                return {}
            
            # Limit to 2 features maximum
            if len(selections) > 2:
                logger.warning(f"Too many features selected ({len(selections)}), limiting to 2")
                selections = dict(list(selections.items())[:2])
            
            logger.debug(f"Extracted {len(selections)} feature selections from JSON")
            return selections
            
        except json.JSONDecodeError as e:
            logger.warning(f"Could not parse JSON response: {str(e)}")
            logger.debug(f"Raw response content: {content}")
            
            # Fallback: try to extract JSON from the response
            try:
                import re
                json_match = re.search(r'\{[^}]*"selections"[^}]*\}', content)
                if json_match:
                    json_str = json_match.group(0)
                    response_data = json.loads(json_str)
                    selections_data = response_data.get('selections', [])
                    
                    selections = {}
                    if isinstance(selections_data, list):
                        for selection in selections_data:
                            if isinstance(selection, dict):
                                label = selection.get('label', '').strip()
                                value = selection.get('value')
                                if label and value is not None:
                                    try:
                                        value_float = float(value)
                                        if -0.6 <= value_float <= 0.6:
                                            feature_uuid = self._find_feature_uuid_by_label(label, search_results)
                                            if feature_uuid:
                                                selections[feature_uuid] = value_float
                                    except (ValueError, TypeError):
                                        continue
                    return selections
            except Exception as fallback_e:
                logger.warning(f"Fallback JSON extraction failed: {str(fallback_e)}")
            
            return {}
            
        except Exception as e:
            logger.error(f"Error extracting feature selections: {str(e)}")
            return {}
    
    def _truncate_keywords_to_query_limit(self, keywords: List[str], max_length: int = 100) -> List[str]:
        """
        Truncate keywords to ensure the combined query stays under the character limit.
        
        Args:
            keywords: List of keyword strings
            max_length: Maximum allowed length for the combined query (default: 100)
            
        Returns:
            List[str]: Truncated keywords that fit within the limit
        """
        if not keywords:
            return keywords
        
        # Join keywords with spaces to simulate the actual query
        current_query = " ".join(keywords)
        
        if len(current_query) <= max_length:
            return keywords
        
        logger.warning(f"Keywords query too long ({len(current_query)} chars), truncating to fit {max_length} char limit")
        
        # Truncate keywords one by one from the end until we fit
        truncated_keywords = keywords.copy()
        
        while truncated_keywords and len(" ".join(truncated_keywords)) > max_length:
            truncated_keywords.pop()
        
        # If we still don't fit, try truncating individual keywords
        if truncated_keywords:
            final_query = " ".join(truncated_keywords)
            if len(final_query) > max_length:
                # Truncate the last keyword to fit
                last_keyword = truncated_keywords[-1]
                remaining_space = max_length - len(" ".join(truncated_keywords[:-1])) - 1  # -1 for space
                
                if remaining_space > 0:
                    truncated_keywords[-1] = last_keyword[:remaining_space]
                else:
                    truncated_keywords.pop()
        
        final_query = " ".join(truncated_keywords)
        logger.info(f"Truncated keywords from {len(keywords)} to {len(truncated_keywords)} items: '{final_query}' ({len(final_query)} chars)")
        
        return truncated_keywords

    def _find_feature_uuid_by_label(self, label: str, search_results: List[UnifiedFeature]) -> Optional[str]:
        """Find feature UUID by matching label (case-insensitive, partial matching)."""
        try:
            label_lower = label.lower().strip()
            
            # First try exact match
            for feature in search_results:
                if feature.label.lower().strip() == label_lower:
                    return feature.uuid
            
            # Then try partial match (contains)
            for feature in search_results:
                if label_lower in feature.label.lower() or feature.label.lower() in label_lower:
                    return feature.uuid
            
            # Finally try word-based matching
            label_words = set(label_lower.split())
            for feature in search_results:
                feature_words = set(feature.label.lower().split())
                # If at least 50% of words match
                if len(label_words & feature_words) >= max(1, len(label_words) * 0.5):
                    return feature.uuid
            
            logger.debug(f"No matching feature found for label '{label}'")
            return None
            
        except Exception as e:
            logger.error(f"Error finding feature UUID for label '{label}': {str(e)}")
            return None
