import asyncio
import sys
import os

# 添加父目录到Python路径，以便导入src.crawler
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
sys.path.insert(0, parent_dir)

# 从src.crawler导入ConfigurableCrawler
from src.crawler import ConfigurableCrawler

async def quickstart():
    # 使用 async with 自动管理浏览器的启动和关闭
    async with ConfigurableCrawler() as crawler:
        
        # 场景 1: 直接抓取 URL (简单模式)
        print("\n--- 任务 1: 简单抓取 ---")
        simple_results = await crawler.crawl("https://www.example.com")
        for res in simple_results:
            if res['success']:
                print(f"成功抓取: {res['title']} (URL: {res['url']})")

        # 场景 2: 使用配置文件执行深度爬取 (配置模式)
        print("\n--- 任务 2: 深度爬取 (基于 example.yaml) ---")
        deep_results = await crawler.crawl(target="example", is_website_config=True)
        
        print(f"深度爬取完成，共获得 {len(deep_results)} 个页面结果")
        
        # 打印最后一个页面的部分 Markdown 内容
        if deep_results:
            last_page = deep_results[-1]
            print(f"最后一页标题: {last_page['title']}")
            print(f"内容摘要: {last_page['markdown'][:100]}...")

if __name__ == "__main__":
    try:
        asyncio.run(quickstart())
    except KeyboardInterrupt:
        print("\n程序已被用户停止")