"""
pypdf Extract — Standalone PDF text extraction script.

USAGE:
    python scripts/pypdf_extract.py <path_to_pdf>

OUTPUT (JSON to stdout):
    {"success": true, "text": "...", "pageCount": 5}
    {"success": false, "error": "..."}

This script is designed to be spawned as a subprocess by pypdfParser.ts.
No server or Docker needed — just `pip install pypdf`.
pypdf is a pure-Python library, extremely easy to install and lightweight.
"""

import sys
import os
import json
import argparse

try:
    from pypdf import PdfReader
except ImportError:
    print(json.dumps({
        "success": False,
        "error": "pypdf not installed. Run: pip install pypdf",
    }))
    sys.exit(0)


def extract_pdf(filepath: str) -> dict:
    """Extract text from a PDF using pypdf."""
    if not os.path.exists(filepath):
        return {"success": False, "error": f"File not found: {filepath}"}

    if os.path.getsize(filepath) == 0:
        return {"success": False, "error": "Empty file"}

    try:
        reader = PdfReader(filepath)
        page_count = len(reader.pages)
        text_parts = []

        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text)

        full_text = "\n".join(text_parts)

        return {
            "success": True,
            "text": full_text,
            "pageCount": page_count,
        }

    except Exception as exc:
        return {"success": False, "error": str(exc)}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Extract text from PDF using pypdf")
    parser.add_argument("filepath", help="Path to the PDF file")
    args = parser.parse_args()

    result = extract_pdf(args.filepath)
    print(json.dumps(result))
    sys.exit(0)
