# services/storage.py
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path
import re
from typing import Tuple

from azure.storage.blob import generate_blob_sas, BlobSasPermissions

from config import (
    AZURE_STORAGE_ACCOUNT,
    AZURE_STORAGE_CONTAINER,
    AZURE_STORAGE_KEY,
)

# ---------- small internals (pure helpers) ----------

def _require_storage_config() -> None:
    if not (AZURE_STORAGE_ACCOUNT and AZURE_STORAGE_KEY):
        raise RuntimeError("Missing AZURE_STORAGE_ACCOUNT or AZURE_STORAGE_KEY")

def _account_url() -> str:
    return f"https://{AZURE_STORAGE_ACCOUNT}.blob.core.windows.net"

def _sanitize_filename(filename: str) -> str:
    """
    Strip any path components and normalize the name so it is safe for blob paths.
    """
    name = Path(str(filename)).name  # drop any directories
    name = re.sub(r"[^\w.\-]+", "_", name).strip("._") or "file"
    return name

def _timestamp_prefix() -> str:
    # UTC, deterministic, folder-style prefix
    return datetime.now(timezone.utc).strftime("uploads/%Y%m%d/%H%M%S")

# ---------- public API (same signatures/return semantics) ----------

def create_blob_sas(filename: str, content_type: str) -> Tuple[str, str]:
    """
    Mint a short-lived SAS for client-side PUT upload.
    Returns (sasUrl, blobUrl).
    """
    _require_storage_config()

    safe_name = _sanitize_filename(filename)
    blob_name = f"{_timestamp_prefix()}_{safe_name}"
    account_url = _account_url()

    sas = generate_blob_sas(
        account_name=AZURE_STORAGE_ACCOUNT,
        container_name=AZURE_STORAGE_CONTAINER,
        blob_name=blob_name,
        account_key=AZURE_STORAGE_KEY,
        # keep permissions as before (create/write/add/read)
        permission=BlobSasPermissions(create=True, write=True, add=True, read=True),
        # keep 20 min expiry window as before
        expiry=datetime.now(timezone.utc) + timedelta(minutes=20),
        # preserve caller-supplied content type
        content_type=content_type,
    )

    blob_url = f"{account_url}/{AZURE_STORAGE_CONTAINER}/{blob_name}"
    return f"{blob_url}?{sas}", blob_url


def build_read_sas_url(blob_url: str, minutes: int = 10) -> str:
    """
    Always mint a fresh READ (r) SAS for the given blob URL.
    """
    from urllib.parse import urlparse

    _require_storage_config()

    u = urlparse(str(blob_url))
    path = u.path.lstrip("/")  # "<container>/<blobpath>"
    parts = path.split("/", 1)
    if len(parts) != 2:
        raise ValueError("Invalid blob URL path")

    container, blob_name = parts[0], parts[1]

    # small negative skew to tolerate minor clock drift
    start = datetime.now(timezone.utc) - timedelta(minutes=1)
    expiry = datetime.now(timezone.utc) + timedelta(minutes=minutes)

    sas = generate_blob_sas(
        account_name=AZURE_STORAGE_ACCOUNT,
        container_name=container,
        blob_name=blob_name,
        account_key=AZURE_STORAGE_KEY,
        permission=BlobSasPermissions(read=True),
        start=start,
        expiry=expiry,
    )
    base = f"{_account_url()}/{container}/{blob_name}"
    return f"{base}?{sas}"
