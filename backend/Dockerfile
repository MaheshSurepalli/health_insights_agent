# syntax=docker/dockerfile:1
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    TZ=Asia/Kolkata

RUN apt-get update && apt-get install -y --no-install-recommends tzdata \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps first for better caching
COPY requirements.txt .
RUN pip install -r requirements.txt

# Copy only backend source (build context will be ./backend)
COPY . .

EXPOSE 8080
# If your entrypoint isn't main.py with `app = FastAPI()`, tell me the correct module
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
