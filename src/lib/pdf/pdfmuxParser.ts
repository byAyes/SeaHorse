/**
 * pdfmux Parser Module
 *
 * Provides enhanced PDF text extraction with confidence scoring, OCR fallback,
 * and self-healing capabilities using the pdfmux Python library.
 *
 * MODES (automatic priority):
 *   1. HTTP Server — when PDFMUX_URL env var is set (Docker users)
 *   2. Python Subprocess — runs pdfmux directly via Python (recommended, no Docker)
 *   3. pdf-parse — fallback when pdfmux is unavailable
 *
 * SETUP:
 *   pip install -r scrapers/requirements.txt   # Includes pdfmux
 *   # That's it! No Docker, no env vars needed.
 *
 * OPTIONAL ENV VARS:
 *   PDFMUX_URL=http://localhost:3100           # Use HTTP server mode (Docker)
 *   PDFMUX_QUALITY=standard                    # fast | standard | premium
 */

import { PDFUploadResult } from '../../types/pdf';
import axios from 'axios';
import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import crypto from 'crypto';
import { parsePDFWithPdfJs } from './pdfParser';

// ─── Configuration ──────────────────────────────────────────────────────────

const PDFMUX_SERVER_URL = process.env.PDFMUX_URL || '';
const PDFMUX_TIMEOUT_MS = 60_000;
const PDFMUX_QUALITY = (process.env.PDFMUX_QUALITY || 'standard') as 'fast' | 'standard' | 'premium';
const PDFMUX_SCRIPT = path.join(process.cwd(), 'scripts', 'pdfmux_extract.py');

// ─── Types ──────────────────────────────────────────────────────────────────

interface PdfmuxExtractResponse {
  success: boolean;
  text: string;
  pageCount: number;
  confidence: number;
  error?: string;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Parse a PDF buffer using pdfmux.
 *
 * Priority: HTTP server → Python subprocess → pdf-parse fallback.
 * Each mode fails gracefully if unavailable.
 */
export async function parsePDF(buffer: Buffer): Promise<PDFUploadResult> {
  // 1. Try HTTP server (when PDFMUX_URL is explicitly set)
  if (PDFMUX_SERVER_URL) {
    try {
      const result = await tryHttpServer(buffer);
      if (result.success && result.text) {
        return {
          success: true,
          text: result.text,
          pageCount: result.pageCount,
          confidence: result.confidence,
        };
      }
      if (result.error) {
        console.warn(`[PdfmuxParser] HTTP server error: ${result.error}`);
      }
    } catch (err) {
      console.warn('[PdfmuxParser] HTTP server unavailable, trying subprocess...');
    }
  }

  // 2. Try Python subprocess (auto — no Docker needed)
  try {
    const result = await trySubprocess(buffer);
    if (result.success && result.text) {
      return {
        success: true,
        text: result.text,
        pageCount: result.pageCount,
        confidence: result.confidence,
      };
    }
    if (result.error) {
      console.warn(`[PdfmuxParser] Subprocess error: ${result.error}`);
    }
  } catch (err) {
    console.warn('[PdfmuxParser] Python subprocess unavailable, using pdf-parse fallback...');
  }

  // 3. Fallback to pdf-parse
  return parsePDFWithPdfJs(buffer);
}

/**
 * Check if pdfmux is available (via subprocess).
 */
export async function checkPdfmuxAvailability(): Promise<{
  available: boolean;
  mode?: string;
  version?: string;
  error?: string;
}> {
  // Check HTTP server first
  if (PDFMUX_SERVER_URL) {
    try {
      const res = await axios.get(`${PDFMUX_SERVER_URL}/health`, { timeout: 5000 });
      return {
        available: true,
        mode: 'http',
        version: res.data?.version || 'unknown',
      };
    } catch {
      // Fall through to subprocess check
    }
  }

  // Check subprocess
  try {
    execSync('python -c "import pdfmux; print(pdfmux.__version__ if hasattr(pdfmux, \'__version__\') else \'unknown\')"', {
      timeout: 5000,
      stdio: 'pipe',
    });
    return { available: true, mode: 'subprocess', version: 'installed' };
  } catch {
    return { available: false, error: 'pdfmux not installed. Run: pip install -r scrapers/requirements.txt' };
  }
}

// ─── HTTP Server Mode ─────────────────────────────────────────────────────

async function tryHttpServer(buffer: Buffer): Promise<PdfmuxExtractResponse> {
  if (!buffer || buffer.length === 0) {
    return { success: false, text: '', pageCount: 0, confidence: 0, error: 'Empty buffer' };
  }

  const uint8 = new Uint8Array(buffer);
  const blob = new Blob([uint8], { type: 'application/pdf' });
  const formData = new FormData();
  formData.append('file', blob, 'document.pdf');
  formData.append('quality', PDFMUX_QUALITY);

  const res = await axios.post<PdfmuxExtractResponse>(
    `${PDFMUX_SERVER_URL}/extract`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: PDFMUX_TIMEOUT_MS,
      maxContentLength: 50 * 1024 * 1024,
      maxBodyLength: 50 * 1024 * 1024,
    },
  );

  return res.data;
}

// ─── Python Subprocess Mode ──────────────────────────────────────────────

/**
 * Run pdfmux extraction via direct Python subprocess.
 * Writes the PDF buffer to a temp file, runs the script, returns the result.
 */
async function trySubprocess(buffer: Buffer): Promise<PdfmuxExtractResponse> {
  if (!buffer || buffer.length === 0) {
    return { success: false, text: '', pageCount: 0, confidence: 0, error: 'Empty buffer' };
  }

  // Verify the Python script exists
  if (!fs.existsSync(PDFMUX_SCRIPT)) {
    return { success: false, text: '', pageCount: 0, confidence: 0, error: `Script not found: ${PDFMUX_SCRIPT}` };
  }

  // Write buffer to temp file
  const tmpDir = os.tmpdir();
  const tmpName = `pdfmux_${crypto.randomUUID()}.pdf`;
  const tmpPath = path.join(tmpDir, tmpName);

  try {
    fs.writeFileSync(tmpPath, buffer);

    // Run the Python extraction script
    const stdout = execSync(
      `python "${PDFMUX_SCRIPT}" "${tmpPath}" --quality ${PDFMUX_QUALITY}`,
      { timeout: PDFMUX_TIMEOUT_MS, stdio: 'pipe' },
    );

    const result: PdfmuxExtractResponse = JSON.parse(stdout.toString().trim());
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Subprocess execution failed';
    return { success: false, text: '', pageCount: 0, confidence: 0, error: msg };
  } finally {
    // Clean up temp file
    try {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    } catch {
      // Best effort cleanup
    }
  }
}
