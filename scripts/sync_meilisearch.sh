#!/bin/bash
#
# Sync Meilisearch Script - Synchronize LanceDB data to Meilisearch
#
# This script syncs all documents from LanceDB to Meilisearch.
# Meilisearch will auto-generate embeddings for hybrid search.
#
# Usage: bash scripts/sync_meilisearch.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKEND_DIR="${PROJECT_ROOT}/backend"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "========================================"
echo "SEU-WuHub 同步数据到 Meilisearch"
echo "========================================"
echo "时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# Check if Meilisearch is running
echo -n "检查 Meilisearch 服务... "
if curl -s -f http://localhost:7700/health >/dev/null 2>&1; then
    echo -e "${GREEN}正常${NC}"
else
    echo -e "${RED}失败${NC}"
    echo "Meilisearch 服务未运行，请先启动服务"
    exit 1
fi

# Check if LanceDB has data
echo -n "检查 LanceDB 数据... "
if [ -d "${PROJECT_ROOT}/data/lancedb" ]; then
    DB_SIZE=$(du -sh "${PROJECT_ROOT}/data/lancedb" 2>/dev/null | cut -f1 || echo "unknown")
    echo -e "${GREEN}正常${NC} (大小: ${DB_SIZE})"
else
    echo -e "${YELLOW}未找到${NC}"
    echo "LanceDB 数据目录不存在"
    exit 1
fi

echo ""
echo "开始同步..."
echo ""

# Run sync script
cd "${BACKEND_DIR}"
PYTHONPATH="${PROJECT_ROOT}" python sync_meilisearch.py

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo ""
    echo -e "${GREEN}同步完成${NC}"
else
    echo ""
    echo -e "${RED}同步失败 (退出码: ${EXIT_CODE})${NC}"
    exit $EXIT_CODE
fi