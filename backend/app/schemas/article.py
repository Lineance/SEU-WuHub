from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class ArticleBase(BaseModel):
    title: str
    url: str
    content: Optional[str] = None
    summary: Optional[str] = None
    author: Optional[str] = None
    published_date: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    category: Optional[str] = None
    attachments: List[str] = Field(default_factory=list)  # PDF等附件URL列表


class ArticleCreate(ArticleBase):
    pass


class ArticleUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    summary: Optional[str] = None
    tags: Optional[List[str]] = None
    category: Optional[str] = None


class ArticleResponse(ArticleBase):
    id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ArticleListResponse(BaseModel):
    items: List[ArticleResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
