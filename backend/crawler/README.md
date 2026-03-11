# 配置化爬虫模块

基于 [crawl4ai](https://github.com/unclecode/crawl4ai) 的配置驱动爬虫模块，支持自动增量更新、PDF处理和深度爬取。

## 特性

- **完全配置驱动**: 所有参数通过 YAML 配置文件修改，无需修改代码
- **自动增量更新**: 利用 crawl4ai 缓存系统实现智能增量爬取
- **PDF支持**: 自动识别和处理PDF文件，转换为Markdown格式
- **深度爬取**: 支持深度爬取策略，自动发现和处理链接
- **多格式输出**: 支持 JSON、Python 字典、Markdown 格式输出
- **简单接口**: 单一调用方式，易于集成
- **完善错误处理**: 内置日志系统和错误恢复机制
- **模板系统**: 支持自定义 Markdown 模板
- **异步支持**: 基于异步 IO，适合高性能应用

## 项目结构

```
crawler/
├── config_data/                    # 配置文件目录
│   ├── browser.yaml          # 浏览器配置
│   ├── crawler.yaml          # 爬虫通用配置
│   └── websites/             # 网站特定配置
│       ├── example.yaml     # 网站配置模板
│       └── test_site.yaml    # 测试网站配置
├── src/                      # 源代码
│   ├── __init__.py
│   └── crawler.py           # 核心爬虫类
├── tests/                    # 测试代码
│   ├── __init__.py
│   ├── test_crawler.py      # 单元测试
│   └── integration_test.py  # 集成测试
├── examples/                 # 使用示例
│   ├── quickstart.py       # 使用示例
├── logs/                     # 日志文件目录
├── requirements.txt          # 依赖包列表
└── README.md                # 本文档
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 运行示例

项目提供了一个完整的快速开始示例，演示了两种使用模式：

```bash
python examples/quickstart.py
```

### 3. 基本使用

```python
import asyncio
from src.crawler import ConfigurableCrawler

async def main():
    # 使用 async with 自动管理浏览器的启动和关闭
    async with ConfigurableCrawler(config_dir="config") as crawler:
        
        # 场景 1: 直接抓取 URL (简单模式)
        print("--- 简单抓取 ---")
        simple_results = await crawler.crawl("https://www.example.com")
        for res in simple_results:
            if res['success']:
                print(f"成功抓取: {res['title']} (URL: {res['url']})")

        # 场景 2: 使用配置文件执行深度爬取 (配置模式)
        print("\n--- 深度爬取 (基于配置文件) ---")
        deep_results = await crawler.crawl(target="example", is_website_config=True)
        
        print(f"深度爬取完成，共获得 {len(deep_results)} 个页面结果")
        
        # 打印最后一个页面的部分 Markdown 内容
        if deep_results:
            last_page = deep_results[-1]
            print(f"最后一页标题: {last_page['title']}")
            print(f"内容摘要: {last_page['markdown'][:100]}...")

if __name__ == "__main__":
    asyncio.run(main())
```

### 4. 同步使用方式

如果你更喜欢同步编程，可以使用以下方式：

```python
import asyncio
from src.crawler import ConfigurableCrawler

# 创建爬虫实例
crawler = ConfigurableCrawler()

# 运行异步任务
loop = asyncio.new_event_loop()
asyncio.set_event_loop(loop)

try:
    # 启动爬虫
    loop.run_until_complete(crawler.start())
    
    # 执行爬取
    results = loop.run_until_complete(crawler.crawl("https://www.example.com"))
    
    for res in results:
        if res['success']:
            print(f"成功抓取: {res['title']} (URL: {res['url']})")
            
finally:
    # 关闭爬虫
    loop.run_until_complete(crawler.close())
    loop.close()
```

### 3. 配置文件说明

#### 3.1 浏览器配置 (`config/browser.yaml`)

控制浏览器环境，如浏览器类型、视口大小、代理等。

```yaml
browser:
  browser_type: "chromium"  # chromium, firefox, webkit
  headless: true           # 无头模式
  viewport_width: 1280
  viewport_height: 720
  user_agent: "Mozilla/5.0 ..."
```

#### 3.2 爬虫配置 (`config/crawler.yaml`)

控制爬取行为，如缓存、内容处理、等待条件等。

```yaml
crawler:
  cache_mode: "ENABLED"      # 缓存模式
  word_count_threshold: 50   # 跳过少于50词的文本块
  page_timeout: 30000        # 页面超时（毫秒）
  wait_until: "domcontentloaded"  # 等待条件
```

#### 3.3 网站配置 (`config/websites/`)

每个网站一个配置文件，支持配置覆盖。

```yaml
website:
  name: "东南大学官网公告"
  base_url: "https://www.seu.edu.cn"
  
  overrides:  # 覆盖通用配置
    crawler:
      cache_mode: "ENABLED"
      page_timeout: 45000
  
  start_urls:  # 起始URL列表
    - "https://www.seu.edu.cn/announcement"
    - "https://www.seu.edu.cn/news"
  
  selectors:  # 内容选择器
    title: "h1.article-title, h1.title"
    content: ".article-content, .content"
    publish_date: ".publish-date, .time"
  
  output:  # 输出配置
    format: "md"
    save_to_file: true
    file_path: "./output/seu_announcements_{date}.md"
    md_template: "announcement"
```

### 4. 缓存和增量更新

爬虫使用 crawl4ai 的缓存系统实现自动增量更新：

- **缓存模式**: `ENABLED`（启用）、`DISABLED`（禁用）、`READ_ONLY`（只读）、`WRITE_ONLY`（只写）
- **缓存验证**: 可配置缓存有效期（默认3600秒）
- **智能更新**: 仅爬取更新的内容，减少网络请求

配置示例：
```yaml
crawler:
  cache_mode: "ENABLED"
  cache_validation_timeout: 7200  # 2小时缓存有效期
  check_cache_freshness: true
```

### 5. 输出格式

#### 5.1 JSON 格式

```python
json_data = crawler.get_crawled_data("seu", format="json")
# 返回JSON字符串，便于存储和传输
```

#### 5.2 字典格式

```python
dict_data = crawler.get_crawled_data("seu", format="dict")
# 返回Python字典列表，便于程序处理
```

#### 5.3 Markdown 格式

```python
md_data = crawler.get_crawled_data("seu", format="md")
# 返回Markdown字符串，便于阅读和发布
```

### 6. PDF文件处理

爬虫支持自动识别和处理PDF文件，并转换为Markdown格式：

#### 6.1 启用PDF支持

在网站配置中启用PDF处理：

```yaml
website:
  overrides:
    crawler:
      pdf: true  # 启用PDF生成
      pdf_options:
        format: "A4"
        print_background: true
        prefer_css_page_size: false
      
  output:
    save_pdf: true  # 保存PDF文件
    pdf_output_path: "./output/pdf_files/{website}_{timestamp}.pdf"
```

#### 6.2 PDF爬取示例

```python
from src.crawler import ConfigurableCrawler

crawler = ConfigurableCrawler()

# 爬取PDF文件
data = crawler.get_crawled_data("pdf_test", format="dict")

for result in data:
    if result.get('has_pdf'):
        print(f"PDF文件: {result['url']}")
        print(f"文件大小: {result['pdf_size']} 字节")
        print(f"Markdown内容: {result['markdown'][:200]}...")
```

#### 6.3 本地PDF文件

支持本地PDF文件（使用file://协议）：

```yaml
start_urls:
  - "file:///C:/path/to/your/document1.pdf"
  - "file:///C:/path/to/your/document2.pdf"
```

### 7. 深度爬取

爬虫支持深度爬取策略，自动发现和处理链接：

#### 7.1 启用深度爬取

```yaml
website:
  deep_crawl:
    enabled: true  # 启用深度爬取
    max_depth: 3   # 最大爬取深度
    max_pages: 100 # 最大页面数
    same_domain_only: true  # 仅爬取相同域名
    
    # PDF自动识别
    auto_detect_pdf: true
    pdf_processing:
      enabled: true
      convert_to_markdown: true
      save_pdf_files: true
      
    # URL过滤规则
    url_filters:
      include_patterns:
        - "\.pdf$"
        - "\.html?$"
      exclude_patterns:
        - "/private/"
        - "\.(jpg|jpeg|png|gif)$"
```

#### 7.2 深度爬取示例

```python
from src.crawler import ConfigurableCrawler

crawler = ConfigurableCrawler()

# 深度爬取网站
data = crawler.get_crawled_data("deep_crawl_site", format="dict")

print(f"总共爬取: {len(data)} 个页面")
pdf_count = sum(1 for r in data if r.get('has_pdf'))
print(f"其中PDF文件: {pdf_count} 个")
```


## 高级功能

### 批量处理

```python
websites = ["seu", "test_site", "custom_site"]
all_results = {}

for website in websites:
    data = crawler.get_crawled_data(website, format="dict")
    all_results[website] = data
    print(f"{website}: {len(data)} 条记录")
```

### 异步使用

```python
import asyncio

async def async_crawl():
    crawler = ConfigurableCrawler()
    
    # 异步爬取单个URL
    result = await crawler.crawl_url("https://example.com")
    
    # 异步爬取整个网站
    results = await crawler.crawl_website("seu")
    
    crawler.close()
    return results

# 运行异步任务
loop = asyncio.new_event_loop()
results = loop.run_until_complete(async_crawl())
loop.close()
```

### 监控和日志

爬虫内置日志系统，日志同时输出到控制台和文件：

```python
import logging

# 调整日志级别
logging.getLogger('crawler').setLevel(logging.DEBUG)

# 查看日志文件
log_file = Path("logs") / "crawler.log"
```

## 配置参考

### 浏览器配置选项

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `browser_type` | string | `"chromium"` | 浏览器类型 |
| `headless` | boolean | `true` | 无头模式 |
| `viewport_width` | integer | `1280` | 视口宽度 |
| `viewport_height` | integer | `720` | 视口高度 |
| `user_agent` | string | 自动生成 | 用户代理 |
| `proxy_config` | object | `null` | 代理配置 |

### 爬虫配置选项

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `cache_mode` | string | `"ENABLED"` | 缓存模式 |
| `word_count_threshold` | integer | `50` | 词数阈值 |
| `page_timeout` | integer | `30000` | 页面超时（毫秒） |
| `wait_until` | string | `"domcontentloaded"` | 等待条件 |
| `css_selector` | string | `null` | CSS选择器 |
| `excluded_tags` | array | `["script", "style", "nav", "footer"]` | 排除的标签 |

### 网站配置选项

| 配置项 | 类型 | 说明 |
|--------|------|------|
| `name` | string | 网站名称 |
| `base_url` | string | 基础URL |
| `start_urls` | array | 起始URL列表 |
| `selectors` | object | 内容选择器 |
| `overrides.crawler` | object | 覆盖爬虫配置 |
| `output.format` | string | 输出格式（json/dict/md） |
| `output.md_template` | string | Markdown模板名称 |

## 示例配置

### 东南大学官网公告爬取

见 `config/websites/seu.yaml`，针对东南大学官网优化配置。

### 测试网站配置

见 `config/websites/test_site.yaml`，使用 httpbin.org 进行测试。

## 运行测试

项目包含完整的单元测试和集成测试套件。

### 1. 单元测试

单元测试不依赖网络连接，使用模拟对象进行测试：

```bash
# 运行所有单元测试
python -m pytest tests/test_crawler.py -v

# 运行特定测试类
python -m pytest tests/test_crawler.py::TestConfigurableCrawler -v

# 运行特定测试方法
python -m pytest tests/test_crawler.py::TestConfigurableCrawler::test_crawl_single_url -v
```

### 2. 集成测试

集成测试需要网络连接，测试真实的网络爬取功能：

```bash
# 运行所有集成测试（需要网络）
python -m pytest tests/integration_test.py -v -m integration

# 运行单个集成测试
python -m pytest tests/integration_test.py::TestConfigurableCrawlerIntegration::test_crawl_single_url -v

# 跳过网络测试
python -m pytest tests/integration_test.py -v --ignore=tests/integration_test.py
```

### 3. 测试标记

项目使用pytest标记来分类测试：

- `@pytest.mark.integration`: 集成测试（需要网络连接）
- `@pytest.mark.performance`: 性能测试
- `@pytest.mark.slow`: 慢速测试

### 4. 测试覆盖率

要生成测试覆盖率报告，可以使用以下命令：

```bash
# 安装覆盖率工具
pip install pytest-cov

# 运行测试并生成覆盖率报告
python -m pytest --cov=src --cov-report=html --cov-report=term tests/

# 查看HTML报告
start htmlcov/index.html
```

### 5. 测试配置文件

集成测试使用 `config/websites/test_site.yaml` 配置文件，该文件配置了测试用的URL（httpbin.org）。

## 故障排除

### 常见问题

1. **配置文件不存在**
   ```
   FileNotFoundError: 网站配置文件不存在: config/websites/seu.yaml
   ```
   解决方案：创建对应的配置文件或检查路径。

2. **网络连接失败**
   ```
   爬取失败: 连接超时
   ```
   解决方案：检查网络连接，或调整 `page_timeout` 配置。

3. **内存不足**
   ```
   MemoryError: 内存不足
   ```
   解决方案：减少 `max_pages` 配置，或增加系统内存。

4. **浏览器启动失败**
   ```
   BrowserError: 无法启动浏览器
   ```
   解决方案：确保已安装浏览器，或检查 `browser_type` 配置。

### 调试建议

1. 设置 `verbose: true` 查看详细日志
2. 设置 `headless: false` 查看浏览器界面
3. 检查 `logs/crawler.log` 日志文件
4. 使用测试配置 `test_site.yaml` 验证基本功能

## 性能优化

1. **启用缓存**: 设置 `cache_mode: "ENABLED"`
2. **调整并发**: 设置 `semaphore_count` 控制并发数
3. **优化选择器**: 使用更精确的CSS选择器
4. **减少等待**: 调整 `wait_until` 和 `page_timeout`
5. **批量处理**: 合理设置 `max_pages` 和 `max_depth`

## 扩展开发

### 添加新功能

1. 在 `src/crawler.py` 中扩展 `ConfigurableCrawler` 类
2. 在配置文件中添加对应的配置项
3. 更新文档和测试

### 集成到其他项目

```python
# 作为模块导入
from crawler.src.crawler import ConfigurableCrawler

# 或复制整个crawler目录到项目中
