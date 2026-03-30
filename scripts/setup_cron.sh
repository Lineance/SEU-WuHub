#!/bin/bash
#
# Setup Cron Script - Configure scheduled tasks for SEU-WuHub
#
# Default schedule: Run incremental crawl at 2:00 AM daily
# This script requires cron to be installed and running.
#
# Usage:
#   bash scripts/setup_cron.sh              # Default (2:00 AM daily)
#   bash scripts/setup_cron.sh "0 3 * * *"  # Custom cron expression
#   bash scripts/setup_cron.sh --remove     # Remove cron jobs

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Default cron schedule: 2:00 AM daily
DEFAULT_SCHEDULE="0 2 * * *"
CRON_USER="${USER:-root}"
CRON_JOB_PREFIX="# SEU-WuHub"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "========================================"
echo "SEU-WuHub 定时任务配置"
echo "========================================"

# Parse arguments
if [ "$#" -ge 1 ]; then
    if [ "$1" = "--remove" ]; then
        echo "移除定时任务..."
        # Remove SEU-WuHub cron jobs
        crontab -l 2>/dev/null | grep -v "${CRON_JOB_PREFIX}" | crontab - 2>/dev/null || true
        echo -e "${GREEN}定时任务已移除${NC}"
        exit 0
    fi
    SCHEDULE="$1"
else
    SCHEDULE="${DEFAULT_SCHEDULE}"
fi

# Validate cron expression
validate_cron() {
    local expr="$1"
    # Basic validation: 5 fields
    if ! echo "${expr}" | grep -qE '^([0-9*,/-]+\s+){4}[0-9*,/-]+$'; then
        echo -e "${RED}无效的 cron 表达式: ${expr}${NC}"
        exit 1
    fi
}

validate_cron "${SCHEDULE}"

echo "Cron 表达式: ${SCHEDULE}"
echo ""

# Generate cron job lines
CRON_INCREMENTAL="${SCHEDULE} cd ${PROJECT_ROOT} && PYTHONPATH=${PROJECT_ROOT} python backend/crawler/src/list_to_articles_e2e.py --website jwc --max-pages 1 >> logs/crawl_incremental.log 2>&1"
CRON_COMMENT="${CRON_JOB_PREFIX} - Incremental crawl"

# Remove existing SEU-WuHub cron jobs first
echo "清理旧定时任务..."
crontab -l 2>/dev/null | grep -v "${CRON_JOB_PREFIX}" | crontab - 2>/dev/null || true

# Add new cron job
echo "添加定时任务..."
echo "${CRON_COMMENT}" | crontab - 2>/dev/null || true
(crontab -l 2>/dev/null; echo "${CRON_INCREMENTAL}") | crontab - 2>/dev/null || {
    echo -e "${RED}添加定时任务失败${NC}"
    exit 1
}

echo ""
echo -e "${GREEN}定时任务配置完成${NC}"
echo ""
echo "当前定时任务:"
crontab -l 2>/dev/null | grep "${CRON_JOB_PREFIX}" || echo "  (无)"
echo ""
echo "定时任务说明:"
echo "  - 增量爬虫: 每天 ${SCHEDULE} 执行"
echo ""
echo "管理命令:"
echo "  - 查看: crontab -l"
echo "  - 编辑: crontab -e"
echo "  - 移除: bash scripts/setup_cron.sh --remove"
echo "========================================"