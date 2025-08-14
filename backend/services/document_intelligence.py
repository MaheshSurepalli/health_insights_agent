# services/document_intelligence.py
from __future__ import annotations

from typing import Any, Dict, List
from urllib.parse import urlparse

from azure.core.credentials import AzureKeyCredential
from azure.identity import DefaultAzureCredential
from azure.ai.documentintelligence import DocumentIntelligenceClient
from azure.ai.documentintelligence.models import AnalyzeDocumentRequest

from config import DOCINT_ENDPOINT, DOCINT_KEY


def _build_client() -> DocumentIntelligenceClient:
    """
    Build a Document Intelligence client using either a static key or MSI/dev credential.
    """
    if not DOCINT_ENDPOINT:
        raise RuntimeError("DOCINT_ENDPOINT is not configured")

    if DOCINT_KEY:
        return DocumentIntelligenceClient(DOCINT_ENDPOINT, AzureKeyCredential(DOCINT_KEY))

    # MSI / dev interactive fallback
    return DocumentIntelligenceClient(
        DOCINT_ENDPOINT,
        DefaultAzureCredential(exclude_interactive_browser_credential=False),
    )


def _validate_blob_url(blob_url: str) -> None:
    """
    Basic sanity check that the URL is well-formed and has a host.
    """
    u = urlparse(str(blob_url))
    if not (u.scheme and u.netloc):
        raise ValueError("Invalid blob URL")


def analyze_blob_url(blob_url: str) -> Dict[str, Any]:
    """
    Calls DI prebuilt-read on a blob URL (SAS preferred) and returns a compact dict.

    Return shape (unchanged):
    {
        "content": str,
        "pages": [{ pageNumber, width, height, unit, lines: [{text}, ...] }, ...],
        "tables": [{ rowCount, columnCount, cells: [{rowIndex, columnIndex, content}, ...] }, ...],
        "keyValuePairs": [{ key, value, confidence }, ...]
    }
    """
    _validate_blob_url(blob_url)
    client = _build_client()

    poller = client.begin_analyze_document(
        "prebuilt-read",
        AnalyzeDocumentRequest(url_source=str(blob_url)),
    )
    result = poller.result()

    # Pages
    pages: List[Dict[str, Any]] = []
    for p in (result.pages or []):
        pages.append(
            {
                "pageNumber": p.page_number,
                "width": p.width,
                "height": p.height,
                "unit": p.unit,
                "lines": [{"text": ln.content} for ln in (p.lines or [])],
            }
        )

    # Tables
    tables: List[Dict[str, Any]] = []
    for t in (result.tables or []):
        cells = [
            {
                "rowIndex": c.row_index,
                "columnIndex": c.column_index,
                "content": c.content,
            }
            for c in (t.cells or [])
        ]
        tables.append(
            {
                "rowCount": t.row_count,
                "columnCount": t.column_count,
                "cells": cells,
            }
        )

    # Key-Value Pairs
    kvps: List[Dict[str, Any]] = []
    for kv in (result.key_value_pairs or []):
        kvps.append(
            {
                "key": kv.key.content if kv.key else None,
                "value": kv.value.content if kv.value else None,
                "confidence": kv.confidence,
            }
        )

    return {
        "content": result.content,
        "pages": pages,
        "tables": tables,
        "keyValuePairs": kvps,
    }
