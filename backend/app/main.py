"""
SEU-WuHub FastAPI Application

主应用入口，提供完整的 API 路由。
"""

import sys
from pathlib import Path

# 添加项目根目录和 backend 目录到 Python 路径
# 这样可以支持 `from backend.xxx` 的导入方式
_root = Path(__file__).resolve().parents[2]
_backend = Path(__file__).resolve().parents[1]
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))
if str(_backend) not in sys.path:
    sys.path.insert(0, str(_backend))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.v1.articles import router as articles_router
from .api.v1.chat import router as chat_router
from .api.v1.search import router as search_router
from .core.config import settings
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
app.include_router(chat_router, prefix="/api/v1")


@app.on_event("startup")
async def startup_event():
    """启动时预加载向量模型"""
    import logging
    import sys

    logging.basicConfig(level=logging.INFO, stream=sys.stdout, format="%(message)s")
    logger = logging.getLogger(__name__)

    logger.info("Loading embedding models...")

    try:
        # 预加载检索引擎（会加载向量模型）
        from .api.v1.search import get_engine
        _ = get_engine()
        logger.info("Embedding models ready")
    except Exception as e:
        logger.warning(f"Failed to preload models: {e}")


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
