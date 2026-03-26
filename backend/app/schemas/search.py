from pydantic import BaseModel, Field
from typing import List, Optional


class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=500)
    limit: int = Field(default=10, ge=1, le=100)
    category: Optional[str] = None
    tags: Optional[List[str]] = None


class SearchResult(BaseModel):
    id: str
    title: str
    url: str
    summary: Optional[str] = None
    score: float
    category: Optional[str] = None
    tags: List[str] = Field(default_factory=list)


class SearchResponse(BaseModel):
    query: str
    results: List[SearchResult]
    total: int
