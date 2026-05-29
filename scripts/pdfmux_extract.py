"""
pdfmux Extract — Standalone PDF text extraction script.

USAGE:
    python scripts/pdfmux_extract.py <path_to_pdf> [--quality fast|standard|premium]

OUTPUT (JSON to stdout):
    {"success": true, "text": "...", "pageCount": 5, "confidence": 0.95}
    {"success": false, "error": "..."}

This script is designed to be spawned as a subprocess by pdfmuxParser.ts.
No server or Docker needed — just `pip install pdfmux`.
"""

import sys
import os
import json
import argparse

# Allow running without pdfmux installed (graceful fallback)
try:
    import pdfmux
except ImportError:
    # Output failure JSON so the TypeScript client can fall back gracefully
    print(json.dumps({
        "success": False,
        "error": "pdfmux not installed. Run: pip install 'pdfmux[all]'",
    }))
    sys.exit(0)


def extract_pdf(filepath: str, quality: str = "standard") -> dict:
    """Extract text from a PDF using pdfmux."""
    if not os.path.exists(filepath):
        return {"success": False, "error": f"File not found: {filepath}"}

    if os.path.getsize(filepath) == 0:
        return {"success": False, "error": "Empty file"}

    # Validate quality
    if quality not in ("fast", "standard", "premium"):
        quality = "standard"

    try:
        # Extract text
        text = pdfmux.extract_text(filepath, quality=quality)

        # Get page-level chunks with confidence scores
        chunks = pdfmux.chunk(filepath, max_tokens=999999)
        page_count = len(chunks)

        # Calculate average confidence
        avg_confidence = 0.0
        if chunks:
            confidences = [
                getattr(chunk, "confidence", None) or getattr(chunk, "score", 0)
                for chunk in chunks
            ]
            scored = [c for c in confidences if c is not None and c > 0]
            if scored:
                avg_confidence = sum(scored) / len(scored)

        return {
            "success": True,
            "text": text,
            "pageCount": page_count,
            "confidence": round(avg_confidence, 4),
        }

    except Exception as exc:
        return {"success": False, "error": str(exc)}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Extract text from PDF using pdfmux")
    parser.add_argument("filepath", help="Path to the PDF file")
    parser.add_argument(
        "--quality",
        default="standard",
        choices=["fast", "standard", "premium"],
        help="Extraction quality (default: standard)",
    )
    args = parser.parse_args()

    result = extract_pdf(args.filepath, args.quality)
    print(json.dumps(result))
    # Exit 0 always — the TypeScript client checks success flag, not exit code
    sys.exit(0)
