"""
配置化爬虫集成测试
需要网络连接
"""
import pytest
import time
from pathlib import Path

from src.crawler import ConfigurableCrawler


class TestConfigurableCrawlerIntegration:
    """配置化爬虫集成测试（需要网络连接）"""
    
    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_crawl_single_url(self):
        """测试爬取单个URL（集成测试）"""
        async with ConfigurableCrawler() as crawler:
            results = await crawler.crawl("https://httpbin.org/html")
            
            assert len(results) == 1
            assert results[0]['success'] is True
            assert results[0]['url'] == "https://httpbin.org/html"
            # httpbin.org/html 页面应该有内容
            assert len(results[0]['markdown']) > 0 or len(results[0]['content']) > 0
    
    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_crawl_simple_website(self):
        """测试爬取简单网站（集成测试）"""
        async with ConfigurableCrawler() as crawler:
            # 使用测试网站配置
            results = await crawler.crawl("test_site", is_website_config=True)
            
            # test_site.yaml 应该配置了 httpbin.org 的URL
            assert len(results) > 0
            for result in results:
                assert result['success'] is True
                assert "httpbin.org" in result['url']
    
    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_crawl_httpbin(self):
        """测试爬取 httpbin.org（集成测试）"""
        async with ConfigurableCrawler() as crawler:
            urls = [
                "https://httpbin.org/html",
                "https://httpbin.org/json"
            ]
            
            results = await crawler.crawl(urls)
            
            assert len(results) == 2
            for result in results:
                assert result['success'] is True
                assert "httpbin.org" in result['url']
    
    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_context_manager_with_network(self):
        """测试上下文管理器与网络操作（集成测试）"""
        async with ConfigurableCrawler() as crawler:
            # 确保爬虫已启动
            assert crawler.crawler is not None
            
            # 执行一个简单的网络请求
            results = await crawler.crawl("https://httpbin.org/status/200")
            
            assert len(results) == 1
            assert results[0]['success'] is True
    
    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_error_handling(self):
        """测试错误处理（集成测试）"""
        async with ConfigurableCrawler() as crawler:
            # 测试不存在的URL
            results = await crawler.crawl("https://nonexistent-domain-12345.example.com")
            
            assert len(results) == 1
            # 应该失败，但不会抛出异常
            assert results[0]['success'] is False
            assert 'error' in results[0]
    
    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_config_reloading(self):
        """测试配置重新加载（集成测试）"""
        # 创建临时配置文件
        temp_config_dir = Path("temp_test_config")
        temp_config_dir.mkdir(exist_ok=True)
        
        # 创建浏览器配置
        browser_config = temp_config_dir / "browser.yaml"
        browser_config.write_text("""
browser:
  headless: true
  viewport_width: 1280
  viewport_height: 720
""")
        
        # 创建爬虫配置
        crawler_config = temp_config_dir / "crawler.yaml"
        crawler_config.write_text("""
crawler:
  cache_mode: "ENABLED"
  page_timeout: 30000
  word_count_threshold: 50
""")
        
        try:
            async with ConfigurableCrawler(config_dir=str(temp_config_dir)) as crawler:
                # 确保配置已加载
                assert crawler.browser_config is not None
                assert crawler.crawler_config is not None
                
                # 测试爬取
                results = await crawler.crawl("https://httpbin.org/html")
                assert len(results) == 1
                assert results[0]['success'] is True
        finally:
            # 清理临时文件
            import shutil
            if temp_config_dir.exists():
                shutil.rmtree(temp_config_dir)


class TestConfigurableCrawlerPerformance:
    """性能测试"""
    
    @pytest.mark.asyncio
    @pytest.mark.performance
    @pytest.mark.integration
    async def test_concurrent_crawling(self):
        """测试并发爬取性能"""
        async with ConfigurableCrawler() as crawler:
            # 多个URL同时爬取
            urls = [
                "https://httpbin.org/html",
                "https://httpbin.org/json",
                "https://httpbin.org/xml",
                "https://httpbin.org/robots.txt"
            ]
            
            start_time = time.time()
            results = await crawler.crawl(urls)
            end_time = time.time()
            
            execution_time = end_time - start_time
            
            print(f"并发爬取 {len(urls)} 个URL耗时: {execution_time:.2f}秒")
            
            assert len(results) == len(urls)
            # 验证所有请求都成功（或至少大部分成功）
            success_count = sum(1 for r in results if r['success'])
            assert success_count >= len(urls) - 1  # 允许一个失败


@pytest.mark.skip(reason="需要真实网站配置")
class TestRealWebsiteCrawling:
    """真实网站爬取测试（需要特定配置）"""
    
    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_crawl_example_site(self):
        """测试爬取 example.yaml 配置的网站"""
        async with ConfigurableCrawler() as crawler:
            results = await crawler.crawl("example", is_website_config=True)
            
            # example.yaml 应该配置了 example.com 的URL
            assert len(results) > 0
            for result in results:
                assert result['success'] is True
                assert "example.com" in result['url']


if __name__ == "__main__":
    # 运行集成测试
    import sys
    import os
    
    # 添加项目根目录到Python路径
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    
    # 运行测试
    pytest_args = [
        __file__,
        "-v",
        "-m", "integration",
        "--tb=short"
    ]
    
    # 如果提供了参数，使用提供的参数
    if len(sys.argv) > 1:
        pytest_args = sys.argv[1:]
    
    pytest.main(pytest_args)