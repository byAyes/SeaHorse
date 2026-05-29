"""
pdfmux Server — HTTP REST API wrapper for pdfmux PDF extraction.

Provides a lightweight HTTP API that Next.js can call to extract text
from PDFs using pdfmux's orchestrated extraction pipeline (auto-audit,
OCR fallback, confidence scoring).

Usage:
    # Install deps
    pip install "pdfmux[all]" fastapi uvicorn python-multipart

    # Start server
    python scripts/pdfmux_server.py

    # Or via uvicorn directly
    uvicorn scripts.pdfmux_server:app --host 0.0.0.0 --port 3100
"""

import os
import sys
import json
import uuid
import tempfile
import logging
from pathlib import Path
from contextlib import asynccontextmanager

try:
    from fastapi import FastAPI, UploadFile, File, HTTPException
    from fastapi.responses import JSONResponse
except ImportError:
    print("ERROR: fastapi not installed. Run: pip install fastapi uvicorn python-multipart")
    sys.exit(1)

try:
    import pdfmux
except ImportError:
    print("ERROR: pdfmux not installed. Run: pip install 'pdfmux[all]'")
    sys.exit(1)

# ─── Logging ─────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("pdfmux-server")

# ─── App State ───────────────────────────────────────────────────────────────
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("pdfmux server starting — ready for PDF extraction")
    yield
    logger.info("pdfmux server shutting down")


app = FastAPI(
    title="pdfmux Server",
    version="1.0.0",
    description="HTTP API for pdfmux PDF text extraction",
    lifespan=lifespan,
)


# ─── Health ──────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    """Health check endpoint."""
    return {
        "status": "ok",
        "service": "pdfmux",
        "version": getattr(pdfmux, "__version__", "unknown"),
    }


# ─── Extract Text ────────────────────────────────────────────────────────────

@app.post("/extract")
async def extract_pdf(
    file: UploadFile = File(...),
    quality: str = "standard",
):
    """
    Extract text from a PDF file using pdfmux.

    Args:
        file: The PDF file to extract text from.
        quality: Extraction quality — "fast", "standard", or "premium".

    Returns:
        JSON with extracted text, page count, and confidence score.
    """
    # Validate file type
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    # Read file content
    contents = await file.read()
    if len(contents) == 0:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size is {MAX_FILE_SIZE // (1024*1024)} MB",
        )

    # Validate quality parameter
    if quality not in ("fast", "standard", "premium"):
        quality = "standard"

    # Save to temporary file (pdfmux requires a file path)
    tmp_path = None
    try:
        tmp_dir = tempfile.mkdtemp(prefix="pdfmux_")
        tmp_path = os.path.join(tmp_dir, f"{uuid.uuid4().hex}.pdf")
        with open(tmp_path, "wb") as f:
            f.write(contents)

        logger.info(
            "Extracting PDF: file=%s size=%dKB quality=%s",
            file.filename,
            len(contents) // 1024,
            quality,
        )

        # Extract text using pdfmux
        text = pdfmux.extract_text(tmp_path, quality=quality)

        # Get page-level chunks with confidence scores
        chunks = pdfmux.chunk(tmp_path, max_tokens=999999)
        page_count = len(chunks)

        # Calculate average confidence across all chunks
        avg_confidence = 0.0
        if chunks:
            confidences = [
                getattr(chunk, "confidence", None) or getattr(chunk, "score", 0)
                for chunk in chunks
            ]
            # Filter out zeros (unscored pages)
            scored = [c for c in confidences if c is not None and c > 0]
            if scored:
                avg_confidence = sum(scored) / len(scored)

        logger.info(
            "Extraction complete: pages=%d confidence=%.2f text_length=%d",
            page_count,
            avg_confidence,
            len(text),
        )

        return {
            "success": True,
            "text": text,
            "pageCount": page_count,
            "confidence": round(avg_confidence, 4),
        }

    except Exception as exc:
        logger.error("Extraction failed: %s", exc)
        return JSONResponse(
            status_code=200,  # Return 200 with success=false for graceful fallback
            content={
                "success": False,
                "text": "",
                "pageCount": 0,
                "confidence": 0.0,
                "error": str(exc),
            },
        )

    finally:
        # Clean up temp file
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
                os.rmdir(os.path.dirname(tmp_path))
            except OSError:
                pass


# ─── Extract Structured JSON ─────────────────────────────────────────────────

@app.post("/extract/json")
async def extract_pdf_json(
    file: UploadFile = File(...),
):
    """
    Extract structured JSON (tables, key-value pairs) from a PDF.

    Args:
        file: The PDF file to extract from.

    Returns:
        JSON with structured data extracted from the PDF.
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    contents = await file.read()
    if len(contents) == 0:
        raise HTTPException(status_code=400, detail="Empty file")

    tmp_path = None
    try:
        tmp_dir = tempfile.mkdtemp(prefix="pdfmux_")
        tmp_path = os.path.join(tmp_dir, f"{uuid.uuid4().hex}.pdf")
        with open(tmp_path, "wb") as f:
            f.write(contents)

        data = pdfmux.extract_json(tmp_path)
        return {"success": True, "data": data}

    except Exception as exc:
        return JSONResponse(
            status_code=200,
            content={"success": False, "data": None, "error": str(exc)},
        )
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
                os.rmdir(os.path.dirname(tmp_path))
            except OSError:
                pass


# ─── Main ────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    host = os.environ.get("PDFMUX_HOST", "0.0.0.0")
    port = int(os.environ.get("PDFMUX_PORT", "3100"))

    logger.info("Starting pdfmux server on %s:%s", host, port)
    uvicorn.run(app, host=host, port=port, log_level="info")
