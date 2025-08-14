# schemas/reports.py
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field, HttpUrl

class StartUploadRequest(BaseModel):
    filename: str
    content_type: str = Field

class StartUploadResponse(BaseModel):
    sas_url: str = Field(alias="sasUrl")
    blob_url: str = Field(alias="blobUrl")

class AnalyzeRequest(BaseModel):
    blobUrl: HttpUrl
    fileName: Optional[str] = None
    mimeType: Optional[str] = None

class AnalyzeResponse(BaseModel):
    report_id: str = Field(alias="reportId")
    blob_url: str = Field(alias="blobUrl")
    extracted: Dict[str, Any]
    analysis: Dict[str, Any]
