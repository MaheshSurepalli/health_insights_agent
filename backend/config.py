import os

AZURE_STORAGE_ACCOUNT = os.getenv("AZURE_STORAGE_ACCOUNT", "")
AZURE_STORAGE_CONTAINER = os.getenv("AZURE_STORAGE_CONTAINER", "reports")
AZURE_STORAGE_KEY = os.getenv("AZURE_STORAGE_KEY")

# Accept only PDFs and images for now
ACCEPTED_MIME = {
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/tiff",
}

ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    # Add production frontend URL here
]

AZURE_ENDPOINT = "https://health-insights-agent-resource.services.ai.azure.com/api/projects/health-insights-agent"
AGENT_ID = "asst_7AweWe7m4r7h1mPQebEPRTPi"

DOCINT_ENDPOINT = os.getenv("DOCINT_ENDPOINT", "")
DOCINT_KEY = os.getenv("DOCINT_KEY", "") 