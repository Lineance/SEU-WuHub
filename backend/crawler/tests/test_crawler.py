"""
配置化爬虫单元测试
"""
import pytest
from pathlib import Path
from unittest.mock import Mock, AsyncMock, patch

from src.crawler import ConfigurableCrawler


class TestConfigurableCrawler:
    """ConfigurableCrawler 单元测试"""
    
    def test_init_with_default_config_dir(self):
        """测试使用默认配置目录初始化"""
        crawler = ConfigurableCrawler()
        assert crawler.config_dir == Path("config")
        assert crawler.browser_config is not None
        assert crawler.crawler_config is not None
        assert crawler.crawler is None
    
    def test_init_with_custom_config_dir(self):
        """测试使用自定义配置目录初始化"""
        crawler = ConfigurableCrawler(config_dir="custom_config")
        assert crawler.config_dir == Path("custom_config")
    
    def test_load_website_config_success(self):
        """测试成功加载网站配置"""
        crawler = ConfigurableCrawler()
        
        # 创建测试配置文件
        test_config = {
            "website": {
                "name": "测试网站",
                "base_url": "https://test.example.com",
                "start_urls": ["https://test.example.com/page1"]
            }
        }
        
        # 模拟文件读取
        with patch('src.crawler.ConfigurableCrawler._load_yaml_config') as mock_load:
            mock_load.return_value = test_config
            config = crawler.load_website_config("test_site")
            
            assert config == test_config
            mock_load.assert_called_once()
    
    def test_load_website_config_not_found(self):
        """测试加载不存在的网站配置"""
        crawler = ConfigurableCrawler()
        
        with pytest.raises(FileNotFoundError):
            crawler.load_website_config("non_existent")
    
    @pytest.mark.asyncio
    async def test_crawl_single_url(self):
        """测试爬取单个URL"""
        crawler = ConfigurableCrawler()
        
        # 模拟 AsyncWebCrawler
        mock_crawler = AsyncMock()
        mock_crawler.arun = AsyncMock(return_value=Mock(
            success=True,
            url="https://www.example.com",
            title="Example Domain",
            cleaned_html="<html>test</html>",
            markdown="# Example Domain",
            word_count=10,
            pdf=None
        ))
        
        with patch('src.crawler.AsyncWebCrawler', return_value=mock_crawler):
            # 直接设置 crawler.crawler，避免调用 start 方法
            crawler.crawler = mock_crawler
            results = await crawler.crawl("https://www.example.com")
            
            assert len(results) == 1
            assert results[0]['success'] is True
            assert results[0]['url'] == "https://www.example.com"
            assert results[0]['title'] == "Example Domain"
    
    @pytest.mark.asyncio
    async def test_crawl_with_website_config(self):
        """测试使用网站配置进行爬取"""
        crawler = ConfigurableCrawler()
        
        # 模拟网站配置
        test_config = {
            "website": {
                "name": "测试网站",
                "start_urls": [
                    "https://test.example.com/page1",
                    "https://test.example.com/page2"
                ]
            }
        }
        
        # 创建模拟的爬取结果
        mock_result1 = Mock(
            success=True,
            url="https://test.example.com/page1",
            title="Page 1",
            cleaned_html="<html>page1</html>",
            markdown="# Page 1",
            word_count=20,
            pdf=None  # 设置为 None，避免 len() 调用问题
        )
        mock_result2 = Mock(
            success=True,
            url="https://test.example.com/page2",
            title="Page 2",
            cleaned_html="<html>page2</html>",
            markdown="# Page 2",
            word_count=30,
            pdf=None  # 设置为 None，避免 len() 调用问题
        )
        
        # 模拟 AsyncWebCrawler
        mock_crawler = AsyncMock()
        mock_crawler.arun = AsyncMock(side_effect=[mock_result1, mock_result2])
        
        with patch('src.crawler.AsyncWebCrawler', return_value=mock_crawler):
            # 直接设置 crawler.crawler，避免调用 start 方法
            crawler.crawler = mock_crawler
            with patch.object(crawler, 'load_website_config', return_value=test_config):
                results = await crawler.crawl("test_site", is_website_config=True)
                
                assert len(results) == 2
                assert results[0]['url'] == "https://test.example.com/page1"
                assert results[1]['url'] == "https://test.example.com/page2"
    
    @pytest.mark.asyncio
    async def test_context_manager(self):
        """测试上下文管理器"""
        mock_crawler = AsyncMock()
        mock_crawler.start = AsyncMock()
        mock_crawler.close = AsyncMock()
        
        with patch('src.crawler.AsyncWebCrawler', return_value=mock_crawler):
            async with ConfigurableCrawler() as crawler:
                assert crawler.crawler is not None
            
            mock_crawler.start.assert_called_once()
            mock_crawler.close.assert_called_once()


class TestConfigLoading:
    """配置加载测试"""
    
    def test_missing_browser_config(self):
        """测试缺少浏览器配置文件"""
        with patch('pathlib.Path.exists', side_effect=lambda: False):
            crawler = ConfigurableCrawler()
            # 应该使用默认配置而不抛出异常
            assert crawler.browser_config is not None
    
    def test_missing_crawler_config(self):
        """测试缺少爬虫配置文件"""
        with patch('pathlib.Path.exists', side_effect=lambda: False):
            crawler = ConfigurableCrawler()
            # 应该使用默认配置而不抛出异常
            assert crawler.crawler_config is not None
    
    def test_invalid_yaml_config(self):
        """测试无效的YAML配置"""
        with patch('builtins.open', side_effect=Exception("Invalid YAML")):
            with pytest.raises(Exception, match="Invalid YAML"):
                crawler = ConfigurableCrawler()
                # 应该抛出异常，不会执行到这里


if __name__ == "__main__":
    pytest.main([__file__, "-v"])