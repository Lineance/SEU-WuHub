#!/bin/bash
#
# Check Services - Health check for SEU-WuHub services
#
# Checks:
#   - Backend API health
#   - LanceDB database connection
#   - Disk space availability
#
# Usage: bash scripts/check_services.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
API_URL="${API_URL:-http://localhost:8000}"
HEALTH_ENDPOINT="${API_URL}/health"
DATA_DIR="${PROJECT_ROOT}/data"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================"
echo "SEU-WuHub 服务状态检查"
echo "========================================"
echo ""

# 1. Check backend API health
echo -n "1. 后端 API 健康检查... "
if curl -s -f -o /dev/null -w "%{http_code}" "${HEALTH_ENDPOINT}" 2>/dev/null | grep -q "200"; then
    echo -e "${GREEN}正常${NC}"
else
    echo -e "${RED}失败${NC}"
    echo "   - API 不可访问: ${HEALTH_ENDPOINT}"
fi

# 2. Check LanceDB database
echo -n "2. LanceDB 数据库检查... "
if [ -d "${DATA_DIR}/lancedb" ]; then
    DB_SIZE=$(du -sh "${DATA_DIR}/lancedb" 2>/dev/null | cut -f1 || echo "unknown")
    echo -e "${GREEN}正常${NC} (大小: ${DB_SIZE})"
else
    echo -e "${YELLOW}未找到${NC}"
    echo "   - 数据库目录: ${DATA_DIR}/lancedb"
fi

# 3. Check disk space
echo -n "3. 磁盘空间检查... "
DISK_USAGE=$(df -h "${PROJECT_ROOT}" 2>/dev/null | awk 'NR==2 {print $5}' | sed 's/%//' || echo "100")
if [ "${DISK_USAGE}" -lt 80 ]; then
    echo -e "${GREEN}正常${NC} (使用: ${DISK_USAGE}%)"
elif [ "${DISK_USAGE}" -lt 90 ]; then
    echo -e "${YELLOW}警告${NC} (使用: ${DISK_USAGE}%)"
else
    echo -e "${RED}不足${NC} (使用: ${DISK_USAGE}%)"
fi

# 4. Check website configs
echo -n "4. 网站配置文件检查... "
CONFIG_COUNT=$(ls -1 "${PROJECT_ROOT}/config/websites/"*.yaml 2>/dev/null | wc -l || echo "0")
if [ "${CONFIG_COUNT}" -gt 0 ]; then
    echo -e "${GREEN}正常${NC} (${CONFIG_COUNT} 个网站配置)"
else
    echo -e "${YELLOW}未找到${NC}"
fi

echo ""
echo "========================================"
echo "检查完成"
echo "========================================"