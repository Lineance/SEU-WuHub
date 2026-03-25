"""
FastAPI Application Factory - Main entry point for backend API

Responsibilities:
    - FastAPI instance creation with lifespan management
    - Router registration (articles, search, chat)
    - CORS and middleware configuration
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.v1 import articles, search, chat

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager for startup and shutdown events."""
    logger.info("Starting SEU-WuHub API...")
    yield
    logger.info("Shutting down SEU-WuHub API...")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    lifespan=lifespan,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routers
app.include_router(articles.router, prefix=settings.API_V1_PREFIX, tags=["articles"])
app.include_router(search.router, prefix=settings.API_V1_PREFIX, tags=["search"])
app.include_router(chat.router, prefix=settings.API_V1_PREFIX, tags=["chat"])


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": settings.PROJECT_NAME}
