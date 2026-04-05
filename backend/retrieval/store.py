"""
LanceStore - LanceDB 表操作封装

提供 LanceDB 表的高级操作接口，支持向量索引和全文索引。

Responsibilities:
    - 表 CRUD 操作 (带向量生成)
    - 索引管理 (IVF-PQ, Tantivy FTS)
    - Schema 验证
    - 批量操作
"""

import logging
import re
from typing import Any, Literal, cast

import pyarrow as pa

# 导入数据层组件
from backend.database import ArticleRepository, get_article_repository
from backend.database.schema import ArticleFields
from lancedb.table import Table

from .schema.article import Article, ArticleQuery
from .utils.embedding import RetrievalEmbedder, get_retrieval_embedder

logger = logging.getLogger(__name__)

# Meilisearch 客户端
_meilisearch_client: "meilisearch.Client | None" = None


# =============================================================================
# LanceStore 类
# =============================================================================


class LanceStore:
    """
    LanceDB 表操作封装

    提供高级的 LanceDB 表操作接口，支持:
    - 向量搜索 (IVF-PQ 索引)
    - 全文搜索 (Tantivy 索引)
    - 混合搜索 (向量 + 关键词)
    - 索引管理
    """

    def __init__(
        self,
        table: Table | None = None,
        repository: ArticleRepository | None = None,
        embedder: RetrievalEmbedder | None = None,
        db_path: str | None = None,
        table_name: str = "articles",
    ) -> None:
        """
        初始化 LanceStore

        Args:
            table: LanceDB 表对象
            repository: 数据仓库
            embedder: 检索向量化器
            db_path: 数据库路径
            table_name: 表名
        """
        self._table = table
        self._repository = repository or get_article_repository()
        self._embedder = embedder or get_retrieval_embedder()

        if not self._table and db_path:
            self._initialize_table(db_path, table_name)

        logger.info(f"LanceStore initialized for table: {table_name}")

    def _initialize_table(self, db_path: str, table_name: str) -> None:
        """初始化表"""
        try:
            import lancedb

            db = lancedb.connect(db_path)
            if table_name in db.table_names():
                self._table = db.open_table(table_name)
                logger.info(f"Opened existing table: {table_name}")
            else:
                # 创建新表
                schema = Article.get_schema()
                self._table = db.create_table(table_name, schema=schema)
                logger.info(f"Created new table: {table_name}")
        except Exception as e:
            logger.error(f"Failed to initialize table: {e}")
            raise

    # =========================================================================
    # 表操作
    # =========================================================================

    @property
    def table(self) -> Table:
        """获取表对象"""
        if self._table is None:
            raise ValueError("Table not initialized")
        return self._table

    def count(self) -> int:
        """获取记录数"""
        return int(self.table.count_rows())

    def schema(self) -> pa.Schema:
        """获取表结构"""
        return self.table.schema

    def info(self) -> dict[str, Any]:
        """获取表信息"""
        return {
            "name": self.table.name,
            "count": self.count(),
            "schema": str(self.schema()),
            "indices": self.list_indices(),
        }

    # =========================================================================
    # 索引管理
    # =========================================================================

    def create_vector_index(
        self,
        field: str = "content_embedding",
        index_type: Literal[
            "IVF_FLAT", "IVF_SQ", "IVF_PQ", "IVF_HNSW_SQ", "IVF_HNSW_PQ", "IVF_RQ"
        ] = "IVF_PQ",
        num_partitions: int = 256,
        num_sub_vectors: int = 64,  # 必须是向量维度的因数 (1024=2^10, 可选 64/128/256/512)
        adaptive: bool = True,
        min_data_for_training: int = 10,
        min_partitions: int = 4,
        max_partitions: int = 256,
        enable_brute_force_fallback: bool = True,
        **kwargs: Any,
    ) -> None:
        """
        创建向量索引（支持暴力检索回退）

        Args:
            field: 向量字段名
            index_type: 索引类型 (IVF_FLAT, IVF_SQ, IVF_PQ, IVF_HNSW_SQ, IVF_HNSW_PQ, IVF_RQ)
            num_partitions: IVF 分区数
            num_sub_vectors: PQ 子向量数
            adaptive: 是否启用自适应模式（根据数据量动态调整参数）
            min_data_for_training: 开始训练的最小数据量
            min_partitions: 最小分区数
            max_partitions: 最大分区数
            enable_brute_force_fallback: 是否启用暴力检索回退（数据量<256时）
            **kwargs: 其他参数
        """
        try:
            if field not in ["title_embedding", "content_embedding"]:
                raise ValueError(f"Invalid vector field: {field}")

            # 检查是否已存在索引
            existing = self.list_indices()
            if any(idx["column"] == field for idx in existing):
                logger.info(f"Vector index for {field} already exists")
                return

            # 获取当前数据量
            data_count = self.count()

            # 数据量不足256条时，回退到暴力检索
            if enable_brute_force_fallback and data_count < 256:
                logger.info(f"数据量不足256条 ({data_count} < 256)，回退到暴力向量检索")
                logger.info("  说明：IVF-PQ索引需要至少256条数据进行训练")
                logger.info("  暴力检索：使用线性扫描，计算查询向量与所有向量的相似度")
                logger.info(f"  性能：{data_count}条数据，毫秒级响应")
                return  # 跳过索引创建，让LanceDB使用暴力检索

            # 自适应参数调整
            final_num_partitions = num_partitions
            final_index_type = index_type

            if adaptive:
                if data_count < min_data_for_training:
                    logger.info(f"数据量不足({data_count} < {min_data_for_training})，跳过索引创建")
                    logger.info("    注意：少量数据时IVF-PQ索引需要训练，建议积累数据后重试")
                    return
                else:
                    # 动态计算分区数：sqrt(n) 但不超过max_partitions
                    import math

                    calculated_partitions = int(min(max_partitions, math.sqrt(data_count) * 2))
                    calculated_partitions = max(min_partitions, calculated_partitions)

                    # 确保分区数不超过数据量
                    calculated_partitions = min(calculated_partitions, data_count)

                    if calculated_partitions != num_partitions:
                        logger.info(
                            f"自适应调整参数: {data_count}条数据 -> {calculated_partitions}个分区"
                        )
                        final_num_partitions = calculated_partitions

            # 创建索引
            logger.info(
                f"创建{final_index_type}索引 for {field} (数据量: {data_count}, 分区数: {final_num_partitions})"
            )

            self.table.create_index(
                vector_column_name=field,
                index_type=final_index_type,
                metric="cosine",
                replace=True,
                num_partitions=final_num_partitions,  # IVF_PQ 专用
                num_sub_vectors=num_sub_vectors,  # IVF_PQ 专用
                **kwargs,
            )
            logger.info(f"成功创建 {final_index_type} 索引 for {field}")

        except Exception as e:
            error_msg = str(e)
            if "KMeans cannot train" in error_msg or "Not enough rows to train PQ" in error_msg:
                logger.warning(f"向量索引训练失败（数据量不足）: {error_msg}")
                logger.warning("建议：积累更多数据（至少256条）或使用暴力检索")
                if enable_brute_force_fallback:
                    logger.info("已启用暴力检索回退，向量搜索将使用线性扫描")
            else:
                logger.error(f"创建向量索引失败: {e}")
                raise

    def create_fulltext_index(
        self,
        fields: list[str] | None = None,
        **kwargs: Any,
    ) -> None:
        """
        创建全文索引

        注意：Native FTS 索引一次只能为一个字段创建
        需要为每个字段单独创建索引

        Args:
            fields: 索引字段列表
            **kwargs: 其他参数
        """
        try:
            if fields is None:
                fields = Article.get_searchable_fields()

            # 为每个字段单独创建全文索引（使用 replace=True 自动处理已存在的索引）
            for field in fields:
                try:
                    self.table.create_fts_index(
                        field,
                        replace=True,
                        **kwargs,
                    )
                    logger.info(f"Created fulltext index for field: '{field}'")
                except Exception as e:
                    # LanceDB 的 replace=True 在某些版本中有 bug，如果索引已存在会报错
                    # 这种情况下索引已经存在，不需要处理
                    error_str = str(e).lower()
                    if "already exists" in error_str and "index" in error_str:
                        logger.info(
                            f"FTS index for field '{field}' already exists, skipping creation"
                        )
                    else:
                        raise  # 其他错误继续抛出
        except Exception as e:
            logger.error(f"Failed to create fulltext index: {e}")
            raise

    def list_indices(self) -> list[dict[str, Any]]:
        """列出所有索引"""
        try:
            indices = self.table.list_indices()
            # 将 IndexConfig 对象转换为字典
            return [
                {
                    "name": idx.name,
                    "type": idx.index_type,
                    "column": getattr(idx, "column", None) or getattr(idx, "columns", None),
                }
                for idx in indices
            ]
        except Exception as e:
            logger.warning(f"Failed to list indices: {e}")
            return []

    def optimize_indices(self) -> None:
        """优化索引"""
        try:
            self.table.optimize()
            logger.info("Indices optimized")
        except Exception as e:
            logger.error(f"Failed to optimize indices: {e}")
            raise

    # =========================================================================
    # 搜索操作
    # =========================================================================

    def vector_search(
        self,
        query_vector: list[float],
        vector_field: str = "content_embedding",
        limit: int = 10,
        offset: int = 0,
        where: str | None = None,
        **kwargs: Any,
    ) -> list[dict[str, Any]]:
        """
        向量搜索

        Args:
            query_vector: 查询向量
            vector_field: 向量字段
            limit: 返回数量
            offset: 偏移量
            where: 过滤条件
            **kwargs: 其他参数

        Returns:
            搜索结果列表
        """
        try:
            results = self.table.search(
                query=query_vector,
                vector_column_name=vector_field,
            ).limit(limit).offset(offset)

            if where:
                results = results.where(where)

            return cast("list[dict[str, Any]]", results.to_list())
        except Exception as e:
            logger.error(f"Vector search failed: {e}")
            raise

    def fulltext_search(
        self,
        query: str,
        fields: list[str] | None = None,
        limit: int = 10,
        offset: int = 0,
        where: str | None = None,
        **kwargs: Any,
    ) -> list[dict[str, Any]]:
        """全文搜索（使用 Meilisearch）"""
        try:
            if fields is None:
                fields = Article.get_searchable_fields()

            # 尝试使用 Meilisearch
            client = self._get_meilisearch_client()
            if client is not None:
                return self._meilisearch_search(query, fields, limit, offset, where, **kwargs)

            # 降级到 LanceDB FTS
            logger.warning("Meilisearch unavailable, falling back to LanceDB FTS")
            return self._lance_fts_search(query, fields, limit, offset, where)
        except Exception as e:
            logger.error(f"Fulltext search failed: {e}")
            return self._simple_text_search(query, fields or Article.get_searchable_fields(), limit, where)

    def _simple_text_search(
        self,
        query: str,
        fields: list[str],
        limit: int = 10,
        where: str | None = None,
    ) -> list[dict[str, Any]]:
        """
        简单的文本搜索（降级方案）

        Args:
            query: 查询文本
            fields: 搜索字段
            limit: 返回数量
            where: 过滤条件

        Returns:
            搜索结果列表
        """
        try:
            # 获取所有文档
            all_docs = self.table.to_pandas().to_dict("records")

            # 过滤条件
            filtered_docs = all_docs
            if where:
                # 简单的 where 条件解析（仅支持简单的字段比较）
                filtered_docs = self._apply_simple_where(filtered_docs, where)

            # 文本匹配
            scored_docs = []
            for doc in filtered_docs:
                score = 0.0

                # 在每个字段中搜索查询词
                for field in fields:
                    if field in doc:
                        text = str(doc[field]).lower()
                        query_terms = query.lower().split()

                        # 计算匹配分数
                        for term in query_terms:
                            if term in text:
                                # 完全匹配加分更多
                                if text == term:
                                    score += 2.0
                                elif re.search(rf"\b{re.escape(term)}\b", text):
                                    score += 1.5
                                else:
                                    score += 1.0

                if score > 0:
                    doc["_score"] = score
                    scored_docs.append(doc)

            # 按分数排序
            scored_docs.sort(key=lambda x: x.get("_score", 0), reverse=True)

            # 限制结果数量
            return scored_docs[:limit]

        except Exception as e:
            logger.error(f"Simple text search failed: {e}")
            return []

    def _apply_simple_where(self, docs: list[dict[str, Any]], where: str) -> list[dict[str, Any]]:
        """
        应用简单的 where 条件

        Args:
            docs: 文档列表
            where: where 条件字符串

        Returns:
            过滤后的文档列表
        """
        if not where:
            return docs

        try:
            filtered = [doc for doc in docs if self._evaluate_simple_condition(doc, where)]
            return filtered
        except Exception as e:
            logger.warning(f"Failed to apply where condition: {e}")
            return docs

    def _evaluate_simple_condition(self, doc: dict[str, Any], condition: str) -> bool:
        """
        评估简单的条件

        Args:
            doc: 文档
            condition: 条件字符串

        Returns:
            是否满足条件
        """
        # 移除空格
        condition = condition.strip()

        # 检查是否包含 !=
        if "!=" in condition:
            field, value = condition.split("!=")
            field = field.strip()
            value = value.strip().strip("'\"")
            return str(doc.get(field, "")) != value

        # 检查是否包含 =
        elif "=" in condition:
            field, value = condition.split("=")
            field = field.strip()
            value = value.strip().strip("'\"")
            return str(doc.get(field, "")) == value

        # 默认返回 True
        return True

    def _get_meilisearch_client(self) -> "meilisearch.Client | None":
        """获取 Meilisearch 客户端（单例）"""
        global _meilisearch_client
        if _meilisearch_client is not None:
            return _meilisearch_client

        try:
            import meilisearch
            from backend.app.core.config import settings

            _meilisearch_client = meilisearch.Client(
                settings.MEILISEARCH_HOST,
                settings.MEILISEARCH_API_KEY,
            )
            _meilisearch_client.health()
            logger.info(f"Meilisearch connected: {settings.MEILISEARCH_HOST}")
            return _meilisearch_client
        except Exception as e:
            logger.warning(f"Meilisearch connection failed: {e}")
            _meilisearch_client = None
            return None

    def _meilisearch_search(
        self,
        query: str,
        fields: list[str],
        limit: int,
        offset: int,
        where: str | None = None,
        **kwargs: Any,
    ) -> list[dict[str, Any]]:
        """使用 Meilisearch 进行全文搜索"""
        try:
            client = self._get_meilisearch_client()
            if client is None:
                raise RuntimeError("Meilisearch client not available")

            index = client.index("articles")

            search_params: dict[str, Any] = {
                "limit": limit,
                "offset": offset,
                "attributesToRetrieve": [
                    "news_id", "title", "content_text", "publish_date",
                    "url", "source_site", "author", "tags", "last_updated",
                ],
                "attributesToHighlight": ["title", "content_text"],
            }

            if where:
                filter_str = self._build_meilisearch_filter(where)
                if filter_str:
                    search_params["filter"] = filter_str

            results = index.search(query, search_params)

            processed_results = []
            for hit in results.get("hits", []):
                if "_formatted" in hit:
                    hit["title_highlighted"] = hit["_formatted"].get("title", hit.get("title", ""))
                    hit["content_highlighted"] = hit["_formatted"].get("content_text", hit.get("content_text", "")[:200])
                processed_results.append(hit)

            logger.info(f"Meilisearch search: query='{query}', hits={len(processed_results)}")
            return processed_results
        except Exception as e:
            logger.error(f"Meilisearch search failed: {e}")
            raise

    def meilisearch_hybrid_search(
        self,
        query: str,
        semantic_ratio: float = 0.5,
        limit: int = 10,
        offset: int = 0,
        where: str | None = None,
        **kwargs: Any,
    ) -> list[dict[str, Any]]:
        """
        使用 Meilisearch 原生 Hybrid Search

        Args:
            query: 查询文本
            semantic_ratio: 语义搜索权重 (0.0-1.0)
                - 0.0: 纯关键词搜索
                - 1.0: 纯语义搜索
                - 0.5: 平衡模式
            limit: 返回数量
            offset: 偏移量
            where: 过滤条件

        Returns:
            搜索结果列表
        """
        try:
            client = self._get_meilisearch_client()
            if client is None:
                raise RuntimeError("Meilisearch client not available")

            index = client.index("articles")

            search_params: dict[str, Any] = {
                "limit": limit,
                "offset": offset,
                "attributesToRetrieve": [
                    "news_id", "title", "content_text", "publish_date",
                    "url", "source_site", "author", "tags", "last_updated",
                ],
                "attributesToHighlight": ["title", "content_text"],
                "hybrid": {
                    "semanticRatio": semantic_ratio,
                    "embedder": "default",
                },
            }

            if where:
                filter_str = self._build_meilisearch_filter(where)
                if filter_str:
                    search_params["filter"] = filter_str

            results = index.search(query, search_params)

            processed_results = []
            for hit in results.get("hits", []):
                if "_formatted" in hit:
                    hit["title_highlighted"] = hit["_formatted"].get("title", hit.get("title", ""))
                    hit["content_highlighted"] = hit["_formatted"].get("content_text", hit.get("content_text", "")[:200])

                # 从混合搜索结果中提取信息
                # Meilisearch 会在 _matchesPosition 中提供匹配信息
                processed_results.append(hit)

            logger.info(
                f"Meilisearch hybrid search: query='{query}', "
                f"semanticRatio={semantic_ratio}, hits={len(processed_results)}"
            )
            return processed_results
        except Exception as e:
            logger.error(f"Meilisearch hybrid search failed: {e}")
            raise

    def _build_meilisearch_filter(self, where: str) -> str | None:
        """将 LanceDB where 条件转换为 Meilisearch filter"""
        if not where or where == "1=1":
            return None

        try:
            filters = []
            if "!=" in where:
                for condition in where.split(" AND "):
                    if "!=" in condition:
                        field, value = condition.split("!=")
                        field = field.strip()
                        value = value.strip().strip("'\"")
                        filters.append(f"{field} != '{value}'")
                    elif "=" in condition:
                        field, value = condition.split("=")
                        field = field.strip()
                        value = value.strip().strip("'\"")
                        filters.append(f"{field} = '{value}'")
            elif "=" in where:
                for condition in where.split(" AND "):
                    if "=" in condition:
                        field, value = condition.split("=")
                        field = field.strip()
                        value = value.strip().strip("'\"")
                        filters.append(f"{field} = '{value}'")

            return " AND ".join(filters) if filters else None
        except Exception as e:
            logger.warning(f"Failed to build Meilisearch filter from '{where}': {e}")
            return None

    def _lance_fts_search(
        self,
        query: str,
        fields: list[str],
        limit: int,
        offset: int,
        where: str | None = None,
    ) -> list[dict[str, Any]]:
        """使用 LanceDB FTS 进行全文搜索（降级方案）"""
        try:
            results = self.table.search(
                query=query,
                query_type="fts",
            ).limit(limit).offset(offset)

            if where:
                results = results.where(where)

            return cast("list[dict[str, Any]]", results.to_list())
        except Exception as e:
            error_msg = str(e)
            if "Cannot perform full text search unless an INVERTED index has been created" in error_msg:
                logger.warning(f"LanceDB FTS index not available, using simple text search")
                return self._simple_text_search(query, fields, limit, where)
            raise

    def create_meilisearch_index(self) -> None:
        """创建 Meilisearch 索引并配置"""
        try:
            client = self._get_meilisearch_client()
            if client is None:
                logger.warning("Meilisearch not available, skipping index creation")
                return

            try:
                client.create_index("articles", {"primaryKey": "news_id"})
                logger.info("Created Meilisearch index: articles")
            except Exception as e:
                if "index_already_exists" in str(e).lower():
                    logger.info("Meilisearch index 'articles' already exists")
                else:
                    raise

            index = client.index("articles")

            # 配置可搜索属性
            index.update_searchable_attributes([
                "title", "content_text", "source_site", "author",
            ])

            # 配置可过滤属性
            index.update_filterable_attributes([
                "source_site", "author", "tags", "publish_date",
            ])

            # 配置可排序属性
            index.update_sortable_attributes([
                "publish_date", "last_updated",
            ])

            # 配置 Hugging Face embedder（用于向量搜索）
            # 使用 sentence-transformers 模型在本地生成向量
            try:
                index.update_settings({
                    "embedders": {
                        "default": {
                            "source": "huggingFace",
                            "model": "sentence-transformers/all-MiniLM-L6-v2",
                        }
                    }
                })
                logger.info("Meilisearch embedder configured: huggingFace/all-MiniLM-L6-v2")
            except Exception as e:
                logger.warning(f"Failed to configure embedder: {e}")
                logger.info("Hybrid search may not work without embedder configuration")

            logger.info("Meilisearch index configured successfully")
        except Exception as e:
            logger.error(f"Failed to create Meilisearch index: {e}")
            raise

    def sync_to_meilisearch(self, batch_size: int = 100) -> int:
        """将 LanceDB 中的文档同步到 Meilisearch"""
        try:
            client = self._get_meilisearch_client()
            if client is None:
                logger.warning("Meilisearch not available, skipping sync")
                return 0

            self.create_meilisearch_index()
            index = client.index("articles")

            all_docs = self.table.to_pandas().to_dict("records")
            total = len(all_docs)

            if total == 0:
                logger.info("No documents to sync to Meilisearch")
                return 0

            synced = 0
            for i in range(0, total, batch_size):
                batch = all_docs[i:i + batch_size]

                cleaned_batch = []
                for doc in batch:
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
                    cleaned_batch.append(cleaned_doc)

                index.add_documents(cleaned_batch, primary_key="news_id")
                synced += len(cleaned_batch)
                logger.info(f"Synced {synced}/{total} documents to Meilisearch")

            logger.info(f"Meilisearch sync completed: {synced} documents")
            return synced
        except Exception as e:
            logger.error(f"Failed to sync to Meilisearch: {e}")
            raise

    def hybrid_search(
        self,
        query: str,
        query_obj: ArticleQuery | None = None,
        **kwargs: Any,
    ) -> list[dict[str, Any]]:
        """
        混合搜索 (向量 + 全文) - 使用 Meilisearch 原生实现

        Args:
            query: 查询文本
            query_obj: 查询对象
            **kwargs: 其他参数

        Returns:
            搜索结果列表
        """
        if query_obj is None:
            query_obj = ArticleQuery(keyword=query, **kwargs)

        # 验证查询
        is_valid, errors = query_obj.validate_data()
        if not is_valid:
            raise ValueError(f"Invalid query: {errors}")

        # 尝试使用 Meilisearch 原生 Hybrid Search
        client = self._get_meilisearch_client()
        if client is not None and query_obj.keyword:
            try:
                # 计算 semantic ratio
                # vector_weight 表示向量搜索的权重，keyword_weight 表示关键词搜索的权重
                semantic_ratio = query_obj.vector_weight  # 使用 vector_weight 作为 semantic ratio

                return self.meilisearch_hybrid_search(
                    query=query_obj.keyword,
                    semantic_ratio=semantic_ratio,
                    limit=query_obj.limit,
                    offset=query_obj.offset,
                    where=query_obj.build_where_clause(),
                )
            except Exception as e:
                logger.warning(f"Meilisearch hybrid search failed, falling back: {e}")

        # 当没有关键词但有过滤条件时，使用纯过滤查询
        where_clause = query_obj.build_where_clause()
        if not query_obj.keyword and where_clause and where_clause != "1=1":
            try:
                filtered_results = (
                    self.table.search()
                    .where(where_clause)
                    .limit(query_obj.limit)
                    .offset(query_obj.offset)
                    .to_list()
                )
                return filtered_results
            except Exception as e:
                logger.warning(f"Filtered search failed: {e}")

        # 空搜索 + 无过滤：返回最近的文章
        if not query_obj.keyword:
            try:
                return (
                    self.table.search()
                    .order_by("last_updated", descending=True)
                    .limit(query_obj.limit)
                    .offset(query_obj.offset)
                    .to_list()
                )
            except Exception as e:
                logger.warning(f"Empty search order_by failed: {e}")
                return self.table.search().limit(query_obj.limit).offset(query_obj.offset).to_list()

        # 降级到纯全文搜索
        return self.fulltext_search(
            query=query_obj.keyword,
            fields=query_obj.search_fields,
            limit=query_obj.limit,
            offset=query_obj.offset,
            where=where_clause,
        )

    def _merge_vector_results(
        self,
        title_results: list[dict[str, Any]],
        content_results: list[dict[str, Any]],
        title_weight: float = 0.3,
        content_weight: float = 0.7,
    ) -> list[dict[str, Any]]:
        """
        合并标题和正文向量搜索结果

        Args:
            title_results: 标题向量搜索结果
            content_results: 正文向量搜索结果
            title_weight: 标题权重
            content_weight: 正文权重

        Returns:
            合并后的结果
        """
        # 创建文档ID到分数的映射
        scores: dict[str, float] = {}
        all_docs: dict[str, dict[str, Any]] = {}

        # 处理标题结果
        for i, doc in enumerate(title_results):
            doc_id = doc.get(ArticleFields.NEWS_ID)
            if doc_id:
                rank_score = 1.0 / (i + 1)
                scores[doc_id] = scores.get(doc_id, 0) + rank_score * title_weight
                all_docs[doc_id] = doc

        # 处理正文结果
        for i, doc in enumerate(content_results):
            doc_id = doc.get(ArticleFields.NEWS_ID)
            if doc_id:
                rank_score = 1.0 / (i + 1)
                scores[doc_id] = scores.get(doc_id, 0) + rank_score * content_weight
                if doc_id not in all_docs:
                    all_docs[doc_id] = doc

        # 按分数排序
        sorted_docs = sorted(
            scores.items(),
            key=lambda x: x[1],
            reverse=True,
        )

        # 返回排序后的文档
        result: list[dict[str, Any]] = []
        for doc_id, score in sorted_docs:
            matched_doc = all_docs.get(doc_id)
            if matched_doc is not None:
                matched_doc["_score"] = score
                matched_doc["_title_score"] = scores.get(doc_id, 0) * title_weight
                matched_doc["_content_score"] = scores.get(doc_id, 0) * content_weight
                result.append(matched_doc)

        return result

    def _fuse_results(
        self,
        vector_results: list[dict[str, Any]],
        text_results: list[dict[str, Any]],
        text_weight: float,
        vector_weight: float,
        limit: int,
    ) -> list[dict[str, Any]]:
        """
        融合向量和全文搜索结果

        Args:
            vector_results: 向量搜索结果
            text_results: 全文搜索结果
            text_weight: 文本权重
            vector_weight: 向量权重
            limit: 返回数量

        Returns:
            融合后的结果
        """
        # 创建文档ID到分数的映射
        scores: dict[str, float] = {}

        # 处理向量结果
        # 使用倒数排名分数，距离越近（排名越高）分数越高
        for i, doc in enumerate(vector_results):
            doc_id = doc.get(ArticleFields.NEWS_ID)
            if doc_id:
                # 基于排名计算分数 (排名越靠前分数越高)
                # 第1名得1.0，第2名得0.5，第3名得0.33...
                rank_score = 1.0 / (i + 1)
                # 同时考虑位置衰减：前10个结果占主导
                position_boost = max(0.5, 1.0 - (i / 20))
                scores[doc_id] = scores.get(doc_id, 0) + rank_score * vector_weight * position_boost

        # 处理文本结果
        for i, doc in enumerate(text_results):
            doc_id = doc.get(ArticleFields.NEWS_ID)
            if doc_id:
                rank_score = 1.0 / (i + 1)
                # 文本分数权重衰减：全文搜索作为辅助
                text_weight_adjusted = text_weight * max(0.3, 1.0 - (i / 15))
                scores[doc_id] = scores.get(doc_id, 0) + rank_score * text_weight_adjusted

        # 合并结果
        all_docs: dict[str, dict[str, Any]] = {}
        for doc in vector_results + text_results:
            doc_id = doc.get(ArticleFields.NEWS_ID)
            if isinstance(doc_id, str):
                all_docs[doc_id] = doc

        # 按分数排序
        sorted_docs = sorted(
            scores.items(),
            key=lambda x: x[1],
            reverse=True,
        )[:limit]

        # 返回排序后的文档
        result: list[dict[str, Any]] = []
        for doc_id, score in sorted_docs:
            matched_doc = all_docs.get(doc_id)
            if matched_doc is not None:
                matched_doc["_score"] = score
                result.append(matched_doc)

        return result

    # =========================================================================
    # 批量操作
    # =========================================================================

    def add_documents(
        self,
        documents: list[dict[str, Any]],
        generate_embeddings: bool = True,
        batch_size: int = 100,
    ) -> int:
        """
        批量添加文档

        Args:
            documents: 文档列表
            generate_embeddings: 是否生成向量
            batch_size: 批处理大小

        Returns:
            添加的文档数
        """
        if not documents:
            return 0

        # 转换为 Article 对象
        articles = []
        for doc in documents:
            try:
                article = Article.from_dict(doc)
                is_valid, errors = article.validate_data()
                if not is_valid:
                    logger.warning(f"Invalid article skipped: {errors}")
                    continue

                articles.append(article)
            except Exception as e:
                logger.warning(f"Failed to convert document: {e}")
                continue

        # 批量插入（使用 merge_insert 去重）
        try:
            self.table.merge_insert("news_id").when_matched_update_all().execute(articles)
            logger.info(f"Added/Updated {len(articles)} documents")
            return len(articles)
        except Exception as e:
            logger.error(f"Failed to add documents: {e}")
            raise

    def update_documents(
        self,
        updates: list[dict[str, Any]],
        merge_key: str = ArticleFields.NEWS_ID,
    ) -> int:
        """
        批量更新文档

        Args:
            updates: 更新数据列表
            merge_key: 合并键

        Returns:
            更新的文档数
        """
        if not updates:
            return 0

        try:
            self.table.merge_insert(merge_key).when_matched_update_all().execute(updates)
            logger.info(f"Updated {len(updates)} documents")
            return len(updates)
        except Exception as e:
            logger.error(f"Failed to update documents: {e}")
            raise


# =============================================================================
# 便捷函数
# =============================================================================


def create_store(
    db_path: str = "../data/lancedb",
    table_name: str = "articles",
    create_indices: bool = True,
) -> LanceStore:
    """
    创建 LanceStore 实例

    Args:
        db_path: 数据库路径
        table_name: 表名
        create_indices: 是否创建索引

    Returns:
        LanceStore 实例
    """
    store = LanceStore(db_path=db_path, table_name=table_name)

    if create_indices:
        try:
            # 先检查表是否有数据，只有有数据时才创建向量索引
            count = store.count()
            if count > 0:
                # 尝试创建向量索引（可能需要训练数据）
                try:
                    store.create_vector_index("content_embedding")
                    logger.info("Created content vector index")
                except Exception as e:
                    logger.warning(f"Failed to create content vector index: {e}")
                    # 尝试使用训练模式
                    if "train=False" in str(e):
                        logger.info("Table may be empty, will retry after adding data")
                try:
                    store.create_vector_index("title_embedding")
                    logger.info("Created title vector index")
                except Exception as e:
                    logger.warning(f"Failed to create title vector index: {e}")

            # 总是尝试创建全文索引（即使表为空也可以创建）
            try:
                store.create_fulltext_index()
                logger.info("Created fulltext index")
            except Exception as e:
                logger.warning(f"Failed to create fulltext index: {e}")
                # 如果是表为空的问题，记录信息稍后重试
                if "empty" in str(e).lower():
                    logger.info("Table may be empty, will retry after adding data")

            logger.info("Indices creation attempted")
        except Exception as e:
            logger.warning(f"Failed to create indices: {e}")

    return store


def get_store(
    db_path: str = "../data/lancedb",
    table_name: str = "articles",
) -> LanceStore:
    """
    获取 LanceStore 单例

    Args:
        db_path: 数据库路径
        table_name: 表名

    Returns:
        LanceStore 实例
    """
    return create_store(db_path, table_name, create_indices=False)
