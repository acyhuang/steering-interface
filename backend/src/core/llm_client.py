from typing import Dict, Any, List, Optional
from openai import AsyncOpenAI
import logging
import json
from pydantic import BaseModel
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

class CacheEntry(BaseModel):
    """Model for cache entries."""
    value: Any
    timestamp: datetime

class LLMCache:
    """Simple in-memory cache with TTL for LLM responses."""
    
    def __init__(self, ttl_seconds: int = 3600):
        """Initialize the cache with a TTL.
        
        Args:
            ttl_seconds: Time-to-live in seconds for cache entries
        """
        self.cache: Dict[str, CacheEntry] = {}
        self.ttl = timedelta(seconds=ttl_seconds)
    
    def get(self, key: str) -> Optional[Any]:
        """Get a value from the cache if it exists and is not expired.
        
        Args:
            key: Cache key
            
        Returns:
            Cached value or None if not found or expired
        """
        if key not in self.cache:
            return None
        
        entry = self.cache[key]
        if datetime.now() - entry.timestamp > self.ttl:
            del self.cache[key]
            return None
        
        return entry.value
    
    def set(self, key: str, value: Any) -> None:
        """Set a value in the cache.
        
        Args:
            key: Cache key
            value: Value to cache
        """
        self.cache[key] = CacheEntry(
            value=value,
            timestamp=datetime.now()
        )

class LLMClient:
    """Client for interacting with LLM APIs for auxiliary tasks."""
    
    def __init__(self, api_key: Optional[str] = None, model: str = "gpt-4o-mini"):
        """Initialize the LLM client."""
        if not api_key:
            logger.error("No API key provided for LLM client")
        else:
            logger.debug(f"Initializing LLM client with API key: {api_key[:4]}...{api_key[-4:]}")
        
        self.client = AsyncOpenAI(api_key=api_key)
        self.model = model
        self.cache = LLMCache()
        logger.info(f"Initialized LLM client with model: {model}")
    
    async def cluster_features(
        self, 
        features: List[str], 
        num_categories: int = 5,
        force_refresh: bool = False
    ) -> Dict[str, List[str]]:
        """Cluster features into logical categories using LLM."""
        if not features:
            logger.warning("No features to cluster")
            return {}
        
        # Create a cache key based on the features and num_categories
        cache_key = f"cluster_{hash(tuple(sorted(features)))}_{num_categories}"
        
        # Check cache unless force refresh is requested
        if not force_refresh:
            cached_result = self.cache.get(cache_key)
            if cached_result:
                logger.debug(f"Using cached clustering result for {len(features)} features")
                return cached_result
        
        # Prepare feature list for the prompt
        feature_list = "\n".join([f"- {f}" for f in features])
        
        # Create prompt for LLM
        prompt = f"""
        Below is a list of LLM features/capabilities:
        
        {feature_list}
        
        Group these features into {num_categories-2} broad categories (excluding "Writing Style" and "Reasoning Method" which are handled separately).
        Use general, intuitive categories that group related capabilities.
        
        Format your response as a JSON object with category names as keys and arrays of feature names as values.
        Example format:
        {{
          "Category 1": ["feature1", "feature2"],
          "Category 2": ["feature3", "feature4", "feature5"]
        }}
        """
        
        logger.debug(f"Prompt for LLM clustering:\n{prompt}")
        
        try:
            logger.debug(f"Sending clustering request to OpenAI for {len(features)} features using model {self.model}")
            logger.debug(f"API key status: {'Set' if self.client.api_key else 'Not set'}")
            
            try:
                response = await self.client.chat.completions.create(
                    model=self.model,
                    messages=[{"role": "user", "content": prompt}],
                    response_format={"type": "json_object"},
                    temperature=0.3  # Lower temperature for more consistent results
                )
                
                content = response.choices[0].message.content
                logger.debug(f"Received response from OpenAI: {content}")
                
                try:
                    result = json.loads(content)
                    logger.debug(f"Successfully parsed JSON response with {len(result)} categories")
                    
                    # Cache the result
                    self.cache.set(cache_key, result)
                    
                    logger.debug(f"Successfully clustered {len(features)} features into {len(result)} categories")
                    return result
                except json.JSONDecodeError as json_err:
                    logger.error(f"Failed to parse JSON response: {str(json_err)}")
                    logger.error(f"Raw response content: {content}")
                    raise
            except Exception as api_err:
                logger.error(f"OpenAI API error: {str(api_err)}")
                logger.error(f"API error type: {type(api_err).__name__}")
                raise
        except Exception as e:
            logger.error(f"Error clustering features: {str(e)}")
            logger.error(f"Exception type: {type(e).__name__}")
            logger.error(f"Exception details: {repr(e)}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            # Return a fallback classification
            logger.warning(f"Using fallback classification for {len(features)} features")
            return {"Other": features}

    async def get_json_response(self, prompt: str) -> Dict[str, Any]:
        """Get a JSON response from the LLM.
        
        Args:
            prompt: The prompt to send to the LLM
            
        Returns:
            Dict containing the parsed JSON response
            
        Raises:
            ValueError: If the response cannot be parsed as JSON
        """
        try:
            logger.debug("Sending prompt to LLM", extra={
                "model": self.model,
                "prompt_length": len(prompt)
            })
            
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a helpful assistant that responds only in valid JSON format."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                response_format={"type": "json_object"}
            )
            
            content = response.choices[0].message.content
            
            try:
                result = json.loads(content)
                logger.debug("Successfully parsed JSON response", extra={
                    "response_length": len(content)
                })
                return result
            except json.JSONDecodeError as e:
                logger.error("Failed to parse JSON response", exc_info=True, extra={
                    "content": content,
                    "error": str(e)
                })
                raise ValueError(f"Failed to parse LLM response as JSON: {str(e)}")
                
        except Exception as e:
            logger.error("Error getting LLM response", exc_info=True, extra={
                "error": str(e)
            })
            raise 