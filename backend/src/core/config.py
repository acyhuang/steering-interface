from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Optional

class Settings(BaseSettings):
    EMBER_API_KEY: str
    default_model: str = "meta-llama/Llama-3.3-70B-Instruct"

    class Config:
        env_file = ".env"

    @property
    def get_ember_api_key(self) -> str:
        """Validate and return the Ember API key."""
        if not self.EMBER_API_KEY:
            raise ValueError("EMBER_API_KEY environment variable is not set")
        return self.EMBER_API_KEY

@lru_cache()
def get_settings() -> Settings:
    return Settings() 