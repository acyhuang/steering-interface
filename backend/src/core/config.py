from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Optional, Literal, List, Union
from enum import Enum

class Environment(str, Enum):
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"

class Settings(BaseSettings):
    # API Keys
    EMBER_API_KEY: str
    default_model: str = "meta-llama/Llama-3.3-70B-Instruct"
    
    # OpenAI settings for feature clustering
    OPENAI_API_KEY: str = None
    openai_model: str = "gpt-4o-mini"
    
    # Environment and logging
    APP_ENV: Environment = Environment.DEVELOPMENT
    LOG_LEVEL: Optional[str] = None  # If None, will be determined by environment
    
    # CORS settings - preferred approach is to set FRONTEND_URL in Vercel env vars
    FRONTEND_URL: Optional[str] = None  # Set this in Vercel environment variables
    CORS_ORIGINS: List[str] = []  # Empty default, will use FRONTEND_URL or fallback logic
    
    # Rate limiting
    RATE_LIMIT_MAX_REQUESTS: int = 100
    RATE_LIMIT_WINDOW_SECONDS: int = 3600  # 1 hour
    
    # Vercel-specific settings
    IS_VERCEL: bool = False
    VERCEL_REGION: Optional[str] = None
    VERCEL_ENV: Optional[str] = None
    
    class Config:
        env_file = ".env"
        use_enum_values = True

    @property
    def get_ember_api_key(self) -> str:
        """Validate and return the Ember API key."""
        if not self.EMBER_API_KEY:
            raise ValueError("EMBER_API_KEY environment variable is not set")
        return self.EMBER_API_KEY
        
    @property
    def get_openai_api_key(self) -> Optional[str]:
        """Return the OpenAI API key."""
        return self.OPENAI_API_KEY
    
    @property
    def get_log_level(self) -> str:
        """Get the appropriate log level based on environment."""
        if self.LOG_LEVEL:
            return self.LOG_LEVEL
            
        return {
            Environment.PRODUCTION: "INFO",
            Environment.STAGING: "DEBUG",
            Environment.DEVELOPMENT: "DEBUG"
        }[self.APP_ENV]
        
    @property
    def get_cors_origins(self) -> List[str]:
        """Get CORS allowed origins based on environment.
        
        Priority:
        1. FRONTEND_URL environment variable (preferred for Vercel deployments)
        2. CORS_ORIGINS environment variable (for multiple origins)
        3. Environment-specific fallback defaults
        """
        # First priority: FRONTEND_URL environment variable
        if self.FRONTEND_URL:
            return [self.FRONTEND_URL]
            
        # Second priority: CORS_ORIGINS environment variable (for multiple origins)
        if self.CORS_ORIGINS and len(self.CORS_ORIGINS) > 0:
            return self.CORS_ORIGINS
            
        # Fallback to environment-specific defaults (mainly for local development)
        return {
            Environment.PRODUCTION: ["https://steering-interface.vercel.app"],  # Fallback if FRONTEND_URL not set
            Environment.STAGING: ["https://steering-interface-preview.vercel.app"],  # Fallback for staging
            Environment.DEVELOPMENT: ["http://localhost:5173"]  # Local development default
        }[self.APP_ENV]
    
    @property
    def is_vercel_deployment(self) -> bool:
        """Check if running on Vercel."""
        return self.IS_VERCEL or bool(self.VERCEL_ENV)
        
    @property
    def get_rate_limit_settings(self) -> dict:
        """Return rate limit settings."""
        return {
            "max_requests": self.RATE_LIMIT_MAX_REQUESTS,
            "time_window": self.RATE_LIMIT_WINDOW_SECONDS
        }

@lru_cache()
def get_settings() -> Settings:
    """Get application settings with memoization."""
    settings = Settings()
    
    # Check for Vercel environment
    if settings.VERCEL_ENV:
        # Update environment based on Vercel deployment
        if settings.VERCEL_ENV == "production":
            settings.APP_ENV = Environment.PRODUCTION
        elif settings.VERCEL_ENV == "preview":
            settings.APP_ENV = Environment.STAGING
        settings.IS_VERCEL = True
        
    return settings 