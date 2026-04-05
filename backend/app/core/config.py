from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    APP_NAME: str = "SEU-WuHub API"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = True

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    # LanceDB
    LANCEDB_PATH: str = "./data/lancedb"

    # Meilisearch
    MEILISEARCH_HOST: str = "http://localhost:7700"
    MEILISEARCH_API_KEY: Optional[str] = None

    # Crawler
    CRAWLER_CONFIG_PATH: str = "./config/crawler.yaml"

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
