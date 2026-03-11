import yaml
import logging
from datetime import datetime
from typing import Dict, List, Any, Optional, Union
from pathlib import Path

from crawl4ai import (
    AsyncWebCrawler, 
    BrowserConfig, 
    CrawlerRunConfig, 
    CacheMode
)
from crawl4ai.deep_crawling.bfs_strategy import BFSDeepCrawlStrategy

class ConfigurableCrawler:
    
    def __init__(self, config_dir: Optional[str] = None):
        """
        初始化爬虫，确保路径不受运行位置影响
        """
        # 1. 绝对定位：获取 crawler.py 所在的 src 目录
        self.base_script_path = Path(__file__).resolve().parent
        
        # 2. 核心修复：如果用户没传路径，【强制】拼接脚本目录下的 config
        if config_dir is None:
            self.config_dir = self.base_script_path.parent / "config_data"
        else:
            # 如果用户传了路径，我们才尊重用户的意愿
            self.config_dir = Path(config_dir).resolve()

        self.browser_config = None
        self.crawler_config = None
        self.crawler = None
        
        # 3. 设置日志（建议也将日志锁定在项目目录下）
        self.logger = self._setup_logger()
        
        # 4. 加载配置
        self._load_configs()
        
        # 打印调试信息，确保这次路径是对的
        self.logger.info(f"配置化爬虫初始化完成")
        self.logger.info(f"脚本所在位置: {self.base_script_path}")
        self.logger.info(f"实际搜索配置的路径: {self.config_dir}")
    
    def _load_configs(self):
        """加载所有配置文件"""
        try:
            # 加载浏览器配置
            browser_config_path = self.config_dir / "browser.yaml"
            if browser_config_path.exists():
                browser_data = self._load_yaml_config(browser_config_path)
                self.browser_config = BrowserConfig(**browser_data.get('browser', {}))
                self.logger.debug("浏览器配置加载成功")
            else:
                self.browser_config = BrowserConfig()
                self.logger.warning(f"浏览器配置文件不存在: {browser_config_path}，使用默认配置")
            
            # 加载爬虫配置
            crawler_config_path = self.config_dir / "crawler.yaml"
            if crawler_config_path.exists():
                crawler_data = self._load_yaml_config(crawler_config_path)
                self.crawler_config = self._create_crawler_config(crawler_data.get('crawler', {}))
                self.logger.debug("爬虫配置加载成功")
            else:
                self.crawler_config = CrawlerRunConfig()
                self.logger.warning(f"爬虫配置文件不存在: {crawler_config_path}，使用默认配置")
                
        except Exception as e:
            self.logger.error(f"配置文件加载失败: {e}")
            raise
    
    def _load_yaml_config(self, filepath: Path) -> Dict[str, Any]:
        """加载YAML配置文件"""
        with open(filepath, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f)
    
    def _create_crawler_config(self, config_data: Dict[str, Any]) -> CrawlerRunConfig:
        """创建CrawlerRunConfig对象"""
        # 处理缓存模式
        if 'cache_mode' in config_data:
            cache_mode_str = config_data.pop('cache_mode')
            try:
                cache_mode = getattr(CacheMode, cache_mode_str)
                config_data['cache_mode'] = cache_mode
            except AttributeError:
                self.logger.warning(f"无效的缓存模式: {cache_mode_str}，使用默认值")
        
        # 处理 deep_crawl_strategy - 如果存在且是字典，需要转换为 BFSDeepCrawlStrategy 实例
        deep_crawl_config = config_data.pop('deep_crawl_strategy', None)
        
        # 创建配置对象
        crawler_config = CrawlerRunConfig(**config_data)
        
        # 如果 deep_crawl_strategy 配置存在且启用了深度爬取
        if deep_crawl_config and deep_crawl_config.get('enabled', False):
            try:
                max_depth = deep_crawl_config.get('max_depth', 3)
                max_pages = deep_crawl_config.get('max_pages', 100)
                same_domain_only = deep_crawl_config.get('same_domain_only', True)
                include_external = not same_domain_only
                
                crawler_config.deep_crawl_strategy = BFSDeepCrawlStrategy(
                    max_depth=max_depth,
                    max_pages=max_pages,
                    include_external=include_external
                )
                self.logger.debug(f"深度爬取策略已配置: max_depth={max_depth}, max_pages={max_pages}")
            except Exception as e:
                self.logger.warning(f"创建深度爬取策略失败: {e}")
        
        return crawler_config
    
    def _setup_logger(self) -> logging.Logger:
        """强化版日志初始化，锁定绝对路径"""
        logger = logging.getLogger('crawler')
        
        if not logger.handlers:
            logger.setLevel(logging.INFO)
            
            # 将日志文件夹固定在脚本所在目录的 parent 或指定位置
            # 例如：D:\crawler\logs\crawler.log
            log_dir = self.base_script_path.parent / "logs"
            log_dir.mkdir(parents=True, exist_ok=True)
            log_file = log_dir / "crawler.log"
            
            # 文件输出
            file_handler = logging.FileHandler(log_file, encoding='utf-8')
            file_formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
            file_handler.setFormatter(file_formatter)
            logger.addHandler(file_handler)
            
            # 控制台输出
            console_handler = logging.StreamHandler()
            console_handler.setFormatter(file_formatter)
            logger.addHandler(console_handler)
            
        return logger
    
    def load_website_config(self, website_name: str) -> Dict[str, Any]:
        """
        加载网站特定配置
        
        Args:
            website_name: 网站配置名称（对应config_data/websites/下的yaml文件名）
            
        Returns:
            网站配置字典
        """
        config_path = self.config_dir / "websites" / f"{website_name}.yaml"
        
        if not config_path.exists():
            self.logger.error(f"找不到配置文件。尝试搜索路径: {config_path.absolute()}")
            raise FileNotFoundError(f"网站配置文件不存在: {config_path}")
        
        try:
            config = self._load_yaml_config(config_path)
            self.logger.debug(f"网站配置加载成功: {website_name}")
            return config
        except Exception as e:
            self.logger.error(f"网站配置加载失败 {website_name}: {e}")
            raise
    
    def _merge_configs(self, base_config: CrawlerRunConfig, 
                      overrides: Dict[str, Any]) -> CrawlerRunConfig:
        """
        合并配置（网站特定配置覆盖通用配置）
        
        Args:
            base_config: 基础配置
            overrides: 覆盖配置
            
        Returns:
            合并后的配置
        """
        if not overrides:
            return base_config
        
        # 使用clone方法创建新配置
        merged_config = base_config.clone()
        
        # 特殊处理缓存模式
        if 'cache_mode' in overrides:
            cache_mode_str = overrides.pop('cache_mode')
            try:
                cache_mode = getattr(CacheMode, cache_mode_str)
                merged_config.cache_mode = cache_mode
            except AttributeError:
                self.logger.warning(f"无效的缓存模式: {cache_mode_str}，使用基础配置")
        
        # 更新其他属性
        for key, value in overrides.items():
            if hasattr(merged_config, key):
                setattr(merged_config, key, value)
            else:
                self.logger.warning(f"配置项不存在，跳过: {key}")
        
        return merged_config
    
    async def crawl(self, 
                    target: Union[str, List[str]],  
                    is_website_config: bool = False,
                    override_config: Optional[Dict] = None) -> List[Dict[str, Any]]:
        """
        统一爬虫入口
        """
        await self.start()
        results = []
        urls_to_crawl = []
        current_run_config = self.crawler_config.clone() if self.crawler_config else CrawlerRunConfig()

        # 1. 解析目标和合并配置
        if is_website_config:
            web_cfg = self.load_website_config(target).get('website', {})
            urls_to_crawl = web_cfg.get('start_urls', [])
            
            # 合并网站特定配置
            site_overrides = web_cfg.get('overrides', {}).get('crawler', {})
            current_run_config = self._merge_configs(current_run_config, site_overrides)
            
            # 处理网站配置专属的 deep_crawl 块 (复用实例化逻辑)
            dc_cfg = web_cfg.get('deep_crawl', {})
            if dc_cfg.get('enabled', False):
                # 建议将这段逻辑提取为一个独立方法，例如 self._build_deep_crawl_strategy(dc_cfg)
                current_run_config.deep_crawl_strategy = BFSDeepCrawlStrategy(
                    max_depth=dc_cfg.get('max_depth', 3),
                    max_pages=dc_cfg.get('max_pages', 100),
                    include_external=not dc_cfg.get('same_domain_only', True)
                )
        else:
            urls_to_crawl = [target] if isinstance(target, str) else target
            if override_config:
                current_run_config = self._merge_configs(current_run_config, override_config)

        # 核心修复点：通过最终的 config 对象来判断是否需要深度爬取，而不是维护一个容易出错的 is_deep 变量
        is_deep = current_run_config.deep_crawl_strategy is not None

        # 2. 执行爬取
        try:
            for url in urls_to_crawl:
                action_name = "深度爬取" if is_deep else "普通爬取"
                self.logger.info(f"开始{action_name}: {url}")
                
                # 无论普通还是深度，都只调 arun()
                # crawl4ai 内部会读取 config.deep_crawl_strategy 自动开启深度遍历
                res = await self.crawler.arun(url=url, config=current_run_config)
                
                # 处理不同模式下的返回结果类型
                import inspect
                if inspect.isasyncgen(res):
                    # 深度爬取如果开启了 stream=True (流式返回)
                    async for r in res:
                        results.append(self._format_result(r))
                elif isinstance(res, list):
                    # 深度爬取默认返回结果列表
                    results.extend([self._format_result(r) for r in res])
                else:
                    # 普通爬取返回单个结果对象
                    results.append(self._format_result(res))
                    
        except Exception as e:
            self.logger.error(f"爬取过程中出错: {e}")
            # 这里的格式要和 _format_result 保持一致，尤其是 'error' 键
            results.append({
                'success': False, 
                'url': urls_to_crawl[0] if urls_to_crawl else "unknown",
                'error': str(e),
                'markdown': ''
            })

        return results

    def _format_result(self, result: Any) -> Dict[str, Any]:
        # 1. 处理已经是字典的情况（通常是代码中 try-except 捕获后手动构造的）
        if isinstance(result, dict):
            defaults = {
                'success': False,
                'url': '',
                'title': '',
                'content': '',
                'markdown': '',
                'error': result.get('error', 'Unknown internal error'), # 确保 error 键存在
                'metadata': {
                    'crawled_at': datetime.now().isoformat(),
                    'word_count': 0,
                    'is_pdf': False,
                    'depth': 0
                },
                'pdf_size': 0
            }
            # 将缺失的默认字段补全到 result 中
            for key, value in defaults.items():
                if key not in result:
                    result[key] = value
            return result

        # 2. 处理 CrawlResult 对象类型
        # 提取 Markdown 内容 (处理 None 避免切片报错)
        markdown_content = ""
        if hasattr(result, 'markdown_v2') and result.markdown_v2:
            markdown_content = getattr(result.markdown_v2, 'raw_markdown', "") or ""
        elif hasattr(result, 'markdown'):
            markdown_content = result.markdown or ""

        # 获取基础属性
        url = getattr(result, 'url', '')
        success = getattr(result, 'success', False)
        # 从 Crawl4AI 的结果中获取错误信息
        error_msg = getattr(result, 'error_message', None)

        is_pdf = getattr(result, 'pdf', None) is not None or (url and url.lower().endswith('.pdf'))

        formatted = {
            'success': success,
            'url': url,
            'title': getattr(result, 'title', '') or "",
            'content': getattr(result, 'cleaned_html', ''),
            'markdown': markdown_content,
            'metadata': {
                'crawled_at': datetime.now().isoformat(),
                'word_count': getattr(result, 'word_count', 0) or 0,
                'is_pdf': is_pdf,
                'depth': getattr(result, 'depth', 0) or 0
            },
            'pdf_size': len(result.pdf) if getattr(result, 'pdf', None) else 0
        }

        # 3. 核心修复：如果爬取不成功，强制添加 'error' 字段以通过测试
        if not success:
            formatted['error'] = error_msg or "Crawl failed without specific error message"

        return formatted
    
    async def start(self):
        """显式启动爬虫浏览器实例"""
        if not self.crawler:
            self.crawler = AsyncWebCrawler(config=self.browser_config)
            await self.crawler.start()

    async def close(self):
        """异步关闭爬虫，释放资源"""
        if self.crawler:
            try:
                await self.crawler.close()
                self.crawler = None
                self.logger.info("爬虫已关闭")
            except Exception as e:
                self.logger.error(f"关闭爬虫时出错: {e}")

    async def __aenter__(self):
        """支持 async with 语法"""
        await self.start()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """退出 async with 块时自动关闭"""
        await self.close()
        if exc_type:
            self.logger.error(f"爬虫执行异常: {exc_val}")
        return False