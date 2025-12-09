"""Configuration settings for the application."""
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """Application settings."""
    
    # Database (SQLite)
    DATABASE_URL: str = "sqlite:///./datamining.db"
    
    # API
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    DEBUG: bool = True
    
    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:5173"]
    
    # R Plumber API (Isolation Forest model)
    R_API_URL: str = "http://localhost:8001"
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()

