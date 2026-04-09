#!/bin/bash
#
# Stop Script - Gracefully stop SEU-WuHub backend service
#
# Usage: bash scripts/stop.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
PID_FILE="${PROJECT_ROOT}/logs/backend.pid"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "========================================"
echo "SEU-WuHub 后端服务停止"
echo "========================================"

# Check if running
if [ ! -f "${PID_FILE}" ]; then
    echo -e "${YELLOW}服务未运行 (无 PID 文件)${NC}"
    exit 0
fi

PID=$(cat "${PID_FILE}")

if ! kill -0 "${PID}" 2>/dev/null; then
    echo -e "${YELLOW}服务未运行 (PID: ${PID})${NC}"
    rm -f "${PID_FILE}"
    exit 0
fi

# Graceful shutdown
echo "停止服务 (PID: ${PID})..."
kill -TERM "${PID}" 2>/dev/null || true

# Wait for process to terminate
MAX_WAIT=10
COUNTER=0
while [ $COUNTER -lt $MAX_WAIT ]; do
    if ! kill -0 "${PID}" 2>/dev/null; then
        rm -f "${PID_FILE}"
        echo -e "${GREEN}服务已停止${NC}"
        exit 0
    fi
    sleep 1
    COUNTER=$((COUNTER + 1))
done

# Force kill if still running
echo "强制停止..."
kill -9 "${PID}" 2>/dev/null || true
rm -f "${PID_FILE}"
echo -e "${YELLOW}服务已强制终止${NC}"