import json
import logging
from typing import Dict, List, Optional, Any
from openai import OpenAI, AsyncOpenAI
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