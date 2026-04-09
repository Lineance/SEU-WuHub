FROM python:3.13-slim

WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 复制依赖文件
COPY backend/pyproject.toml backend/uv.lock ./

# 安装 uv
RUN pip install uv

# 安装 Python 依赖
RUN uv sync --frozen --no-install-project

# 复制应用代码
COPY backend/ ./backend/
COPY config/ ./config/

# 暴露端口
EXPOSE 8000

# 启动命令
CMD ["uv", "run", "python", "-m", "backend.app.main"]
