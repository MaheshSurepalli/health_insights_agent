# models.py
from pydantic import BaseModel, HttpUrl
from typing import Optional, Any, Dict

class StartUploadRequest(BaseModel):
    filename: str
    content_type: str

class StartUploadResponse(BaseModel):
    sasUrl: HttpUrl
    blobUrl: HttpUrl

class AnalyzeRequest(BaseModel):
    blobUrl: HttpUrl
    fileName: Optional[str] = None
    mimeType: Optional[str] = None

class AnalyzeResponse(BaseModel):
    reportId: str
    blobUrl: HttpUrl
    extracted: Dict[str, Any]
    analysis: Dict[str, Any]
