from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Optional, Literal
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
    OPENAI_API_KEY: Optional[str] = None
    openai_model: str = "gpt-4o-mini"
    
    # Environment and logging
    APP_ENV: Environment = Environment.DEVELOPMENT
    LOG_LEVEL: Optional[str] = None  # If None, will be determined by environment

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

@lru_cache()
def get_settings() -> Settings:
    return Settings() 