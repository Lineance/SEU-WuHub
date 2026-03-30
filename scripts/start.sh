#!/bin/bash
#
# Start Script - Start SEU-WuHub backend service
#
# Usage: bash scripts/start.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKEND_DIR="${PROJECT_ROOT}/backend"
PID_FILE="${PROJECT_ROOT}/logs/backend.pid"
LOG_FILE="${PROJECT_ROOT}/logs/backend.log"
API_URL="${API_URL:-http://localhost:8000}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

mkdir -p "${PROJECT_ROOT}/logs"

echo "========================================"
echo "SEU-WuHub 后端服务启动"
echo "========================================"

# Check if already running
if [ -f "${PID_FILE}" ]; then
    PID=$(cat "${PID_FILE}")
    if kill -0 "${PID}" 2>/dev/null; then
        echo -e "${YELLOW}服务已在运行 (PID: ${PID})${NC}"
        exit 0
    else
        rm -f "${PID_FILE}"
    fi
fi

# Start backend service
echo "启动后端服务..."
cd "${BACKEND_DIR}"

# Use uvicorn to start the FastAPI app
PYTHONPATH="${PROJECT_ROOT}" python -m uvicorn app.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --log-level info \
    --access-log \
    > "${LOG_FILE}" 2>&1 &

BACKEND_PID=$!
echo "${BACKEND_PID}" > "${PID_FILE}"
echo "后端服务已启动 (PID: ${BACKEND_PID})"

# Wait for service to be ready
echo "等待服务就绪..."
MAX_WAIT=30
COUNTER=0
while [ $COUNTER -lt $MAX_WAIT ]; do
    if curl -s -f "${API_URL}/health" >/dev/null 2>&1; then
        echo -e "${GREEN}服务就绪${NC}"
        echo "日志文件: ${LOG_FILE}"
        echo "访问地址: ${API_URL}"
        exit 0
    fi
    sleep 1
    COUNTER=$((COUNTER + 1))
done

echo -e "${RED}服务启动超时${NC}"
echo "请检查日志: ${LOG_FILE}"
exit 1