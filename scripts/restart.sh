#!/bin/bash
#
# Restart Script - Restart SEU-WuHub backend service
#
# Usage: bash scripts/restart.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "========================================"
echo "SEU-WuHub 后端服务重启"
echo "========================================"

# Stop service
echo "停止服务..."
bash "${SCRIPT_DIR}/stop.sh"

# Wait a moment
sleep 2

# Start service
echo "启动服务..."
bash "${SCRIPT_DIR}/start.sh"