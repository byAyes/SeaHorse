# pdfmux Server — Docker Image
# Runs a FastAPI HTTP server wrapping pdfmux for PDF text extraction.
# Uses Python 3.11 for compatibility with pdfmux dependencies.

FROM python:3.11-slim

LABEL description="pdfmux PDF extraction HTTP server"
LABEL maintainer="seahorse"

# Prevent Python from writing .pyc files and buffering stdout
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install system dependencies required by pdfmux backends
RUN apt-get update && apt-get install -y --no-install-recommends \
    # For PyMuPDF
    libgl1-mesa-glx \
    libglib2.0-0 \
    # For OCR (tesseract)
    tesseract-ocr \
    tesseract-ocr-eng \
    tesseract-ocr-spa \
    tesseract-ocr-fra \
    tesseract-ocr-deu \
    tesseract-ocr-por \
    # For building dependencies
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python deps
COPY scripts/pdfmux_server.py /app/server.py

# Install pdfmux with all extras + FastAPI server
RUN pip install --no-cache-dir \
    "pdfmux[all]" \
    fastapi \
    uvicorn \
    python-multipart

# Create working directory for temp files
WORKDIR /data

# Expose the API port
EXPOSE 3100

# Start the server
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "3100", "--log-level", "info"]
