# di_client.py
from typing import Any, Dict
from urllib.parse import urlparse

from azure.core.credentials import AzureKeyCredential
from azure.identity import DefaultAzureCredential
from azure.ai.documentintelligence import DocumentIntelligenceClient
from azure.ai.documentintelligence.models import AnalyzeDocumentRequest

from config import DOCINT_ENDPOINT, DOCINT_KEY

def _build_client() -> DocumentIntelligenceClient:
    if not DOCINT_ENDPOINT:
        raise RuntimeError("DOCINT_ENDPOINT is not configured")

    if DOCINT_KEY:
        return DocumentIntelligenceClient(DOCINT_ENDPOINT, AzureKeyCredential(DOCINT_KEY))
    # MSI / dev login
    return DocumentIntelligenceClient(DOCINT_ENDPOINT, DefaultAzureCredential(exclude_interactive_browser_credential=False))

def _validate_blob_url(blob_url: str):
    return urlparse(blob_url).netloc

def analyze_blob_url(blob_url: str) -> Dict[str, Any]:
    """
    Calls DI prebuilt-document on a blob URL (SAS preferred), returns a compact dict.
    """

    blob_url = str(blob_url)
    _validate_blob_url(blob_url)
    client = _build_client()

    poller = client.begin_analyze_document(
       "prebuilt-read",
        AnalyzeDocumentRequest(url_source=blob_url)
    )
    result = poller.result()

    # Compact summary of useful parts (we’ll normalize later)
    pages = []
    for p in (result.pages or []):
        pages.append({
            "pageNumber": p.page_number,
            "width": p.width,
            "height": p.height,
            "unit": p.unit,
            "lines": [{"text": ln.content} for ln in (p.lines or [])],
        })

    tables = []
    for t in (result.tables or []):
        cells = [{
            "rowIndex": c.row_index,
            "columnIndex": c.column_index,
            "content": c.content,
        } for c in (t.cells or [])]
        tables.append({
            "rowCount": t.row_count,
            "columnCount": t.column_count,
            "cells": cells,
        })

    kvps = []
    for kv in (result.key_value_pairs or []):
        kvps.append({
            "key": kv.key.content if kv.key else None,
            "value": kv.value.content if kv.value else None,
            "confidence": kv.confidence,
        })

    return {
        "content": result.content,        # full text
        "pages": pages,                   # lines per page
        "tables": tables,                 # raw tables
        "keyValuePairs": kvps,            # loose KVPs
    }
