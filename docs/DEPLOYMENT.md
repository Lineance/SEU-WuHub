# SEU-WuHub 部署指南

本文档详细说明 SEU-WuHub 系统的部署流程，涵盖从环境准备到生产上线的完整步骤。适用于开发、测试和生产环境的部署。

## 1. 部署架构概述

### 1.1 部署模式

SEU-WuHub 支持多种部署模式：

| 部署模式 | 适用场景 | 特点 |
|----------|----------|------|
| **Docker Compose** | 开发/测试/小型生产 | 单机容器化，快速部署 |
| **手动部署** | 定制化需求 | 灵活配置，适合有经验的管理员 |
| **云原生部署** | 大规模生产 | K8s + Helm，高可用 |

### 1.2 系统要求

#### 最低配置
- **CPU**: 2核 (支持 AVX2 指令集)
- **内存**: 4GB RAM
- **存储**: 20GB SSD (推荐)
- **网络**: 公网访问权限

#### 推荐配置（生产环境）
- **CPU**: 4核+ (Intel/AMD x86_64)
- **内存**: 8GB+ RAM
- **存储**: 50GB+ NVMe SSD
- **网络**: 100Mbps+ 带宽，固定公网IP

### 1.3 软件要求

#### 必需软件
- **Docker Engine**: 24.0+ (使用 Docker Compose 部署)
- **Docker Compose**: 2.20+ 
- **Python**: 3.13+ (手动部署时需要)
- **Node.js**: 22.x (手动部署时需要)

#### 可选软件
- **Nginx**: 1.24+ (反向代理和负载均衡)
- **Systemd**: 服务管理 (Linux)
- **Prometheus**: 监控指标收集
- **Grafana**: 数据可视化

---

## 2. 快速部署（Docker Compose）

### 2.1 一键部署脚本

创建一键部署脚本 `deploy.sh`：

```bash
#!/bin/bash
# deploy.sh - SEU-WuHub 一键部署脚本

set -euo pipefail

echo "========================================"
echo "SEU-WuHub 部署开始"
echo "========================================"

# 1. 检查环境
echo "1. 检查部署环境..."
command -v docker >/dev/null 2>&1 || { echo "错误: 需要安装 Docker"; exit 1; }
command -v docker-compose >/dev/null 2>&1 || { echo "错误: 需要安装 Docker Compose"; exit 1; }

# 2. 创建目录结构
echo "2. 创建目录结构..."
mkdir -p data logs tmp backups config/websites

# 3. 复制配置文件（如果不存在）
echo "3. 配置检查..."
if [ ! -f "config/app.yaml" ]; then
    cp config/app.yaml.example config/app.yaml 2>/dev/null || echo "警告: app.yaml 配置模板不存在"
fi

if [ ! -f "config/tags.yaml" ]; then
    cp config/tags.yaml.example config/tags.yaml 2>/dev/null || echo "警告: tags.yaml 配置模板不存在"
fi

# 4. 构建 Docker 镜像
echo "4. 构建 Docker 镜像..."
docker-compose build --pull

# 5. 启动服务
echo "5. 启动服务..."
docker-compose up -d

# 6. 等待服务就绪
echo "6. 等待服务就绪..."
sleep 10

# 7. 健康检查
echo "7. 健康检查..."
if curl -s -f http://localhost:8000/api/health >/dev/null; then
    echo "✅ 后端服务健康检查通过"
else
    echo "❌ 后端服务健康检查失败"
    docker-compose logs backend
    exit 1
fi

echo "========================================"
echo "部署完成！"
echo "访问地址："
echo "- 前端: http://localhost:5173"
echo "- API文档: http://localhost:8000/docs"
echo "========================================"
```

### 2.2 环境配置文件

创建环境配置文件 `.env`：

```bash
# .env - 环境变量配置
COMPOSE_PROJECT_NAME=seuwuhub

# 后端配置
API_HOST=0.0.0.0
API_PORT=8000
LOG_LEVEL=INFO
LANCE_DB_PATH=./data/campus.lance

# 前端配置
VITE_API_BASE_URL=/api
VITE_APP_NAME=SEU-WuHub

# 开发模式（生产环境设为 false）
DEVELOPMENT=false

# 资源限制
BACKEND_MEMORY_LIMIT=2g
FRONTEND_MEMORY_LIMIT=1g
```

### 2.3 Docker Compose 生产配置

扩展 `docker-compose.prod.yml`：

```yaml
# docker-compose.prod.yml - 生产环境配置
version: '3.8'

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.prod
    restart: unless-stopped
    environment:
      - PYTHONUNBUFFERED=1
      - LOG_LEVEL=INFO
      - DEVELOPMENT=false
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    deploy:
      resources:
        limits:
          memory: 2G
        reservations:
          memory: 512M
  
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.prod
    restart: unless-stopped
    environment:
      - NODE_ENV=production
  
  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./deployment/nginx:/etc/nginx/conf.d:ro
      - ./frontend/dist:/usr/share/nginx/html:ro
      - ./ssl:/etc/ssl:ro
    depends_on:
      - backend
      - frontend
    deploy:
      resources:
        limits:
          memory: 256M
```

---

## 3. 手动部署指南

### 3.1 环境准备

```bash
# 1. 系统更新
sudo apt update && sudo apt upgrade -y

# 2. 安装基础依赖
sudo apt install -y python3.13 python3-pip python3-venv nodejs npm nginx

# 3. 安装 Python 环境管理工具
pip install uv

# 4. 创建项目目录
sudo mkdir -p /opt/seuwuhub/{data,logs,backups,config}
sudo chown -R $USER:$USER /opt/seuwuhub
cd /opt/seuwuhub
```

### 3.2 后端部署

```bash
# 1. 克隆代码
git clone https://github.com/Lineance/SEU-WuHub.git .
cd backend

# 2. 安装 Python 依赖
uv sync --extra dev

# 3. 数据库初始化
python -c "from backend.data.connection import init_database; init_database()"

# 4. 标签系统初始化
python -m backend.ingestion.tag_initializer --config ../config/tags.yaml

# 5. 配置环境变量
cat > .env << EOF
LANCE_DB_PATH=/opt/seuwuhub/data/campus.lance
LOG_LEVEL=INFO
API_HOST=0.0.0.0
API_PORT=8000
EOF

# 6. 创建 systemd 服务
sudo tee /etc/systemd/system/seuwuhub-backend.service << EOF
[Unit]
Description=SEU-WuHub Backend API
After=network.target

[Service]
Type=simple
User=$USER
Group=$USER
WorkingDirectory=/opt/seuwuhub/backend
EnvironmentFile=/opt/seuwuhub/backend/.env
ExecStart=/opt/seuwuhub/backend/.venv/bin/granian --interface asgi --host 0.0.0.0 --port 8000 --workers 4 app.main:app
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=seuwuhub-backend

[Install]
WantedBy=multi-user.target
EOF

# 7. 启动服务
sudo systemctl daemon-reload
sudo systemctl enable sewuwuhub-backend
sudo systemctl start sewuwuhub-backend
```

### 3.3 前端部署

```bash
# 1. 进入前端目录
cd /opt/seuwuhub/frontend

# 2. 安装依赖
npm install

# 3. 生产构建
npm run build

# 4. 配置 Nginx
sudo tee /etc/nginx/sites-available/seuwuhub << EOF
server {
    listen 80;
    server_name your-domain.com;
    
    # 前端静态文件
    location / {
        root /opt/seuwuhub/frontend/dist;
        index index.html;
        try_files \$uri \$uri/ /index.html;
    }
    
    # API 代理
    location /api/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # 流式响应支持
        proxy_buffering off;
        proxy_cache off;
        chunked_transfer_encoding on;
        
        # 只允许 GET/HEAD/OPTIONS 方法（安全限制）
        if (\$request_method !~ ^(GET|HEAD|OPTIONS)\$) {
            return 405;
        }
    }
    
    # 健康检查
    location /health {
        proxy_pass http://127.0.0.1:8000/api/health;
        access_log off;
    }
}
EOF

# 5. 启用站点
sudo ln -sf /etc/nginx/sites-available/seuwuhub /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx
```

### 3.4 SSL/TLS 配置

```bash
# 1. 安装 Certbot
sudo apt install -y certbot python3-certbot-nginx

# 2. 申请证书
sudo certbot --nginx -d your-domain.com

# 3. 自动续期测试
sudo certbot renew --dry-run
```

---

## 4. 生产环境配置

### 4.1 安全配置

#### Nginx 安全加固
```nginx
# deployment/nginx/security.conf
# 安全头部
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';" always;

# 请求限制
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=chat:10m rate=2r/s;

location /api/ {
    limit_req zone=api burst=20 nodelay;
    # ... 其他配置
}

location /api/v1/chat/stream {
    limit_req zone=chat burst=5 nodelay;
    # ... 其他配置
}

# 文件上传限制
client_max_body_size 10m;
```

#### 系统安全加固
```bash
# 1. 防火墙配置
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow ssh
sudo ufw --force enable

# 2. 系统更新自动化
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades

# 3. 日志轮转配置
sudo tee /etc/logrotate.d/seuwuhub << EOF
/opt/seuwuhub/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 0640 $USER $USER
    sharedscripts
    postrotate
        systemctl reload seuwuhub-backend > /dev/null 2>&1 || true
    endscript
}
EOF
```

### 4.2 监控与告警

#### Prometheus 配置
```yaml
# deployment/prometheus/prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'seuwuhub-backend'
    static_configs:
      - targets: ['backend:8000']
    metrics_path: '/api/metrics'

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']
```

#### 应用监控端点
```python
# backend/app/api/metrics.py
from prometheus_client import generate_latest, Counter, Histogram, Gauge
from fastapi import Response
from fastapi.routing import APIRoute

# 定义指标
REQUEST_COUNT = Counter('http_requests_total', 'Total HTTP requests', ['method', 'endpoint', 'status'])
REQUEST_LATENCY = Histogram('http_request_duration_seconds', 'HTTP request latency', ['method', 'endpoint'])
ACTIVE_USERS = Gauge('active_users', 'Number of active users')
DATABASE_SIZE = Gauge('database_size_bytes', 'Size of LanceDB database')

@app.get("/api/metrics")
async def metrics():
    """Prometheus 监控端点"""
    return Response(generate_latest(), media_type="text/plain")
```

#### Grafana 仪表板
创建 `deployment/grafana/dashboard.json` 包含以下面板：
1. API 请求速率和延迟
2. 数据库大小和增长趋势
3. 内存和 CPU 使用率
4. 标签匹配成功率
5. 爬虫采集统计

### 4.3 备份与恢复

#### 自动备份脚本
完善 `scripts/backup.sh`：

```bash
#!/bin/bash
# scripts/backup.sh - 完整备份脚本

set -euo pipefail

# 配置
BACKUP_DIR="/opt/seuwuhub/backups"
RETENTION_DAYS=7
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_NAME="campus-${TIMESTAMP}.tar.gz"

# 创建备份目录
mkdir -p "${BACKUP_DIR}"

echo "[$(date)] 开始备份..."

# 1. 停止服务（可选，确保数据一致性）
# docker-compose stop backend

# 2. 备份数据库
echo "备份 LanceDB 数据库..."
tar -czf "${BACKUP_DIR}/${BACKUP_NAME}" \
    -C /opt/seuwuhub data/campus.lance \
    --exclude="data/campus.lance/_indices/.cache"

# 3. 备份配置文件
echo "备份配置文件..."
cp -r /opt/seuwuhub/config "${BACKUP_DIR}/config-${TIMESTAMP}"

# 4. 启动服务
# docker-compose start backend

# 5. 应用保留策略
echo "清理旧备份..."
find "${BACKUP_DIR}" -name "campus-*.tar.gz" -mtime +${RETENTION_DAYS} -delete
find "${BACKUP_DIR}" -name "config-*" -type d -mtime +${RETENTION_DAYS} -exec rm -rf {} \;

# 6. 记录备份信息
BACKUP_SIZE=$(du -h "${BACKUP_DIR}/${BACKUP_NAME}" | cut -f1)
echo "[$(date)] 备份完成: ${BACKUP_NAME} (${BACKUP_SIZE})"

# 7. 远程备份（可选）
# rsync -avz "${BACKUP_DIR}/${BACKUP_NAME}" backup-server:/backups/
```

#### 恢复脚本
完善 `scripts/restore.sh`：

```bash
#!/bin/bash
# scripts/restore.sh - 数据恢复脚本

set -euo pipefail

if [ $# -ne 1 ]; then
    echo "用法: $0 <备份文件>"
    echo "可用备份:"
    ls -1 /opt/seuwuhub/backups/campus-*.tar.gz 2>/dev/null || echo "无备份文件"
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "${BACKUP_FILE}" ]; then
    echo "错误: 备份文件不存在: ${BACKUP_FILE}"
    exit 1
fi

echo "警告: 此操作将覆盖现有数据！"
read -p "确认恢复备份 ${BACKUP_FILE}? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "恢复操作已取消"
    exit 0
fi

echo "[$(date)] 开始恢复..."

# 1. 停止服务
docker-compose stop backend

# 2. 备份当前数据
CURRENT_BACKUP="/opt/seuwuhub/backups/restore-backup-$(date +%Y%m%d-%H%M%S).tar.gz"
if [ -d "/opt/seuwuhub/data/campus.lance" ]; then
    echo "备份当前数据..."
    tar -czf "${CURRENT_BACKUP}" -C /opt/seuwuhub data/campus.lance
fi

# 3. 清理现有数据
echo "清理现有数据..."
rm -rf "/opt/seuwuhub/data/campus.lance"

# 4. 恢复备份
echo "恢复备份..."
tar -xzf "${BACKUP_FILE}" -C /opt/seuwuhub

# 5. 修复权限
chown -R $USER:$USER "/opt/seuwuhub/data/campus.lance"

# 6. 启动服务
docker-compose start backend

echo "[$(date)] 恢复完成"
echo "当前数据已备份至: ${CURRENT_BACKUP}"
```

#### 定时备份配置
```bash
# 配置每日凌晨2点备份
sudo tee /etc/cron.d/seuwuhub-backup << EOF
0 2 * * * $USER /opt/seuwuhub/scripts/backup.sh >> /opt/seuwuhub/logs/backup.log 2>&1
EOF
```

### 4.4 性能优化

#### LanceDB 性能优化
```python
# 索引优化配置
INDEX_CONFIG = {
    "vector_index": {
        "index_type": "IVF_PQ",
        "num_partitions": 256,      # 根据数据量调整
        "num_sub_vectors": 96,      # 平衡精度和性能
        "metric": "cosine",
        "use_opq": True             # 正交量化提升精度
    },
    "fulltext_index": {
        "use_tantivy": True,
        "chinese_tokenizer": True,  # 中文分词优化
        "stemming": False           # 中文不需要词干提取
    }
}

# 查询优化
QUERY_CONFIG = {
    "prefilter": True,              # 先过滤后搜索
    "refine_factor": 10,            # 结果精炼因子
    "use_ivf_optional": True        # 使用可选的 IVF 索引
}
```

#### 系统参数优化
```bash
# 调整 Linux 内核参数
sudo tee /etc/sysctl.d/seuwuhub.conf << EOF
# 网络优化
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.tcp_syncookies = 1
net.ipv4.tcp_tw_reuse = 1

# 内存优化
vm.swappiness = 10
vm.dirty_ratio = 60
vm.dirty_background_ratio = 2

# 文件描述符限制
fs.file-max = 2097152
fs.nr_open = 2097152
EOF

sudo sysctl -p /etc/sysctl.d/seuwuhub.conf

# 调整进程限制
sudo tee /etc/security/limits.d/seuwuhub.conf << EOF
* soft nofile 65535
* hard nofile 65535
* soft nproc 65535
* hard nproc 65535
EOF
```

---

## 5. 维护操作

### 5.1 日常维护任务

#### 检查清单
```bash
# 1. 服务状态检查
./scripts/check_services.sh

# 2. 磁盘空间检查
df -h /opt/seuwuhub

# 3. 日志分析
tail -100 /opt/seuwuhub/logs/app.log | grep -E "(ERROR|WARNING)"

# 4. 数据库健康检查
python -c "
from backend.data.connection import get_articles_table
table = get_articles_table()
print(f'记录数: {table.count_rows()}')
print(f'表大小: {table.stats()}')
"

# 5. 标签系统检查
python -c "
from backend.data.tag_repository import get_tag_repository
repo = get_tag_repository()
print(f'标签数量: {repo.count()}')
"
```

#### 日志轮转配置
```bash
# /etc/logrotate.d/seuwuhub
/opt/seuwuhub/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 0640 $USER $USER
    sharedscripts
    postrotate
        docker-compose restart backend > /dev/null 2>&1 || true
    endscript
}
```

### 5.2 故障排除

#### 常见问题解决

**问题 1：数据库损坏**
```bash
# 症状：应用启动时报 LanceDB 错误
# 解决方案：
# 1. 从备份恢复
./scripts/restore.sh /opt/seuwuhub/backups/campus-最新.tar.gz

# 2. 重建索引
python -c "
from backend.retrieval.store import create_store
store = create_store()
store.recreate_indices()
print('索引重建完成')
"
```

**问题 2：内存不足**
```bash
# 症状：应用崩溃，OOM Killer 记录
# 解决方案：
# 1. 查看内存使用
docker stats

# 2. 调整内存限制
# 修改 docker-compose.yml：
# backend:
#   deploy:
#     resources:
#       limits:
#         memory: 4G

# 3. 优化缓存设置
# 修改 config/app.yaml：
# cache:
#   max_size_mb: 512
#   ttl_seconds: 3600
```

**问题 3：爬虫数据不更新**
```bash
# 症状：incremental_urls=0
# 解决方案：
# 1. 清理状态文件
rm -f /opt/seuwuhub/tmp/*_seen_urls.json

# 2. 强制重新爬取
cd backend
python -m crawler.src.list_to_articles_e2e \
    --website jwc \
    --article-crawler-overrides '{"cache_mode":"BYPASS"}' \
    --max-pages 3
```

**问题 4：API 响应慢**
```bash
# 症状：搜索查询响应时间 > 5s
# 解决方案：
# 1. 检查索引状态
python -c "
from backend.data.connection import get_articles_table
table = get_articles_table()
indices = table.list_indices()
print(f'索引列表: {indices}')
"

# 2. 优化查询缓存
python -c "
from backend.retrieval.engine import create_engine
engine = create_engine()
engine.optimize_cache(max_size=1000)
"

# 3. 增加工作进程数
# 修改 Dockerfile 或 systemd 配置：
# granian --workers 8 ...
```

#### 调试工具
```python
# debug.py - 调试工具脚本
import logging
logging.basicConfig(level=logging.DEBUG)

from backend.data.connection import get_connection
from backend.data.tag_repository import get_tag_repository
from backend.ingestion.tag_matcher import TagMatcher
from backend.retrieval.engine import create_engine

def check_system_health():
    """系统健康检查"""
    print("=== 系统健康检查 ===")
    
    # 1. 数据库连接
    try:
        conn = get_connection()
        print("✅ 数据库连接正常")
    except Exception as e:
        print(f"❌ 数据库连接失败: {e}")
    
    # 2. 标签系统
    try:
        tag_repo = get_tag_repository()
        count = tag_repo.count()
        print(f"✅ 标签系统正常 (标签数: {count})")
    except Exception as e:
        print(f"❌ 标签系统异常: {e}")
    
    # 3. 检索引擎
    try:
        engine = create_engine()
        results = engine.search("测试", limit=1)
        print(f"✅ 检索引擎正常 (测试结果: {len(results.get('results', []))})")
    except Exception as e:
        print(f"❌ 检索引擎异常: {e}")
    
    # 4. 标签匹配
    try:
        matcher = TagMatcher()
        matches = matcher.match_tags("学术讲座通知", limit=3)
        print(f"✅ 标签匹配正常 (匹配数: {len(matches)})")
    except Exception as e:
        print(f"❌ 标签匹配异常: {e}")

if __name__ == "__main__":
    check_system_health()
```

### 5.3 版本升级

#### 升级流程
```bash
#!/bin/bash
# upgrade.sh - 版本升级脚本

set -euo pipefail

VERSION=$1

echo "开始升级到版本 ${VERSION}..."

# 1. 备份当前数据
./scripts/backup.sh

# 2. 停止服务
docker-compose down

# 3. 更新代码
git fetch origin
git checkout ${VERSION}
git pull origin ${VERSION}

# 4. 更新依赖
cd backend && uv sync --extra dev
cd ../frontend && npm install

# 5. 数据库迁移（如有）
# python scripts/migrate.py

# 6. 重启服务
docker-compose up -d --build

# 7. 健康检查
sleep 10
curl -f http://localhost:8000/api/health || {
    echo "健康检查失败，回滚..."
    docker-compose logs backend
    exit 1
}

echo "升级完成！"
```

#### 兼容性检查清单
- [ ] 数据库 Schema 兼容性
- [ ] API 接口向后兼容
- [ ] 配置文件格式兼容
- [ ] 数据迁移脚本测试
- [ ] 回滚方案验证

---

## 6. 扩展部署

### 6.1 高可用部署

#### 负载均衡配置
```nginx
# deployment/nginx/load-balancer.conf
upstream backend_servers {
    least_conn;
    server backend1:8000 max_fails=3 fail_timeout=30s;
    server backend2:8000 max_fails=3 fail_timeout=30s;
    server backend3:8000 max_fails=3 fail_timeout=30s;
    
    # 健康检查
    check interval=3000 rise=2 fall=3 timeout=1000;
}

server {
    location /api/ {
        proxy_pass http://backend_servers;
        # 会话保持（如果需要）
        # ip_hash;
        
        # 故障转移
        proxy_next_upstream error timeout invalid_header http_500 http_502 http_503 http_504;
        proxy_next_upstream_tries 3;
    }
}
```

#### 共享存储配置
```yaml
# docker-compose.ha.yml
services:
  backend:
    volumes:
      - shared-data:/app/data:rw
    
  nfs-server:
    image: itsthenetwork/nfs-server-alpine
    volumes:
      - ./data:/shared
    environment:
      - SHARED_DIRECTORY=/shared

volumes:
  shared-data:
    driver: local
    driver_opts:
      type: nfs
      o: addr=nfs-server,rw,nolock,soft
      device: ":/shared"
```

### 6.2 Kubernetes 部署

#### Helm Chart 结构
```
seuwuhub-helm/
├── Chart.yaml
├── values.yaml
├── templates/
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── ingress.yaml
│   ├── configmap.yaml
│   └── pvc.yaml
└── README.md
```

#### 部署命令
```bash
# 1. 添加 Helm 仓库
helm repo add sewuwuhub https://charts.seuwuhub.example.com

# 2. 安装 Chart
helm install seuwuhub seuwuhub/seuwuhub \
    --namespace seuwuhub \
    --create-namespace \
    --values values.prod.yaml

# 3. 查看状态
kubectl get pods -n seuwuhub
kubectl get svc -n seuwuhub
```

### 6.3 CDN 和缓存优化

#### 静态资源 CDN
```nginx
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
    
    # CDN 回源
    proxy_pass http://frontend;
    proxy_cache_valid 200 1y;
    
    # 缓存键
    proxy_cache_key "$scheme$request_method$host$request_uri";
}
```

#### API 响应缓存
```python
# backend/app/core/cache.py
from fastapi_cache import FastAPICache
from fastapi_cache.backends.redis import RedisBackend
from fastapi_cache.decorator import cache

@cache(expire=300)  # 5分钟缓存
@app.get("/api/v1/articles")
async def list_articles():
    """文章列表（带缓存）"""
    pass
```

---

## 7. 附录

### 7.1 部署检查清单

#### 预部署检查
- [ ] 服务器资源满足要求
- [ ] 网络配置正确
- [ ] 安全组/防火墙开放
- [ ] 域名解析生效
- [ ] SSL 证书准备

#### 部署过程检查
- [ ] Docker 环境正常
- [ ] 镜像构建成功
- [ ] 容器启动正常
- [ ] 数据库初始化完成
- [ ] 标签系统初始化完成

#### 部署后验证
- [ ] 前端页面可访问
- [ ] API 接口正常响应
- [ ] 健康检查通过
- [ ] 搜索功能正常
- [ ] 爬虫数据可导入

### 7.2 性能基准测试

#### 测试脚本
```bash
#!/bin/bash
# benchmarks.sh - 性能基准测试

echo "=== SEU-WuHub 性能基准测试 ==="

# 1. API 延迟测试
echo "1. API 延迟测试..."
ab -n 1000 -c 10 http://localhost:8000/api/health

# 2. 搜索性能测试
echo "2. 搜索性能测试..."
for query in "学术" "讲座" "通知" "考试"; do
    echo "查询: $query"
    time curl -s "http://localhost:8000/api/v1/search?q=$query" > /dev/null
done

# 3. 并发测试
echo "3. 并发测试..."
siege -c 50 -t 30S "http://localhost:8000/api/v1/articles"

# 4. 内存使用测试
echo "4. 内存使用测试..."
docker stats --no-stream
```

#### 性能指标
- **API 响应时间**: < 200ms (P95)
- **搜索响应时间**: < 500ms (P95)
- **并发连接数**: > 100
- **内存使用**: < 2GB
- **CPU 使用率**: < 70%

### 7.3 故障恢复计划

#### RTO/RPO 目标
- **RTO（恢复时间目标）**: 1小时
- **RPO（恢复点目标）**: 24小时

#### 恢复步骤
1. **识别故障范围**
2. **启动备份系统**
3. **数据恢复**
4. **服务重启**
5. **功能验证**
6. **监控观察**

### 7.4 联系支持

- **项目仓库**: https://github.com/Lineance/SEU-WuHub
- **问题反馈**: GitHub Issues
- **文档更新**: 定期查看本文档最新版本
- **紧急联系**: 部署问题请提交 Issue 并标记为 "部署-紧急"

---

*本文档最后更新：2026年3月19日*

> **提示**: 生产环境部署前，请务必在测试环境充分验证。定期备份数据，制定灾难恢复计划。