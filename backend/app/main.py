"""
SEU-WuHub FastAPI Application

主应用入口，提供完整的 API 路由。
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import settings
from .api.v1.articles import router as articles_router
from .api.v1.search import router as search_router
from .schemas.common import HealthResponse

# 创建 FastAPI 应用
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="SEU-WuHub AI Agent Backend API",
    debug=settings.DEBUG,
)

# 配置 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(articles_router, prefix="/api/v1")
app.include_router(search_router, prefix="/api/v1")


@app.get("/", tags=["root"])
async def root():
    """根路径"""
    return {
        "message": "Welcome to SEU-WuHub API",
        "version": settings.APP_VERSION,
        "docs": "/docs",
    }


@app.get("/health", response_model=HealthResponse, tags=["health"])
async def health_check():
    """健康检查"""
    return HealthResponse(
        status="healthy",
        version=settings.APP_VERSION,
        database="lancedb",
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
