#!/bin/bash
#
# Crawl Full Script - Full crawl and ingest of all configured websites
#
# This script crawls all websites configured in config/websites/
# with max-pages=99999 for full data collection, then ingests into LanceDB.
#
# Usage: bash scripts/crawl_full.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
CONFIG_DIR="${PROJECT_ROOT}/config/websites"
LOG_DIR="${PROJECT_ROOT}/logs"
LOG_FILE="${LOG_DIR}/crawl_full.log"
TMP_DIR="${PROJECT_ROOT}/tmp"

mkdir -p "${LOG_DIR}" "${TMP_DIR}"

echo "========================================"
echo "SEU-WuHub 全量爬虫"
echo "========================================"
echo "时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "日志: ${LOG_FILE}"
echo ""

# Check if config directory exists
if [ ! -d "${CONFIG_DIR}" ]; then
    echo "错误: 配置文件目录不存在: ${CONFIG_DIR}"
    exit 1
fi

# Get all website configs
CONFIG_FILES=$(ls -1 "${CONFIG_DIR}"/*.yaml 2>/dev/null || echo "")

if [ -z "${CONFIG_FILES}" ]; then
    echo "错误: 未找到网站配置文件"
    exit 1
fi

echo "开始全量爬取..."
echo "警告: 全量爬取可能需要较长时间"
echo ""

# Crawl and ingest each website
TOTAL=0
SUCCESS=0
FAILED=0
INGESTED=0

for config_file in ${CONFIG_FILES}; do
    WEBSITE_NAME=$(basename "${config_file}" .yaml)
    TIMESTAMP=$(date +%Y%m%d%H%M%S)
    OUTPUT_FILE="${TMP_DIR}/crawl_${WEBSITE_NAME}_${TIMESTAMP}.json"
    CRAWL_LOG="${LOG_DIR}/crawl_${WEBSITE_NAME}_full.log"

    echo "----------------------------------------"
    echo "爬取网站: ${WEBSITE_NAME}"
    echo "配置: ${config_file}"
    echo "开始时间: $(date '+%Y-%m-%d %H:%M:%S')"

    TOTAL=$((TOTAL + 1))

    # Run crawler with max-pages=99999 for full crawl
    cd "${PROJECT_ROOT}"
    if PYTHONPATH="${PROJECT_ROOT}" python backend/crawler/src/list_to_articles_e2e.py \
        --website "${WEBSITE_NAME}" \
        --max-pages 99999 \
        --output "${OUTPUT_FILE}" \
        >> "${CRAWL_LOG}" 2>&1; then
        echo -e "爬取状态: \033[0;32m成功\033[0m"

        # Check if there are results to ingest
        ARTICLE_COUNT=$(python "${SCRIPT_DIR}/ingest.py" --count "${OUTPUT_FILE}" 2>&1 | tail -1 | grep -oE '[0-9]+' || echo "0")

        if [ -n "${ARTICLE_COUNT}" ] && [ "${ARTICLE_COUNT}" -gt 0 ]; then
            echo "开始入库..."
            INGESTED_COUNT=$(python "${SCRIPT_DIR}/ingest.py" "${OUTPUT_FILE}" 2>&1 | tail -1 | grep -oE '[0-9]+' || echo "0")
            echo -e "入库: \033[0;32m${INGESTED_COUNT} 条\033[0m"
            INGESTED=$((INGESTED + INGESTED_COUNT))
        else
            echo "无内容需要入库"
        fi
        SUCCESS=$((SUCCESS + 1))
    else
        echo -e "爬取状态: \033[0;31m失败\033[0m"
        FAILED=$((FAILED + 1))
    fi
    echo ""
done

echo "========================================"
echo "全量爬取完成"
echo "时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "总计: ${TOTAL} 个网站"
echo -e "爬取成功: \033[0;32m${SUCCESS}\033[0m"
echo -e "爬取失败: \033[0;31m${FAILED}\033[0m"
echo -e "入库总数: \033[0;32m${INGESTED}\033[0m"
echo "========================================"