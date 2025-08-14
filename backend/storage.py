from datetime import datetime, timedelta, timezone
from azure.storage.blob import generate_blob_sas, BlobSasPermissions
from urllib.parse import urlparse

from config import AZURE_STORAGE_ACCOUNT, AZURE_STORAGE_CONTAINER, AZURE_STORAGE_KEY


def create_blob_sas(filename: str, content_type: str):
    # NOTE: For dev, use account key via AZURE_STORAGE_KEY.
    # In prod, prefer user-delegation SAS with MSI/RBAC.
    
    if not (AZURE_STORAGE_ACCOUNT and AZURE_STORAGE_KEY):
        raise RuntimeError("Missing AZURE_STORAGE_ACCOUNT or AZURE_STORAGE_KEY")

    blob_name = f"uploads/{datetime.utcnow():%Y%m%d/%H%M%S}_{filename}"
    account_url = f"https://{AZURE_STORAGE_ACCOUNT}.blob.core.windows.net"
    sas = generate_blob_sas(
        account_name=AZURE_STORAGE_ACCOUNT,
        container_name=AZURE_STORAGE_CONTAINER,
        blob_name=blob_name,
        account_key=AZURE_STORAGE_KEY,
        permission=BlobSasPermissions(create=True, write=True, add=True, read=True),
        expiry=datetime.utcnow() + timedelta(minutes=20),
        content_type=content_type,
    )
    blob_url = f"{account_url}/{AZURE_STORAGE_CONTAINER}/{blob_name}"
    return f"{blob_url}?{sas}", blob_url


def _split_container_blob(url: str):
    """
    Accepts a full blob URL (with or without query) and returns (container, blob_path).
    """
    u = urlparse(url)
    path = u.path.lstrip("/")            # "<container>/<blobpath>"
    parts = path.split("/", 1)
    if len(parts) != 2:
        raise ValueError("Invalid blob URL path")
    return parts[0], parts[1]



def build_read_sas_url(blob_url: str, minutes: int = 10) -> str:
    """
    Always mint a fresh, short-lived READ (r) SAS for the given blob URL.
    No prior SAS inspection needed.
    """
    if not (AZURE_STORAGE_ACCOUNT and AZURE_STORAGE_KEY):
        raise RuntimeError("Missing AZURE_STORAGE_ACCOUNT or AZURE_STORAGE_KEY")

    container, blob_name = _split_container_blob(blob_url)

    # small negative skew to avoid clock issues
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
    base = f"https://{AZURE_STORAGE_ACCOUNT}.blob.core.windows.net/{container}/{blob_name}"
    return f"{base}?{sas}"
