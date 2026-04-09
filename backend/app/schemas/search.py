from pydantic import BaseModel, Field
from typing import List, Optional


class SearchRequest(BaseModel):
    query: str = Field(default="", max_length=500)
    limit: int = Field(default=10, ge=1, le=100)
    source: Optional[str] = None
    tags: Optional[List[str]] = None
    start_date: Optional[str] = Field(None, description="开始日期 YYYY-MM-DD")
    end_date: Optional[str] = Field(None, description="结束日期 YYYY-MM-DD")


class SearchResult(BaseModel):
    id: str
    title: str
    url: str
    summary: Optional[str] = None
    score: float
    source: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    published_date: Optional[str] = None


class SearchResponse(BaseModel):
    query: str
    results: List[SearchResult]
    total: int
