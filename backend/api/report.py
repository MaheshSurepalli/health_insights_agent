# report_api.py
from fastapi import APIRouter, Depends, HTTPException
from uuid import uuid4
from auth import verify_token
from schemas.reports import (StartUploadRequest, StartUploadResponse, AnalyzeRequest, AnalyzeResponse)
from config import ACCEPTED_MIME
from services.storage import create_blob_sas, build_read_sas_url
from services.document_intelligence import analyze_blob_url
from services.analysis import analyze_with_agent


router = APIRouter(prefix="/reports", tags=["reports"])

@router.post("/upload-url", response_model=StartUploadResponse)
def get_upload_sas(req: StartUploadRequest, user=Depends(verify_token)):
    if req.content_type not in ACCEPTED_MIME:
        raise HTTPException(status_code=400, detail="Unsupported file type")
    sas_url, blob_url = create_blob_sas(req.filename, req.content_type)
    return StartUploadResponse(sasUrl=sas_url, blobUrl=blob_url)

@router.post("/analyze", response_model=AnalyzeResponse)
def analyze_report(req: AnalyzeRequest, user=Depends(verify_token)):
    request_id = str(uuid4())
    try:
        if req.mimeType and req.mimeType not in ACCEPTED_MIME:
            raise HTTPException(status_code=400, detail="Unsupported file type")

        source_url = str(req.blobUrl)

        read_url = build_read_sas_url(source_url, minutes=10)  
        extracted = analyze_blob_url(read_url)               

        user_id = user["sub"]
        analysis = analyze_with_agent(user_id, extracted)

        return AnalyzeResponse(
            reportId=request_id,
            blobUrl=source_url,
            extracted=extracted,
            analysis=analysis,   
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {e}")
