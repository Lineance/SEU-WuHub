"""同步 LanceDB 数据到 Meilisearch"""
import sys
from pathlib import Path

# 添加项目根目录到路径
project_root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(project_root))

import meilisearch


def main():
    print("=" * 60)
    print("同步 LanceDB 数据到 Meilisearch")
    print("=" * 60)

    # 连接到 Meilisearch
    client = meilisearch.Client('http://localhost:7700')
    index = client.index('articles')

    # 连接到 LanceDB
    sys.path.insert(0, str(project_root / 'backend'))
    from retrieval.store import LanceStore

    store = LanceStore()
    count = store.count()
    print(f"LanceDB 文档数: {count}")

    if count == 0:
        print("[WARN] LanceDB 中没有数据")
        return

    # 获取所有文档
    all_docs = store.table.to_pandas().to_dict("records")
    print(f"读取到 {len(all_docs)} 条文档")

    # 清理文档
    cleaned_docs = []
    for doc in all_docs:
        cleaned_doc = {
            "news_id": doc.get("news_id"),
            "title": doc.get("title", ""),
            "content_text": doc.get("content_text", ""),
            "publish_date": str(doc.get("publish_date")) if doc.get("publish_date") else None,
            "url": doc.get("url", ""),
            "source_site": doc.get("source_site", ""),
            "author": doc.get("author", ""),
            "tags": doc.get("tags", []),
            "last_updated": str(doc.get("last_updated")) if doc.get("last_updated") else None,
        }
        cleaned_docs.append(cleaned_doc)

    # 批量添加文档
    batch_size = 50
    total = len(cleaned_docs)

    for i in range(0, total, batch_size):
        batch = cleaned_docs[i:i + batch_size]
        task = index.add_documents(batch)
        client.wait_for_task(task.task_uid)
        print(f"已同步 {min(i + batch_size, total)}/{total} 条文档")

    print(f"\n[OK] 同步完成: {total} 条文档")

    # 验证
    stats = index.get_stats()
    print(f"Meilisearch 文档数: {stats.number_of_documents}")

    print("\n" + "=" * 60)
    print("同步完成!")
    print("=" * 60)


if __name__ == "__main__":
    main()
