#!/bin/bash
#
# Deploy Script - Full deployment workflow for SEU-WuHub
#
# This script performs a complete deployment including:
#   - Code pull/update
#   - Dependency installation
#   - Database initialization (if needed)
#   - Service restart
#   - Health verification
#
# Usage: bash scripts/deploy.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "========================================"
echo "SEU-WuHub 部署"
echo "========================================"
echo "时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# Change to project root
cd "${PROJECT_ROOT}"

# 1. Backup current state
echo "1. 备份当前状态..."
if [ -d "data/lancedb" ]; then
    BACKUP_NAME="campus-$(date +%Y%m%d-%H%M%S).tar.gz"
    mkdir -p backups
    tar -czf "backups/${BACKUP_NAME}" data/lancedb 2>/dev/null || true
    echo -e "  ${GREEN}备份已创建: backups/${BACKUP_NAME}${NC}"
else
    echo -e "  ${YELLOW}跳过备份 (无数据目录)${NC}"
fi

# 2. Stop service
echo ""
echo "2. 停止服务..."
bash "${SCRIPT_DIR}/stop.sh" 2>/dev/null || true

# 3. Update code
echo ""
echo "3. 更新代码..."
if [ -d ".git" ]; then
    git pull origin main 2>/dev/null || echo -e "  ${YELLOW}Git 更新失败或非 Git 仓库${NC}"
else
    echo -e "  ${YELLOW}非 Git 仓库，跳过${NC}"
fi

# 4. Install dependencies
echo ""
echo "4. 安装依赖..."

# Backend dependencies
if [ -f "backend/pyproject.toml" ]; then
    echo "  安装后端依赖..."
    cd backend
    if command -v uv >/dev/null 2>&1; then
        uv sync 2>/dev/null || uv pip install -e . 2>/dev/null || true
    else
        pip install -e . 2>/dev/null || true
    fi
    cd "${PROJECT_ROOT}"
else
    echo -e "  ${YELLOW}后端依赖安装跳过 (无 pyproject.toml)${NC}"
fi

# Frontend dependencies
if [ -f "frontend/package.json" ]; then
    echo "  安装前端依赖..."
    cd frontend
    npm install 2>/dev/null || npm ci 2>/dev/null || echo -e "  ${YELLOW}前端依赖安装失败${NC}"
    cd "${PROJECT_ROOT}"
else
    echo -e "  ${YELLOW}前端依赖安装跳过 (无 package.json)${NC}"
fi

# 5. Ensure directories exist
echo ""
echo "5. 创建必要目录..."
mkdir -p data/lancedb logs tmp config/websites backups

# 6. Start service
echo ""
echo "6. 启动服务..."
bash "${SCRIPT_DIR}/start.sh"

# 7. Health check
echo ""
echo "7. 健康检查..."
sleep 3
if curl -s -f http://localhost:8000/health >/dev/null 2>&1; then
    echo -e "  ${GREEN}服务健康检查通过${NC}"
else
    echo -e "  ${RED}服务健康检查失败${NC}"
    echo "  请检查日志: logs/backend.log"
fi

echo ""
echo "========================================"
echo "部署完成"
echo "时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================"