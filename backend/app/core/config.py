"""
Configuration Management - Pydantic Settings with environment variables

Responsibilities:
    - LANCE_DB_PATH validation
    - LLM API key management
    - Crawler execution paths for local-only operations
"""

import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # API Settings
    API_V1_PREFIX: str = "/api/v1"
    PROJECT_NAME: str = "SEU-WuHub"

    # LanceDB Settings
    LANCE_DB_PATH: str = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "data", "lancedb")

    # CORS Settings
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:5173"]

    # LLM Settings
    LLM_API_KEY: str | None = None
    LLM_MODEL: str = "deepseek/deepseek-chat"

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
