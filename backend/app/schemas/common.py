from pydantic import BaseModel
from typing import Optional, List


class TagResponse(BaseModel):
    id: str
    name: str
    count: int


class CategoryResponse(BaseModel):
    id: str
    name: str
    count: int


class HealthResponse(BaseModel):
    status: str
    version: str
    database: str
